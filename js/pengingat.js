// js/pengingat.js - Dengan Efek Suara & Status Selesai
import { db, ref, push, onValue, remove, update, get } from './firebase-config.js';
import { showNotif, escapeHtml } from './utils.js';

let currentUser = null;
let editPengingatId = null;
let audioContext = null;
let isPlaying = false;

// Inisialisasi Audio untuk suara notifikasi
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playNotificationSound() {
  if (isPlaying) return;
  
  initAudio();
  
  // Create beep sound using Web Audio API
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 880; // 880 Hz
  gainNode.gain.value = 0.3;
  
  oscillator.start();
  gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 1.5);
  oscillator.stop(audioContext.currentTime + 1.5);
  
  // Second beep
  setTimeout(() => {
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.frequency.value = 440;
    gain2.gain.value = 0.3;
    osc2.start();
    gain2.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 1);
    osc2.stop(audioContext.currentTime + 1);
  }, 500);
  
  isPlaying = true;
  setTimeout(() => { isPlaying = false; }, 2000);
}

export function initPengingat() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  loadPengingat();
  checkOverdueReminders();
}

function loadPengingat() {
  onValue(ref(db, `data/pengingat/${currentUser}`), (snapshot) => {
    const data = snapshot.val() || {};
    const pengingatList = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    renderPengingat(pengingatList);
    checkReminders(pengingatList);
  });
}

function checkOverdueReminders() {
  // Cek setiap jam untuk reminder yang overdue
  setInterval(() => {
    const today = new Date().toISOString().split('T')[0];
    onValue(ref(db, `data/pengingat/${currentUser}`), (snapshot) => {
      const data = snapshot.val() || {};
      const pengingatList = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      const todayReminders = pengingatList.filter(p => p.tanggal === today && p.status !== 'selesai' && !p.notified);
      
      todayReminders.forEach(async (p) => {
        if (!p.notified) {
          playNotificationSound();
          showNotifWithSound(`🔔 ${p.judul} - Hari ini! Jangan lupa!`, false, 'warning');
          await update(ref(db, `data/pengingat/${currentUser}/${p.id}`), { notified: true });
        }
      });
    }, { onlyOnce: true });
  }, 3600000); // Cek setiap jam
}

