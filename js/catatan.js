// js/catatan.js
import { db, ref, push, onValue, remove, update, get } from './firebase-config.js';
import { showNotif, escapeHtml } from './utils.js';

let currentUser = null;
let kategoriList = [];
let checklistItems = {};

const defaultKategori = [
  { nama: "📋 Dokumen", icon: "bi-files", items: [
    "KTP (scan dan asli)", "KK (scan dan asli)", "Akta Kelahiran", "Ijazah", "Paspor", "Surat Keterangan Belum Menikah"
  ]},
  { nama: "🏛️ Venue & Dekorasi", icon: "bi-building", items: [
    "Booking venue", "Dekorasi pelaminan", "Dekorasi reception", "Tempat akad", "Backdrop foto"
  ]},
  { nama: "👗 Busana & Makeup", icon: "bi-person-standing", items: [
    "Baju akad pria", "Baju akad wanita", "Baju resepsi pria", "Baju resepsi wanita", "MUA akad", "MUA resepsi"
  ]},
  { nama: "💍 Perlengkapan", icon: "bi-diamond", items: [
    "Cincin kawin", "Seserahan", "Mahar", "Kado pernikahan", "Souvenir"
  ]},
  { nama: "📸 Dokumentasi", icon: "bi-camera", items: [
    "Pre-wedding", "Foto akad", "Foto resepsi", "Album pernikahan", "Video highlight"
  ]},
  { nama: "🍽️ Konsumsi", icon: "bi-cup-straw", items: [
    "Catering", "Snack akad", "Menu resepsi", "Kue pernikahan", "Air mineral"
  ]},
  { nama: "🎵 Hiburan", icon: "bi-music-note", items: [
    "MC", "Band / Musik", "Sound system", "Lighting", "Fotobooth"
  ]},
  { nama: "📝 Undangan", icon: "bi-envelope", items: [
    "Desain undangan", "Cetak undangan", "Distribusi undangan", "RSVP tamu"
  ]}
];

export async function initCatatan() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  await loadKategori();
  renderKategori();
}

