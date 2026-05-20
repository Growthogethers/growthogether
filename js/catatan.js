// js/catatan.js - Dengan Rekomendasi AI & Koneksi Keuangan
import { db, ref, push, onValue, remove, update, get, set } from './firebase-config.js';
import { showNotif, escapeHtml } from './utils.js';

let currentUser = null;
let kategoriList = [];
let checklistItems = {};
let editKategoriId = null;
let editItemParentId = null;
let editItemId = null;
let aiRecommendations = [];

// Default kategori persiapan pernikahan dengan estimasi biaya
const defaultKategori = [
  { nama: "📋 Dokumen Penting", icon: "bi-files", estimasiBiaya: 500000, items: [
    "KTP (scan dan asli)", "KK (scan dan asli)", "Akta Kelahiran", "Ijazah terakhir", 
    "Paspor (jika ada)", "Surat Keterangan Belum Menikah", "Fotokopi buku nikah orang tua"
  ]},
  { nama: "🏛️ Venue & Dekorasi", icon: "bi-building", estimasiBiaya: 25000000, items: [
    "Survey venue", "Booking venue akad", "Booking venue resepsi", "Dekorasi pelaminan",
    "Dekorasi reception", "Tempat cuci muka pengantin", "Backdrop foto", "Sewa kursi & meja"
  ]},
  { nama: "👗 Busana & Makeup", icon: "bi-person-standing", estimasiBiaya: 5000000, items: [
    "Baju akad pria", "Baju akad wanita", "Baju resepsi pria (ganti)", "Baju resepsi wanita (ganti)",
    "Sewa aksesoris", "MUA untuk akad", "MUA untuk resepsi", "Makeup trial"
  ]},
  { nama: "💍 Perlengkapan", icon: "bi-diamond", estimasiBiaya: 10000000, items: [
    "Cincin kawin (2 pasang)", "Seserahan (lengkap)", "Mahar & mas kawin", "Kado pernikahan",
    "Souvenir tamu (minimal 2 item)", "Buket pengantin", "Hantaran"
  ]},
  { nama: "📸 Dokumentasi", icon: "bi-camera", estimasiBiaya: 7000000, items: [
    "Cari fotografer", "Booking pre-wedding", "Jadwal pre-wedding", "Cetak album pre-wedding",
    "Foto akad", "Foto resepsi", "Video documentary", "Video highlight"
  ]},
  { nama: "🍽️ Konsumsi", icon: "bi-cup-straw", estimasiBiaya: 15000000, items: [
    "Catering untuk tamu", "Snack untuk akad", "Menu utama resepsi", "Kue pernikahan (wedding cake)",
    "Air mineral & minuman", "Tempat cuci piring"
  ]},
  { nama: "🎵 Hiburan", icon: "bi-music-note", estimasiBiaya: 5000000, items: [
    "MC (Master of Ceremony)", "Band / Orgen tunggal", "Sewa sound system", "Sewa lighting",
    "Fotobooth / selfie booth", "Karaoke"
  ]},
  { nama: "📝 Undangan", icon: "bi-envelope", estimasiBiaya: 2000000, items: [
    "Desain undangan digital", "Desain undangan fisik", "Cetak undangan", 
    "Distribusi undangan", "RSVP tamu", "Papan ucapan"
  ]}
];

