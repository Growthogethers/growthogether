// js/pengingat.js - Dengan Kategori Ulang Tahun
import { db, ref, push, onValue, remove, update, get } from './firebase-config.js';
import { showNotif, escapeHtml } from './utils.js';

let currentUser = null;
let editPengingatId = null;

export function initPengingat() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  loadPengingat();
}

function loadPengingat() {
  onValue(ref(db, `data/pengingat/${currentUser}`), (snapshot) => {
    const data = snapshot.val() || {};
    const pengingatList = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    renderPengingat(pengingatList);
    checkReminders(pengingatList);
  });
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
  
  container.innerHTML = pengingatList.sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '')).map(p => {
    let statusClass = '';
    let statusText = '';
    const isBirthday = p.isBirthday === true;
    
    if (p.tanggal === today) {
      statusClass = 'today';
      statusText = 'Hari ini!';
    } else if (p.tanggal < today) {
      statusClass = 'overdue';
      statusText = 'Terlewat';
    }
    
    const displayDate = p.tanggal ? formatDate(p.tanggal) : 'Tanggal tidak valid';
    
    return `
      <div class="pengingat-card ${statusClass} d-flex justify-content-between align-items-center p-3 border-bottom">
        <div class="d-flex align-items-center gap-3">
          <div class="rounded-circle p-2 ${statusClass === 'today' ? 'bg-warning bg-opacity-10' : statusClass === 'overdue' ? 'bg-danger bg-opacity-10' : 'bg-secondary bg-opacity-10'}" style="width: 45px; height: 45px; display: flex; align-items: center; justify-content: center;">
            <i class="bi ${p.icon || (isBirthday ? 'bi-gift-fill' : 'bi-bell-fill')} fs-5 ${statusClass === 'today' ? 'text-warning' : statusClass === 'overdue' ? 'text-danger' : 'text-muted'}"></i>
          </div>
          <div>
            <div class="fw-medium">${escapeHtml(p.judul)}</div>
            <small class="pengingat-date text-muted">${displayDate}</small>
            ${isBirthday ? '<span class="badge bg-pink ms-2">🎂 Ulang Tahun</span>' : ''}
            ${statusText ? `<span class="badge ${statusClass === 'today' ? 'bg-warning' : 'bg-danger'} ms-2">${statusText}</span>` : ''}
          </div>
        </div>
        ${!isBirthday ? `
          <div class="d-flex gap-2">
            <button class="btn-icon btn-sm" onclick="editPengingat('${p.id}')">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn-icon btn-sm" onclick="deletePengingat('${p.id}')">
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

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
  
  const todayReminders = pengingatList.filter(p => p.tanggal === today && !p.notified);
  todayReminders.forEach(async (p) => {
    showNotif(`🔔 ${p.judul} - Hari ini!`, false, 'warning');
    await update(ref(db, `data/pengingat/${currentUser}/${p.id}`), { notified: true });
  });
}

window.openPengingatModal = function(editId = null) {
  editPengingatId = editId;
  
  const modalHtml = `
    <div class="modal fade" id="pengingatModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0 bg-danger text-white">
            <h5 class="fw-bold mb-0">${editId ? '✏️ Edit Pengingat' : '🔔 Tambah Pengingat'}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body modal-form p-4">
            <div class="mb-3">
              <label class="fw-semibold">Jenis Pengingat</label>
              <select id="pengingatJenis" class="form-select" onchange="togglePengingatJenis()">
                <option value="custom">📝 Pengingat Biasa</option>
                <option value="ulangtahun">🎂 Ulang Tahun Partner</option>
              </select>
            </div>
            <div id="customFields">
              <div class="mb-3">
                <label class="fw-semibold">Judul</label>
                <input type="text" id="pengingatJudul" class="form-control" placeholder="Contoh: Bayar Tagihan">
              </div>
              <div class="mb-3">
                <label class="fw-semibold">Tanggal</label>
                <input type="date" id="pengingatTanggal" class="form-control">
              </div>
            </div>
            <div id="ulangtahunFields" style="display: none;">
              <div class="mb-3">
                <label class="fw-semibold">Untuk User</label>
                <select id="pengingatUser" class="form-select">
                  <option value="FACHMI">✨ Fachmi</option>
                  <option value="AZIZAH">🌸 Azizah</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="fw-semibold">Tanggal Ulang Tahun</label>
                <input type="date" id="pengingatTanggalUlangtahun" class="form-control">
              </div>
              <div class="alert alert-info small">
                <i class="bi bi-info-circle me-1"></i>
                Pengingat ulang tahun akan muncul setiap tahun otomatis.
              </div>
            </div>
            <div class="mb-3">
              <label class="fw-semibold">Icon</label>
              <select id="pengingatIcon" class="form-select">
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
          <div class="modal-footer border-0 pb-4">
            <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-danger rounded-pill px-4" onclick="savePengingat()">Simpan</button>
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
    const currentUserName = currentUser === "FACHMI" ? "Fachmi" : "Azizah";
    const relation = targetUser === currentUser ? "ulang tahun saya" : `ulang tahun ${targetName}`;
    
    // Simpan ke localStorage untuk user yang bersangkutan
    localStorage.setItem(`partnerBirthday_${targetUser}`, tanggalUlangtahun);
    
    showNotif(`✅ Pengingat ${relation} (${formatDate(tanggalUlangtahun)}) disimpan`, false, 'success');
    
    // Refresh dashboard jika perlu
    if (typeof renderDashboard === 'function') renderDashboard();
    
  } else {
    // Custom reminder
    const judul = document.getElementById('pengingatJudul').value;
    const tanggal = document.getElementById('pengingatTanggal').value;
    
    if (!judul || !tanggal) {
      showNotif("Judul dan tanggal harus diisi", true, 'error');
      return;
    }
    
    const data = { judul, tanggal, icon, updatedAt: Date.now() };
    
    if (editPengingatId) {
      await update(ref(db, `data/pengingat/${currentUser}/${editPengingatId}`), data);
      showNotif("Pengingat berhasil diupdate", false, 'success');
      editPengingatId = null;
    } else {
      data.createdAt = Date.now();
      data.notified = false;
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
  await remove(ref(db, `data/pengingat/${currentUser}/${id}`));
  showNotif("Pengingat dihapus", false, 'warning');
};

window.initPengingat = initPengingat;