async function loadKategori() {
  const snapshot = await get(ref(db, `data/catatan/${currentUser}/kategori`));
  const saved = snapshot.val();
  
  if (saved && Object.keys(saved).length > 0) {
    kategoriList = Object.entries(saved).map(([id, val]) => ({ id, ...val }));
  } else {
    // Initialize default kategori
    for (const kat of defaultKategori) {
      const newRef = push(ref(db, `data/catatan/${currentUser}/kategori`));
      const kategoriId = newRef.key;
      await update(ref(db, `data/catatan/${currentUser}/kategori/${kategoriId}`), { nama: kat.nama, icon: kat.icon });
      
      for (const item of kat.items) {
        const itemRef = push(ref(db, `data/catatan/${currentUser}/items/${kategoriId}`));
        await update(ref(db, `data/catatan/${currentUser}/items/${kategoriId}/${itemRef.key}`), { nama: item, selesai: false });
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
    Object.values(katItems).forEach(item => {
      total++;
      if (item.selesai) selesai++;
    });
  });
  
  const percent = total > 0 ? (selesai / total) * 100 : 0;
  document.getElementById('progressPercent').innerHTML = `${Math.round(percent)}%`;
  document.getElementById('catatanProgress').style.width = `${percent}%`;
}

function renderKategori() {
  const container = document.getElementById('kategoriContainer');
  if (!container) return;
  
  if (kategoriList.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4">Belum ada kategori. Klik tombol Kategori untuk menambah.</div>';
    return;
  }
  
  container.innerHTML = kategoriList.map((kat, idx) => {
    const items = checklistItems[kat.id] ? Object.entries(checklistItems[kat.id]) : [];
    const completedCount = items.filter(([_, item]) => item.selesai).length;
    
    return `
      <div class="accordion-item border-0 mb-2">
        <div class="accordion-header">
          <button class="accordion-button collapsed bg-light rounded-3" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${idx}">
            <i class="bi ${kat.icon} me-2"></i>
            <span class="fw-bold">${escapeHtml(kat.nama)}</span>
            <span class="badge bg-secondary ms-2">${completedCount}/${items.length}</span>
          </button>
        </div>
        <div id="collapse${idx}" class="accordion-collapse collapse" data-bs-parent="#catatanAccordion">
          <div class="accordion-body p-0">
            ${items.map(([itemId, item]) => `
              <div class="checklist-item">
                <input type="checkbox" class="form-check-input" id="item_${itemId}" ${item.selesai ? 'checked' : ''} onchange="toggleItem('${kat.id}', '${itemId}', this.checked)">
                <label class="checklist-label" for="item_${itemId}">${escapeHtml(item.nama)}</label>
                <button class="btn-icon" onclick="deleteItem('${kat.id}', '${itemId}')">
                  <i class="bi bi-trash3"></i>
                </button>
              </div>
            `).join('')}
            <div class="p-2">
              <button class="btn btn-sm btn-link text-primary" onclick="addItemToKategori('${kat.id}')">
                <i class="bi bi-plus-lg"></i> Tambah item
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.openKategoriModal = function() {
  const modalHtml = `
    <div class="modal fade" id="kategoriModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0">
            <h5 class="fw-bold">Tambah Kategori</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body modal-form">
            <div class="mb-3">
              <label>Nama Kategori</label>
              <input type="text" id="kategoriNama" class="form-control" placeholder="Contoh: Dokumentasi">
            </div>
            <div class="mb-3">
              <label>Icon</label>
              <select id="kategoriIcon" class="form-select">
                <option value="bi-files">📋 Dokumen</option>
                <option value="bi-building">🏛️ Venue</option>
                <option value="bi-person-standing">👗 Busana</option>
                <option value="bi-diamond">💍 Perlengkapan</option>
                <option value="bi-camera">📸 Dokumentasi</option>
                <option value="bi-cup-straw">🍽️ Konsumsi</option>
                <option value="bi-music-note">🎵 Hiburan</option>
                <option value="bi-envelope">📝 Undangan</option>
              </select>
            </div>
          </div>
          <div class="modal-footer border-0">
            <button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-warning rounded-pill" onclick="saveKategori()">Simpan</button>
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
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

window.saveKategori = async function() {
  const nama = document.getElementById('kategoriNama').value;
  const icon = document.getElementById('kategoriIcon').value;
  
  if (!nama) {
    showNotif("Nama kategori harus diisi", true, 'error');
    return;
  }
  
  const currentUser = sessionStorage.getItem("progrowth_user");
  await push(ref(db, `data/catatan/${currentUser}/kategori`), { nama, icon });
  
  showNotif("Kategori berhasil ditambahkan", false, 'success');
  const modal = bootstrap.Modal.getInstance(document.getElementById('kategoriModal'));
  if (modal) modal.hide();
};

window.toggleItem = async function(kategoriId, itemId, selesai) {
  const currentUser = sessionStorage.getItem("progrowth_user");
  await update(ref(db, `data/catatan/${currentUser}/items/${kategoriId}/${itemId}`), { selesai });
};

window.addItemToKategori = function(kategoriId) {
  const modalHtml = `
    <div class="modal fade" id="itemModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0">
            <h5 class="fw-bold">Tambah Item</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <input type="text" id="itemNama" class="form-control" placeholder="Nama item">
          </div>
          <div class="modal-footer border-0">
            <button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-primary rounded-pill" onclick="saveItem('${kategoriId}')">Simpan</button>
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

window.saveItem = async function(kategoriId) {
  const nama = document.getElementById('itemNama').value;
  if (!nama) {
    showNotif("Nama item harus diisi", true, 'error');
    return;
  }
  
  const currentUser = sessionStorage.getItem("progrowth_user");
  await push(ref(db, `data/catatan/${currentUser}/items/${kategoriId}`), { nama, selesai: false });
  
  showNotif("Item berhasil ditambahkan", false, 'success');
  const modal = bootstrap.Modal.getInstance(document.getElementById('itemModal'));
  if (modal) modal.hide();
};

window.deleteItem = async function(kategoriId, itemId) {
  const currentUser = sessionStorage.getItem("progrowth_user");
  await remove(ref(db, `data/catatan/${currentUser}/items/${kategoriId}/${itemId}`));
  showNotif("Item dihapus", false, 'warning');
};

window.initCatatan = initCatatan;