// AI Recommendation Engine
function generateAIRecommendations() {
  const recommendations = [];
  
  // Rekomendasi berdasarkan kategori yang belum lengkap
  kategoriList.forEach(kat => {
    const items = checklistItems[kat.id] ? Object.values(checklistItems[kat.id]) : [];
    const completedItems = items.filter(item => item && item.selesai);
    const incompleteItems = items.filter(item => item && !item.selesai);
    
    if (incompleteItems.length > 0 && completedItems.length < items.length) {
      recommendations.push({
        id: `reco_${Date.now()}_${kat.id}`,
        title: `📋 Prioritaskan: ${kat.nama}`,
        description: `Anda masih memiliki ${incompleteItems.length} item yang perlu diselesaikan di kategori ${kat.nama}.`,
        action: `Selesaikan ${incompleteItems[0]?.nama || 'item yang tersisa'}`,
        kategoriId: kat.id,
        estimasiBiaya: kat.estimasiBiaya || 0,
        urgent: incompleteItems.length > 3
      });
    }
  });
  
  // Rekomendasi anggaran
  const totalEstimasi = kategoriList.reduce((sum, kat) => sum + (kat.estimasiBiaya || 0), 0);
  recommendations.push({
    id: `reco_budget_${Date.now()}`,
    title: `💰 Estimasi Total Biaya: Rp ${totalEstimasi.toLocaleString('id-ID')}`,
    description: `Berdasarkan kategori yang Anda miliki, estimasi total biaya persiapan pernikahan adalah Rp ${totalEstimasi.toLocaleString('id-ID')}.`,
    action: "Atur Target Keuangan",
    actionLink: "keuangan",
    estimasiBiaya: totalEstimasi
  });
  
  // Rekomendasi waktu
  const today = new Date();
  const weddingDate = localStorage.getItem(`weddingDate_${currentUser}`);
  if (weddingDate) {
    const wedding = new Date(weddingDate);
    const daysLeft = Math.ceil((wedding - today) / (1000 * 60 * 60 * 24));
    if (daysLeft > 0 && daysLeft < 90) {
      recommendations.push({
        id: `reco_time_${Date.now()}`,
        title: `⏰ H-${daysLeft} menuju hari H!`,
        description: `Waktu persiapan tersisa ${daysLeft} hari. Segera selesaikan persiapan yang belum.`,
        action: "Lihat Timeline",
        urgent: daysLeft < 30
      });
    }
  }
  
  return recommendations.slice(0, 5);
}

