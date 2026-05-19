// js/catatan.js - Dengan Modal Besar
import { db, ref, push, onValue, remove, update, get, set } from './firebase-config.js';
import { showNotif, escapeHtml } from './utils.js';

let currentUser = null;
let kategoriList = [];
let checklistItems = {};
let editKategoriId = null;
let editItemParentId = null;
let editItemId = null;

const defaultKategori = [
  { nama: "📋 Dokumen Penting", icon: "bi-files", items: [
    "KTP (scan dan asli)", "KK (scan dan asli)", "Akta Kelahiran", "Ijazah terakhir", 
    "Paspor (jika ada)", "Surat Keterangan Belum Menikah", "Fotokopi buku nikah orang tua"
  ]},
  { nama: "🏛️ Venue & Dekorasi", icon: "bi-building", items: [
    "Survey venue", "Booking venue akad", "Booking venue resepsi", "Dekorasi pelaminan",
    "Dekorasi reception", "Tempat cuci muka pengantin", "Backdrop foto", "Sewa kursi & meja"
  ]},
  { nama: "👗 Busana & Makeup", icon: "bi-person-standing", items: [
    "Baju akad pria", "Baju akad wanita", "Baju resepsi pria (ganti)", "Baju resepsi wanita (ganti)",
    "Sewa aksesoris", "MUA untuk akad", "MUA untuk resepsi", "Makeup trial"
  ]},
  { nama: "💍 Perlengkapan", icon: "bi-diamond", items: [
    "Cincin kawin (2 pasang)", "Seserahan (lengkap)", "Mahar & mas kawin", "Kado pernikahan",
    "Souvenir tamu (minimal 2 item)", "Buket pengantin", "Hantaran"
  ]},
  { nama: "📸 Dokumentasi", icon: "bi-camera", items: [
    "Cari fotografer", "Booking pre-wedding", "Jadwal pre-wedding", "Cetak album pre-wedding",
    "Foto akad", "Foto resepsi", "Video documentary", "Video highlight"
  ]},
  { nama: "🍽️ Konsumsi", icon: "bi-cup-straw", items: [
    "Catering untuk tamu", "Snack untuk akad", "Menu utama resepsi", "Kue pernikahan (wedding cake)",
    "Air mineral & minuman", "Tempat cuci piring"
  ]},
  { nama: "🎵 Hiburan", icon: "bi-music-note", items: [
    "MC (Master of Ceremony)", "Band / Orgen tunggal", "Sewa sound system", "Sewa lighting",
    "Fotobooth / selfie booth", "Karaoke"
  ]},
  { nama: "📝 Undangan", icon: "bi-envelope", items: [
    "Desain undangan digital", "Desain undangan fisik", "Cetak undangan", 
    "Distribusi undangan", "RSVP tamu", "Papan ucapan"
  ]},
  { nama: "💰 Anggaran", icon: "bi-wallet2", items: [
    "Buat RAB (Rencana Anggaran Biaya)", "Alokasi dana per item", "Dana darurat 10%",
    "Cicilan DP venue", "Pelunasan H-7"
  ]},
  { nama: "👥 Tamu", icon: "bi-people", items: [
    "Buat daftar tamu", "Konfirmasi kehadiran", "Pembagian undangan", 
    "Peta lokasi venue", "Transportasi untuk tamu luar kota"
  ]}
];

export async function initCatatan() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  await loadKategori();
  renderKategori();
  updateProgress();
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
      await set(ref(db, `data/catatan/${currentUser}/kategori/${kategoriId}`), { nama: kat.nama, icon: kat.icon });
      
      for (const item of kat.items) {
        const itemRef = push(ref(db, `data/catatan/${currentUser}/items/${kategoriId}`));
        await set(ref(db, `data/catatan/${currentUser}/items/${kategoriId}/${itemRef.key}`), { nama: item, selesai: false });
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
  });
}

function updateProgress() {
  let total = 0;
  let selesai = 0;
  
  Object.values(checklistItems).forEach(katItems => {
    if (katItems) {
      Object.values(katItems).forEach(item => {
        if (item) {
          total++;
          if (item.selesai) selesai++;
        }
      });
    }
  });
  
  const percent = total > 0 ? (selesai / total) * 100 : 0;
  const progressPercentEl = document.getElementById('progressPercent');
  const catatanProgressEl = document.getElementById('catatanProgress');
  
  if (progressPercentEl) progressPercentEl.innerHTML = `${Math.round(percent)}%`;
  if (catatanProgressEl) catatanProgressEl.style.width = `${percent}%`;
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
      <div class="card mb-3 border-0 shadow-sm">
        <div class="card-header bg-transparent border-0 d-flex justify-content-between align-items-center p-3">
          <div class="d-flex align-items-center gap-2" style="cursor: pointer;" data-bs-toggle="collapse" data-bs-target="#collapse${idx}">
            <i class="bi ${kat.icon} fs-4 text-primary"></i>
            <h6 class="fw-bold mb-0">${escapeHtml(kat.nama)}</h6>
            <span class="badge bg-secondary rounded-pill">${completedCount}/${validItems.length}</span>
          </div>
          <div class="dropdown">
            <button class="btn-icon" data-bs-toggle="dropdown">
              <i class="bi bi-three-dots-vertical"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><a class="dropdown-item" onclick="editKategori('${kat.id}')"><i class="bi bi-pencil me-2"></i>Edit Kategori</a></li>
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
                <div class="d-flex align-items-center gap-3">
                  <input type="checkbox" class="form-check-input fs-5" id="item_${itemId}" ${item.selesai ? 'checked' : ''} onchange="toggleItem('${kat.id}', '${itemId}', this.checked)">
                  <label class="checklist-label mb-0 ${item.selesai ? 'text-decoration-line-through text-muted' : ''}" for="item_${itemId}">${escapeHtml(item.nama)}</label>
                </div>
                <div>
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
  }
}

window.saveKategori = async function() {
  const nama = document.getElementById('kategoriNama').value;
  const icon = document.getElementById('kategoriIcon').value;
  
  if (!nama) {
    showNotif("Nama kategori harus diisi", true, 'error');
    return;
  }
  
  if (editKategoriId) {
    await update(ref(db, `data/catatan/${currentUser}/kategori/${editKategoriId}`), { nama, icon });
    showNotif("Kategori berhasil diupdate", false, 'success');
    editKategoriId = null;
  } else {
    await push(ref(db, `data/catatan/${currentUser}/kategori`), { nama, icon });
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
  
  // Load existing data
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