function renderPengingat(pengingatList) {
  const container = document.getElementById('pengingatList');
  if (!container) return;
  
  const today = new Date().toISOString().split('T')[0];
  
  if (pengingatList.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi bi-bell-slash fs-1"></i>
        <p class="mt-2">Belum ada pengingat</p>
        <button class="btn btn-danger rounded-pill mt-2" onclick="openPengingatModal()">
          <i class="bi bi-plus-lg me-1"></i> Tambah Pengingat
        </button>
      </div>
    `;
    return;
  }
  
  // Urutkan: yang belum selesai di atas, status urgent di atas
  const sortedList = [...pengingatList].sort((a, b) => {
    if (a.status === 'selesai' && b.status !== 'selesai') return 1;
    if (a.status !== 'selesai' && b.status === 'selesai') return -1;
    if (a.tanggal === today && b.tanggal !== today) return -1;
    if (a.tanggal < today && b.tanggal >= today) return -1;
    return (a.tanggal || '').localeCompare(b.tanggal || '');
  });
  
  container.innerHTML = sortedList.map(p => {
    let statusClass = '';
    let statusText = '';
    let statusIcon = '';
    let isOverdue = false;
    
    if (p.status === 'selesai') {
      statusClass = 'completed';
      statusText = 'Selesai';
      statusIcon = '✅';
    } else if (p.tanggal === today) {
      statusClass = 'today';
      statusText = 'Hari ini!';
      statusIcon = '🔔';
    } else if (p.tanggal < today) {
      statusClass = 'overdue';
      statusText = 'Terlewat';
      statusIcon = '⚠️';
      isOverdue = true;
    } else {
      statusClass = 'upcoming';
      statusText = 'Mendatang';
      statusIcon = '📅';
    }
    
    const displayDate = p.tanggal ? formatDate(p.tanggal) : 'Tanggal tidak valid';
    
    return `
      <div class="pengingat-card ${statusClass} d-flex justify-content-between align-items-center p-3 border-bottom" data-id="${p.id}">
        <div class="d-flex align-items-center gap-3">
          <div class="rounded-circle p-2 ${statusClass === 'today' ? 'bg-warning bg-opacity-10' : statusClass === 'overdue' ? 'bg-danger bg-opacity-10' : statusClass === 'completed' ? 'bg-success bg-opacity-10' : 'bg-secondary bg-opacity-10'}" style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center;">
            <i class="bi ${p.icon || 'bi-bell-fill'} fs-4 ${statusClass === 'today' ? 'text-warning' : statusClass === 'overdue' ? 'text-danger animate-pulse' : statusClass === 'completed' ? 'text-success' : 'text-muted'}"></i>
          </div>
          <div>
            <div class="fw-medium">${escapeHtml(p.judul)}</div>
            <div class="d-flex align-items-center gap-2 mt-1">
              <small class="pengingat-date text-muted">${displayDate}</small>
              <span class="badge ${statusClass === 'today' ? 'bg-warning' : statusClass === 'overdue' ? 'bg-danger' : statusClass === 'completed' ? 'bg-success' : 'bg-secondary'}">${statusIcon} ${statusText}</span>
            </div>
          </div>
        </div>
        <div class="d-flex gap-2">
          ${p.status !== 'selesai' ? `
            <button class="btn-icon btn-sm btn-success" onclick="completeReminder('${p.id}')" title="Tandai Selesai">
              <i class="bi bi-check-lg"></i>
            </button>
          ` : ''}
          <button class="btn-icon btn-sm" onclick="editPengingat('${p.id}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn-icon btn-sm" onclick="deletePengingat('${p.id}')">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.completeReminder = async function(id) {
  await update(ref(db, `data/pengingat/${currentUser}/${id}`), { 
    status: 'selesai', 
    completedAt: Date.now(),
    notified: true 
  });
  showNotif("✅ Pengingat telah diselesaikan!", false, 'success');
  // Stop any playing sound
  isPlaying = false;
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${parts[2]} ${bulan[parseInt(parts[1]) - 1]} ${parts[0]}`;
  }
  return dateStr;
}

function checkReminders(pengingatList) {
  const today = new Date().toISOString().split('T')[0];
  const todayReminders = pengingatList.filter(p => p.tanggal === today && p.status !== 'selesai' && !p.notified);
  
  todayReminders.forEach(async (p) => {
    // Play sound
    playNotificationSound();
    // Show notification with sound indication
    showNotifWithSound(`🔔 ${p.judul} - Hari ini! Jangan lupa!`, false, 'warning');
    await update(ref(db, `data/pengingat/${currentUser}/${p.id}`), { notified: true });
  });
}

function showNotifWithSound(msg, isErr, type) {
  // Show toast notification
  showNotif(msg, isErr, type);
  // Also show browser notification if permitted
  if (Notification.permission === 'granted') {
    new Notification('Growthogether - Pengingat', { body: msg, icon: '/favicon.ico' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

// Request notification permission on init
if (Notification.permission === 'default') {
  Notification.requestPermission();
}

window.openPengingatModal = function(editId = null) {
  editPengingatId = editId;
  
  const modalHtml = `
    <div class="modal fade" id="pengingatModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content rounded-4" style="max-width: 500px;">
          <div class="modal-header border-0 bg-danger text-white py-3">
            <h5 class="fw-bold mb-0">${editId ? '✏️ Edit Pengingat' : '🔔 Tambah Pengingat'}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body modal-form p-4">
            <div class="mb-3">
              <label class="fw-semibold mb-2">Jenis Pengingat</label>
              <select id="pengingatJenis" class="form-select form-select-lg rounded-3" onchange="togglePengingatJenis()">
                <option value="custom">📝 Pengingat Biasa</option>
                <option value="ulangtahun">🎂 Ulang Tahun Partner</option>
              </select>
            </div>
            <div id="customFields">
              <div class="mb-3">
                <label class="fw-semibold mb-2">Judul Pengingat</label>
                <input type="text" id="pengingatJudul" class="form-control form-control-lg rounded-3" placeholder="Contoh: Bayar Tagihan Listrik">
              </div>
              <div class="mb-3">
                <label class="fw-semibold mb-2">Tanggal</label>
                <input type="date" id="pengingatTanggal" class="form-control form-control-lg rounded-3">
              </div>
            </div>
            <div id="ulangtahunFields" style="display: none;">
              <div class="mb-3">
                <label class="fw-semibold mb-2">Untuk User</label>
                <select id="pengingatUser" class="form-select form-select-lg rounded-3">
                  <option value="FACHMI">✨ Fachmi</option>
                  <option value="AZIZAH">🌸 Azizah</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="fw-semibold mb-2">Tanggal Ulang Tahun</label>
                <input type="date" id="pengingatTanggalUlangtahun" class="form-control form-control-lg rounded-3">
              </div>
              <div class="alert alert-info small">
                <i class="bi bi-info-circle me-1"></i>
                Pengingat ulang tahun akan muncul setiap tahun otomatis dan berbunyi.
              </div>
            </div>
            <div class="mb-3">
              <label class="fw-semibold mb-2">Icon</label>
              <select id="pengingatIcon" class="form-select form-select-lg rounded-3">
                <option value="bi-calendar-event">📅 Umum</option>
                <option value="bi-heart">❤️ Anniversary</option>
                <option value="bi-gift">🎁 Ulang Tahun</option>
                <option value="bi-file-medical">🏥 Kesehatan</option>
                <option value="bi-cart">🛒 Belanja</option>
                <option value="bi-credit-card">💳 Tagihan</option>
                <option value="bi-truck">🚚 Pengiriman</option>
              </select>
            </div>
          </div>
          <div class="modal-footer border-0 pb-4 px-4">
            <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-danger rounded-pill px-4" onclick="savePengingat()">Simpan Pengingat</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  let modal = document.getElementById('pengingatModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('pengingatModal');
  }
  
  if (editId) {
    loadPengingatData(editId);
    document.getElementById('pengingatJenis').value = 'custom';
    togglePengingatJenis();
  } else {
    document.getElementById('pengingatJenis').value = 'custom';
    togglePengingatJenis();
    document.getElementById('pengingatTanggal').value = new Date().toISOString().split('T')[0];
  }
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

window.togglePengingatJenis = function() {
  const jenis = document.getElementById('pengingatJenis').value;
  const customFields = document.getElementById('customFields');
  const ulangtahunFields = document.getElementById('ulangtahunFields');
  
  if (jenis === 'ulangtahun') {
    customFields.style.display = 'none';
    ulangtahunFields.style.display = 'block';
  } else {
    customFields.style.display = 'block';
    ulangtahunFields.style.display = 'none';
  }
};

async function loadPengingatData(id) {
  const snapshot = await get(ref(db, `data/pengingat/${currentUser}/${id}`));
  const data = snapshot.val();
  
  if (data) {
    document.getElementById('pengingatJudul').value = data.judul || '';
    document.getElementById('pengingatTanggal').value = data.tanggal || '';
    document.getElementById('pengingatIcon').value = data.icon || 'bi-calendar-event';
  }
}

window.savePengingat = async function() {
  const jenis = document.getElementById('pengingatJenis').value;
  const icon = document.getElementById('pengingatIcon').value;
  
  if (jenis === 'ulangtahun') {
    const targetUser = document.getElementById('pengingatUser').value;
    const tanggalUlangtahun = document.getElementById('pengingatTanggalUlangtahun').value;
    
    if (!tanggalUlangtahun) {
      showNotif("Tanggal ulang tahun harus diisi", true, 'error');
      return;
    }
    
    const targetName = targetUser === "FACHMI" ? "Fachmi" : "Azizah";
    const relation = targetUser === currentUser ? "ulang tahun saya" : `ulang tahun ${targetName}`;
    
    localStorage.setItem(`partnerBirthday_${targetUser}`, tanggalUlangtahun);
    
    showNotif(`✅ Pengingat ${relation} (${formatDate(tanggalUlangtahun)}) disimpan`, false, 'success');
    
    if (typeof renderDashboard === 'function') renderDashboard();
    
  } else {
    const judul = document.getElementById('pengingatJudul').value;
    const tanggal = document.getElementById('pengingatTanggal').value;
    
    if (!judul || !tanggal) {
      showNotif("Judul dan tanggal harus diisi", true, 'error');
      return;
    }
    
    const data = { 
      judul, 
      tanggal, 
      icon, 
      status: 'pending',
      notified: false,
      updatedAt: Date.now() 
    };
    
    if (editPengingatId) {
      await update(ref(db, `data/pengingat/${currentUser}/${editPengingatId}`), data);
      showNotif("Pengingat berhasil diupdate", false, 'success');
      editPengingatId = null;
    } else {
      data.createdAt = Date.now();
      await push(ref(db, `data/pengingat/${currentUser}`), data);
      showNotif("Pengingat berhasil ditambahkan", false, 'success');
    }
  }
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('pengingatModal'));
  if (modal) modal.hide();
};

window.editPengingat = function(id) {
  openPengingatModal(id);
};

window.deletePengingat = async function(id) {
  if (confirm("Yakin ingin menghapus pengingat ini?")) {
    await remove(ref(db, `data/pengingat/${currentUser}/${id}`));
    showNotif("Pengingat dihapus", false, 'warning');
  }
};

window.initPengingat = initPengingat;