function renderAIRecommendations() {
  const container = document.getElementById('aiRecommendations');
  if (!container) return;
  
  aiRecommendations = generateAIRecommendations();
  
  if (aiRecommendations.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted py-3">
        <i class="bi bi-robot fs-4"></i>
        <p class="small mb-0">AI akan memberikan rekomendasi setelah Anda menambahkan kategori</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="d-flex align-items-center gap-2 mb-2">
      <i class="bi bi-robot fs-5 text-purple"></i>
      <span class="fw-bold small">Rekomendasi AI untuk Anda</span>
    </div>
    <div class="row g-2">
      ${aiRecommendations.map(rec => `
        <div class="col-12 col-md-6">
          <div class="card border-0 bg-light p-2 ${rec.urgent ? 'border-start border-danger border-3' : ''}">
            <div class="d-flex justify-content-between align-items-start">
              <div class="flex-grow-1">
                <div class="fw-semibold small">${rec.title}</div>
                <small class="text-muted d-block">${rec.description}</small>
                ${rec.estimasiBiaya > 0 ? `<small class="text-success">💰 Estimasi: Rp ${rec.estimasiBiaya.toLocaleString('id-ID')}</small>` : ''}
              </div>
              <button class="btn btn-sm ${rec.urgent ? 'btn-danger' : 'btn-outline-primary'} rounded-pill ms-2" 
                      onclick="applyAIRecommendation('${rec.id}')">
                ${rec.action} <i class="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.applyAIRecommendation = function(recommendationId) {
  const rec = aiRecommendations.find(r => r.id === recommendationId);
  if (!rec) return;
  
  if (rec.actionLink === 'keuangan') {
    window.location.href = '#keuangan-page';
    showPage('keuangan');
    setTimeout(() => {
      window.setTargetTabungan();
    }, 500);
  } else if (rec.kategoriId) {
    // Scroll ke kategori yang direkomendasikan
    const kategoriElement = document.querySelector(`[data-kategori-id="${rec.kategoriId}"]`);
    if (kategoriElement) {
      kategoriElement.scrollIntoView({ behavior: 'smooth' });
      kategoriElement.classList.add('border-warning');
      setTimeout(() => {
        kategoriElement.classList.remove('border-warning');
      }, 2000);
    }
  }
};

export async function initCatatan() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  // Inject AI Recommendations container di halaman catatan
  injectAIContainer();
  
  await loadKategori();
  renderKategori();
  updateProgress();
  renderAIRecommendations();
}

function injectAIContainer() {
  const catatanPage = document.getElementById('catatan-page');
  if (catatanPage && !document.getElementById('aiRecommendations')) {
    const aiContainer = document.createElement('div');
    aiContainer.id = 'aiRecommendations';
    aiContainer.className = 'card p-3 mb-4 bg-gradient-ai';
    aiContainer.style.background = 'linear-gradient(135deg, #667eea15, #764ba215)';
    aiContainer.style.borderRadius = '16px';
    
    // Insert after progress overview
    const progressCard = catatanPage.querySelector('.card.mb-4');
    if (progressCard && progressCard.nextSibling) {
      catatanPage.insertBefore(aiContainer, progressCard.nextSibling);
    } else {
      catatanPage.insertBefore(aiContainer, catatanPage.firstChild);
    }
  }
}

async function loadKategori() {
  const snapshot = await get(ref(db, `data/catatan/${currentUser}/kategori`));
  const saved = snapshot.val();
  
  if (saved && Object.keys(saved).length > 0) {
    kategoriList = Object.entries(saved).map(([id, val]) => ({ id, ...val }));
  } else {
    for (const kat of defaultKategori) {
      const newRef = push(ref(db, `data/catatan/${currentUser}/kategori`));
      const kategoriId = newRef.key;
      await set(ref(db, `data/catatan/${currentUser}/kategori/${kategoriId}`), { 
        nama: kat.nama, 
        icon: kat.icon,
        estimasiBiaya: kat.estimasiBiaya 
      });
      
      for (const item of kat.items) {
        const itemRef = push(ref(db, `data/catatan/${currentUser}/items/${kategoriId}`));
        await set(ref(db, `data/catatan/${currentUser}/items/${kategoriId}/${itemRef.key}`), { 
          nama: item, 
          selesai: false 
        });
      }
    }
    await loadKategori();
  }
  
  loadChecklistItems();
}

function loadChecklistItems() {
  onValue(ref(db, `data/catatan/${currentUser}/items`), (snapshot) => {
    checklistItems = snapshot.val() || {};
    updateProgress();
    renderKategori();
    renderAIRecommendations();
  });
}

function updateProgress() {
  let total = 0;
  let selesai = 0;
  let totalEstimasiBiaya = 0;
  let estimasiTerselesaikan = 0;
  
  kategoriList.forEach(kat => {
    const katItems = checklistItems[kat.id] ? Object.values(checklistItems[kat.id]) : [];
    const validItems = katItems.filter(item => item !== null);
    const completedItems = validItems.filter(item => item.selesai);
    total += validItems.length;
    selesai += completedItems.length;
    
    if (kat.estimasiBiaya) {
      totalEstimasiBiaya += kat.estimasiBiaya;
      estimasiTerselesaikan += (kat.estimasiBiaya * completedItems.length) / validItems.length;
    }
  });
  
  const percent = total > 0 ? (selesai / total) * 100 : 0;
  const progressPercentEl = document.getElementById('progressPercent');
  const catatanProgressEl = document.getElementById('catatanProgress');
  const estimasiBiayaEl = document.getElementById('estimasiBiaya');
  
  if (progressPercentEl) progressPercentEl.innerHTML = `${Math.round(percent)}%`;
  if (catatanProgressEl) catatanProgressEl.style.width = `${percent}%`;
  if (estimasiBiayaEl) {
    estimasiBiayaEl.innerHTML = `💰 Estimasi Total: Rp ${totalEstimasiBiaya.toLocaleString('id-ID')} | Tercapai: Rp ${Math.round(estimasiTerselesaikan).toLocaleString('id-ID')}`;
  }
}

function renderKategori() {
  const container = document.getElementById('kategoriContainer');
  if (!container) return;
  
  if (kategoriList.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi bi-folder2-open fs-1"></i>
        <p class="mt-2">Belum ada kategori. Klik tombol + Kategori untuk menambah.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = kategoriList.map((kat, idx) => {
    const items = checklistItems[kat.id] ? Object.entries(checklistItems[kat.id]) : [];
    const validItems = items.filter(([_, item]) => item !== null);
    const completedCount = validItems.filter(([_, item]) => item.selesai).length;
    const percentItem = validItems.length > 0 ? (completedCount / validItems.length) * 100 : 0;
    
    return `
      <div class="card mb-3 border-0 shadow-sm" data-kategori-id="${kat.id}">
        <div class="card-header bg-transparent border-0 d-flex justify-content-between align-items-center p-3">
          <div class="d-flex align-items-center gap-2" style="cursor: pointer;" data-bs-toggle="collapse" data-bs-target="#collapse${idx}">
            <i class="bi ${kat.icon} fs-4 text-primary"></i>
            <div>
              <h6 class="fw-bold mb-0">${escapeHtml(kat.nama)}</h6>
              ${kat.estimasiBiaya ? `<small class="text-muted">💰 Rp ${kat.estimasiBiaya.toLocaleString('id-ID')}</small>` : ''}
            </div>
            <span class="badge bg-secondary rounded-pill">${completedCount}/${validItems.length}</span>
          </div>
          <div class="dropdown">
            <button class="btn-icon" data-bs-toggle="dropdown">
              <i class="bi bi-three-dots-vertical"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><a class="dropdown-item" onclick="editKategori('${kat.id}')"><i class="bi bi-pencil me-2"></i>Edit Kategori</a></li>
              <li><a class="dropdown-item" onclick="addBudgetToKeuangan('${kat.id}')"><i class="bi bi-wallet2 me-2"></i>Tambah ke Keuangan</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><a class="dropdown-item text-danger" onclick="deleteKategori('${kat.id}')"><i class="bi bi-trash3 me-2"></i>Hapus Kategori</a></li>
            </ul>
          </div>
        </div>
        <div class="progress rounded-0" style="height: 3px;">
          <div class="progress-bar bg-success" style="width: ${percentItem}%"></div>
        </div>
        <div id="collapse${idx}" class="collapse">
          <div class="card-body p-0">
            ${validItems.map(([itemId, item]) => `
              <div class="checklist-item d-flex align-items-center justify-content-between p-3 border-bottom">
                <div class="d-flex align-items-center gap-3 flex-grow-1">
                  <input type="checkbox" class="form-check-input fs-5" id="item_${itemId}" ${item.selesai ? 'checked' : ''} onchange="toggleItem('${kat.id}', '${itemId}', this.checked)">
                  <label class="checklist-label mb-0 ${item.selesai ? 'text-decoration-line-through text-muted' : ''}" for="item_${itemId}">${escapeHtml(item.nama)}</label>
                </div>
                <div>
                  <button class="btn-icon btn-sm" onclick="addItemToKeuangan('${kat.id}', '${itemId}', '${escapeHtml(item.nama)}')" title="Tambah ke Keuangan">
                    <i class="bi bi-wallet2 text-success"></i>
                  </button>
                  <button class="btn-icon btn-sm" onclick="editItem('${kat.id}', '${itemId}')">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn-icon btn-sm" onclick="deleteItem('${kat.id}', '${itemId}')">
                    <i class="bi bi-trash3"></i>
                  </button>
                </div>
              </div>
            `).join('')}
            <div class="p-3 text-center">
              <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="addItemToKategori('${kat.id}')">
                <i class="bi bi-plus-lg me-1"></i> Tambah Item
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Fungsi untuk menambah biaya item ke keuangan
window.addItemToKeuangan = async function(kategoriId, itemId, itemNama) {
  const kat = kategoriList.find(k => k.id === kategoriId);
  const estimasiBiaya = kat?.estimasiBiaya || 0;
  const biayaPerItem = Math.round(estimasiBiaya / 10) || 100000; // Estimasi biaya per item
  
  const nominal = prompt(`Masukkan nominal untuk "${itemNama}"\nEstimasi: Rp ${biayaPerItem.toLocaleString('id-ID')}`, biayaPerItem);
  
  if (nominal && !isNaN(nominal) && parseInt(nominal) > 0) {
    if (confirm(`Tambahkan keuangan untuk "${itemNama}" sebesar Rp ${parseInt(nominal).toLocaleString('id-ID')}?`)) {
      await window.addTransaksiFromExternal(currentUser, {
        tipe: 'pengeluaran',
        kategori: 'Pernikahan',
        nominal: parseInt(nominal),
        catatan: `Biaya untuk: ${itemNama} (dari Catatan Persiapan)`,
        fromCatatan: true,
        sumber: itemNama
      });
      
      // Tandai item sebagai selesai
      await update(ref(db, `data/catatan/${currentUser}/items/${kategoriId}/${itemId}`), { selesai: true });
      showNotif(`✅ "${itemNama}" ditambahkan ke keuangan dan ditandai selesai!`, false, 'success');
    }
  }
};

// Fungsi untuk menambah budget seluruh kategori ke keuangan
window.addBudgetToKeuangan = async function(kategoriId) {
  const kat = kategoriList.find(k => k.id === kategoriId);
  if (!kat || !kat.estimasiBiaya) {
    showNotif("Kategori ini tidak memiliki estimasi biaya", true, 'error');
    return;
  }
  
  if (confirm(`Tambahkan budget untuk "${kat.nama}" sebesar Rp ${kat.estimasiBiaya.toLocaleString('id-ID')} ke dalam rencana keuangan?`)) {
    await window.addTransaksiFromExternal(currentUser, {
      tipe: 'pengeluaran',
      kategori: 'Pernikahan',
      nominal: kat.estimasiBiaya,
      catatan: `Budget untuk: ${kat.nama} (dari Catatan Persiapan)`,
      fromCatatan: true,
      sumber: kat.nama
    });
    showNotif(`✅ Budget "${kat.nama}" ditambahkan ke keuangan!`, false, 'success');
  }
};

window.openKategoriModal = function(editId = null) {
  editKategoriId = editId;
  
  const modalHtml = `
    <div class="modal fade" id="kategoriModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content rounded-4" style="max-width: 500px;">
          <div class="modal-header border-0 bg-warning text-dark py-3">
            <h5 class="fw-bold mb-0">${editId ? '✏️ Edit Kategori' : '📁 Tambah Kategori'}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body modal-form p-4">
            <div class="mb-3">
              <label class="fw-semibold mb-2">Nama Kategori</label>
              <input type="text" id="kategoriNama" class="form-control form-control-lg rounded-3" placeholder="Contoh: Dokumentasi Pernikahan">
            </div>
            <div class="mb-3">
              <label class="fw-semibold mb-2">Icon</label>
              <select id="kategoriIcon" class="form-select form-select-lg rounded-3">
                <option value="bi-files">📋 Dokumen</option>
                <option value="bi-building">🏛️ Venue</option>
                <option value="bi-person-standing">👗 Busana</option>
                <option value="bi-diamond">💍 Perlengkapan</option>
                <option value="bi-camera">📸 Dokumentasi</option>
                <option value="bi-cup-straw">🍽️ Konsumsi</option>
                <option value="bi-music-note">🎵 Hiburan</option>
                <option value="bi-envelope">📝 Undangan</option>
                <option value="bi-wallet2">💰 Anggaran</option>
                <option value="bi-people">👥 Tamu</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="fw-semibold mb-2">Estimasi Biaya (Rp)</label>
              <input type="number" id="kategoriEstimasi" class="form-control form-control-lg rounded-3" placeholder="Estimasi biaya untuk kategori ini">
              <small class="text-muted">Biaya ini akan terhubung dengan menu Keuangan</small>
            </div>
          </div>
          <div class="modal-footer border-0 pb-4 px-4">
            <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-warning rounded-pill px-4" onclick="saveKategori()">Simpan Kategori</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  let modal = document.getElementById('kategoriModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('kategoriModal');
  }
  
  if (editId) {
    loadKategoriData(editId);
  }
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

async function loadKategoriData(id) {
  const snapshot = await get(ref(db, `data/catatan/${currentUser}/kategori/${id}`));
  const data = snapshot.val();
  if (data) {
    document.getElementById('kategoriNama').value = data.nama || '';
    document.getElementById('kategoriIcon').value = data.icon || 'bi-files';
    document.getElementById('kategoriEstimasi').value = data.estimasiBiaya || '';
  }
}

window.saveKategori = async function() {
  const nama = document.getElementById('kategoriNama').value;
  const icon = document.getElementById('kategoriIcon').value;
  const estimasiBiaya = parseInt(document.getElementById('kategoriEstimasi').value) || 0;
  
  if (!nama) {
    showNotif("Nama kategori harus diisi", true, 'error');
    return;
  }
  
  if (editKategoriId) {
    await update(ref(db, `data/catatan/${currentUser}/kategori/${editKategoriId}`), { nama, icon, estimasiBiaya });
    showNotif("Kategori berhasil diupdate", false, 'success');
    editKategoriId = null;
  } else {
    await push(ref(db, `data/catatan/${currentUser}/kategori`), { nama, icon, estimasiBiaya });
    showNotif("Kategori berhasil ditambahkan", false, 'success');
  }
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('kategoriModal'));
  if (modal) modal.hide();
  await loadKategori();
};

window.editKategori = function(id) {
  openKategoriModal(id);
};

window.deleteKategori = async function(id) {
  if (confirm("Yakin ingin menghapus kategori ini? Semua item di dalamnya juga akan terhapus.")) {
    await remove(ref(db, `data/catatan/${currentUser}/kategori/${id}`));
    await remove(ref(db, `data/catatan/${currentUser}/items/${id}`));
    showNotif("Kategori dihapus", false, 'warning');
    await loadKategori();
  }
};

window.toggleItem = async function(kategoriId, itemId, selesai) {
  await update(ref(db, `data/catatan/${currentUser}/items/${kategoriId}/${itemId}`), { selesai });
  updateProgress();
  renderAIRecommendations();
};

window.addItemToKategori = function(kategoriId) {
  editItemParentId = kategoriId;
  editItemId = null;
  
  const modalHtml = `
    <div class="modal fade" id="itemModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content rounded-4" style="max-width: 500px;">
          <div class="modal-header border-0 bg-primary text-white">
            <h5 class="fw-bold mb-0">📝 Tambah Item Baru</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4">
            <input type="text" id="itemNama" class="form-control form-control-lg rounded-3" placeholder="Nama item / tugas">
          </div>
          <div class="modal-footer border-0 pb-4 px-4">
            <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-primary rounded-pill px-4" onclick="saveItem()">Simpan Item</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  let modal = document.getElementById('itemModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('itemModal');
  }
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

window.editItem = function(kategoriId, itemId) {
  editItemParentId = kategoriId;
  editItemId = itemId;
  
  const modalHtml = `
    <div class="modal fade" id="itemModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content rounded-4" style="max-width: 500px;">
          <div class="modal-header border-0 bg-primary text-white">
            <h5 class="fw-bold mb-0">✏️ Edit Item</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4">
            <input type="text" id="itemNama" class="form-control form-control-lg rounded-3" placeholder="Nama item / tugas">
          </div>
          <div class="modal-footer border-0 pb-4 px-4">
            <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-primary rounded-pill px-4" onclick="saveItem()">Simpan Perubahan</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  let modal = document.getElementById('itemModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('itemModal');
  }
  
  const loadItemData = async () => {
    const snapshot = await get(ref(db, `data/catatan/${currentUser}/items/${kategoriId}/${itemId}`));
    const data = snapshot.val();
    if (data) {
      document.getElementById('itemNama').value = data.nama || '';
    }
  };
  loadItemData();
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

window.saveItem = async function() {
  const nama = document.getElementById('itemNama').value;
  
  if (!nama) {
    showNotif("Nama item harus diisi", true, 'error');
    return;
  }
  
  if (editItemId) {
    await update(ref(db, `data/catatan/${currentUser}/items/${editItemParentId}/${editItemId}`), { nama });
    showNotif("Item berhasil diupdate", false, 'success');
    editItemId = null;
  } else {
    await push(ref(db, `data/catatan/${currentUser}/items/${editItemParentId}`), { nama, selesai: false });
    showNotif("Item berhasil ditambahkan", false, 'success');
  }
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('itemModal'));
  if (modal) modal.hide();
};

window.deleteItem = async function(kategoriId, itemId) {
  if (confirm("Yakin ingin menghapus item ini?")) {
    await remove(ref(db, `data/catatan/${currentUser}/items/${kategoriId}/${itemId}`));
    showNotif("Item dihapus", false, 'warning');
  }
};

window.initCatatan = initCatatan;
