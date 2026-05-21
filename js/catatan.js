// js/catatan.js - Versi lengkap dengan Search & Export (Tombol Langsung, Tanpa Dropdown)
import { db, ref, push, onValue, remove, update, get, set } from './firebase-config.js';
import { 
  showNotif, escapeHtml, showCustomPrompt, showCustomConfirm, 
  getCache, setCache, clearCache, throttle, showLoading, hideLoading,
  triggerConfetti
} from './utils.js';

let currentUser = null;
let kategoriList = [];
let checklistItems = {};
let editKategoriId = null;
let editItemParentId = null;
let editItemId = null;
let isGeneratingAI = false;
let isInitialized = false;

// Wedding Templates
const weddingTemplates = {
  basic: {
    name: "Paket Basic (Minimalis)",
    categories: [
      { nama: "Administrasi & Dokumen", icon: "bi-files", estimasiBiaya: 1500000, items: ["KTP & KK (scan & asli)", "Akta Kelahiran", "Ijazah terakhir", "Surat kesehatan pranikah", "Pengesahan KUA"] },
      { nama: "Venue & Dekorasi", icon: "bi-building", estimasiBiaya: 15000000, items: ["Booking venue akad", "Booking venue resepsi", "Dekorasi pelaminan sederhana", "Backdrop foto"] },
      { nama: "Busana & Makeup", icon: "bi-person-standing", estimasiBiaya: 5000000, items: ["Baju akad pria (sewa)", "Baju akad wanita (sewa)", "MUA untuk akad & resepsi", "Aksesoris"] },
      { nama: "Dokumentasi", icon: "bi-camera", estimasiBiaya: 3500000, items: ["Fotografer 4 jam", "Videografer 4 jam", "Foto pre-wedding simple"] },
      { nama: "Konsumsi", icon: "bi-cup-straw", estimasiBiaya: 10000000, items: ["Catering untuk 100 tamu", "Air mineral", "Snack box"] },
      { nama: "Undangan", icon: "bi-envelope", estimasiBiaya: 1500000, items: ["Desain undangan digital", "Cetak undangan 100 pcs", "Amplop & materai"] }
    ]
  },
  premium: {
    name: "Paket Premium (Lengkap)",
    categories: [
      { nama: "Administrasi & Dokumen", icon: "bi-files", estimasiBiaya: 3000000, items: ["Semua dokumen + legalisasi", "Konsultasi pernikahan", "Asuransi pernikahan"] },
      { nama: "Venue & Dekorasi", icon: "bi-building", estimasiBiaya: 35000000, items: ["Hotel bintang 4", "Dekorasi mewah dengan bunga segar", "Sound system & lighting", "Karpet merah", "Photo booth"] },
      { nama: "Busana & Makeup", icon: "bi-person-standing", estimasiBiaya: 15000000, items: ["Baju akad custom", "Baju resepsi 2 model", "MUA profesional 3 sesi", "Makeup trial", "Rias keluarga"] },
      { nama: "Dokumentasi", icon: "bi-camera", estimasiBiaya: 12000000, items: ["Fotografer full day", "Videografer full day + drone", "Album cetak mewah", "Pre-wedding outdoor 2 lokasi"] },
      { nama: "Konsumsi", icon: "bi-cup-straw", estimasiBiaya: 30000000, items: ["Catering untuk 300 tamu", "Live cooking station", "Kue pernikahan 3 tingkat", "Welcome drink", "Floating market"] },
      { nama: "Undangan", icon: "bi-envelope", estimasiBiaya: 5000000, items: ["Desain eksklusif", "Cetak undangan premium 200 pcs", "Undangan digital interaktif", "Souvenir undangan"] },
      { nama: "Hiburan", icon: "bi-music-note", estimasiBiaya: 8000000, items: ["Live band atau DJ", "MC profesional", "Karaoke", "Games & Doorprize"] },
      { nama: "Penginapan & Transport", icon: "bi-truck", estimasiBiaya: 10000000, items: ["Hotel untuk keluarga", "Sewa mobil hias", "Transport antar jemput tamu"] }
    ]
  },
  destination: {
    name: "Paket Destination Wedding",
    categories: [
      { nama: "Dokumen & Perizinan", icon: "bi-files", estimasiBiaya: 5000000, items: ["Paspor", "Visa (jika luar negeri)", "Surat pindah nikah", "Dokumen resmi negara tujuan"] },
      { nama: "Venue & Akomodasi", icon: "bi-building", estimasiBiaya: 50000000, items: ["Resort/villa eksklusif", "Dekorasi beach/outdoor", "Akomodasi tamu (3 hari 2 malam)"] },
      { nama: "Transportasi", icon: "bi-truck", estimasiBiaya: 20000000, items: ["Tiket pesawat untuk 10 orang", "Sewa mobil di lokasi", "Transfer bandara"] },
      { nama: "Dokumentasi", icon: "bi-camera", estimasiBiaya: 15000000, items: ["Fotografer & videografer full coverage", "Pre-wedding di lokasi destination", "Album & video cinematic"] },
      { nama: "Konsumsi", icon: "bi-cup-straw", estimasiBiaya: 25000000, items: ["Catering untuk 50 tamu", "Welcome dinner", "Wedding cake"] }
    ]
  }
};

const throttledRender = throttle(() => {
  renderKategori();
  updateProgress();
}, 300);

// ============ SEARCH FUNCTIONS ============
function initSearchCatatan() {
  const searchInput = document.getElementById('searchCatatan');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      const searchTerm = e.target.value.toLowerCase();
      filterKategoriBySearch(searchTerm);
    });
  }
}

function filterKategoriBySearch(searchTerm) {
  const container = document.getElementById('kategoriContainer');
  if (!container) return;
  
  const cards = container.querySelectorAll('.card');
  cards.forEach(card => {
    const text = card.innerText.toLowerCase();
    if (searchTerm === '' || text.includes(searchTerm)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// ============ EXPORT FUNCTIONS ============
window.exportCatatanToCSV = function() {
  const headers = ['Kategori', 'Item', 'Status', 'Estimasi Biaya'];
  const rows = [];
  
  kategoriList.forEach(kat => {
    const items = checklistItems[kat.id] ? Object.values(checklistItems[kat.id]) : [];
    items.forEach(item => {
      if (item) {
        rows.push([
          `"${kat.nama}"`,
          `"${item.nama}"`,
          item.selesai ? 'Selesai' : 'Belum',
          kat.estimasiBiaya || 0
        ]);
      }
    });
  });
  
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute('download', `catatan_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showNotif(`✅ Laporan catatan berhasil diexport! (${rows.length} item)`, false, 'success');
};

// ============ CORE FUNCTIONS ============
export async function initCatatan() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  if (isInitialized) {
    refreshData();
    return;
  }
  
  showLoading("Memuat catatan persiapan...");
  isInitialized = true;
  
  try {
    await Promise.all([
      loadKategoriOptimized(),
      loadChecklistItemsOptimized()
    ]);
    
    renderKategori();
    updateProgress();
    generateAIRecommendations();
    initSearchCatatan();
    
    const throttledUpdate = throttle(() => {
      updateProgress();
      renderKategori();
      generateAIRecommendations();
    }, 1000);
    
    onValue(ref(db, `data/catatan/bersama/items`), (snapshot) => {
      checklistItems = snapshot.val() || {};
      setCache(`catatan_items_bersama`, checklistItems, 3);
      throttledUpdate();
    });
    
    onValue(ref(db, `data/catatan/bersama/kategori`), () => {
      clearCache(`catatan_kategori_bersama`);
      loadKategoriOptimized(true).then(() => throttledUpdate());
    });
    
  } catch (err) {
    console.error("Error init catatan:", err);
    showNotif("Gagal memuat catatan", true, 'error');
  } finally {
    hideLoading();
  }
}

async function refreshData() {
  showLoading("Memperbarui data...");
  try {
    await Promise.all([
      loadKategoriOptimized(true),
      loadChecklistItemsOptimized(true)
    ]);
    renderKategori();
    updateProgress();
    generateAIRecommendations();
  } catch (err) {
    console.error("Error refreshing catatan:", err);
  } finally {
    hideLoading();
  }
}

async function loadKategoriOptimized(forceRefresh = false) {
  const cacheKey = `catatan_kategori_bersama`;
  if (!forceRefresh) {
    const cached = getCache(cacheKey);
    if (cached) {
      kategoriList = cached;
      return;
    }
  }
  
  const snapshot = await get(ref(db, `data/catatan/bersama/kategori`));
  const saved = snapshot.val();
  
  if (saved && Object.keys(saved).length > 0) {
    kategoriList = Object.entries(saved).map(([id, val]) => ({ id, ...val }));
  } else {
    kategoriList = [];
  }
  
  setCache(cacheKey, kategoriList, 10);
}

async function loadChecklistItemsOptimized(forceRefresh = false) {
  const cacheKey = `catatan_items_bersama`;
  if (!forceRefresh) {
    const cached = getCache(cacheKey);
    if (cached) {
      checklistItems = cached;
      return;
    }
  }
  
  const snapshot = await get(ref(db, `data/catatan/bersama/items`));
  checklistItems = snapshot.val() || {};
  setCache(cacheKey, checklistItems, 5);
}

function updateProgress() {
  let total = 0;
  let selesai = 0;
  let totalEstimasiBiaya = 0;
  
  kategoriList.forEach(kat => {
    const katItems = checklistItems[kat.id] ? Object.values(checklistItems[kat.id]) : [];
    const validItems = katItems.filter(item => item !== null);
    const completedItems = validItems.filter(item => item.selesai);
    total += validItems.length;
    selesai += completedItems.length;
    totalEstimasiBiaya += kat.estimasiBiaya || 0;
  });
  
  const percent = total > 0 ? (selesai / total) * 100 : 0;
  const progressPercentEl = document.getElementById('progressPercent');
  const catatanProgressEl = document.getElementById('catatanProgress');
  const estimasiBiayaEl = document.getElementById('estimasiBiaya');
  
  if (progressPercentEl) progressPercentEl.innerHTML = `${Math.round(percent)}%`;
  if (catatanProgressEl) catatanProgressEl.style.width = `${percent}%`;
  if (estimasiBiayaEl && totalEstimasiBiaya > 0) {
    estimasiBiayaEl.innerHTML = `💰 Estimasi Total: Rp ${totalEstimasiBiaya.toLocaleString('id-ID')}`;
  }
}

// ============ RENDER KATEGORI DENGAN TOMBOL LANGSUNG (TANPA DROPDOWN) ============
function renderKategori() {
  const container = document.getElementById('kategoriContainer');
  if (!container) return;
  
  if (!kategoriList || kategoriList.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi bi-folder2-open fs-1"></i>
        <p class="mt-2">Belum ada kategori persiapan pernikahan.</p>
        <p class="small">Klik salah satu template di bawah untuk memulai:</p>
        <div class="d-flex gap-2 justify-content-center mt-3 flex-wrap">
          <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="window.generateWeddingPlanning('basic')">
            <i class="bi bi-stars me-1"></i> Basic Plan
          </button>
          <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="window.generateWeddingPlanning('premium')">
            <i class="bi bi-diamond me-1"></i> Premium Plan
          </button>
          <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="window.generateWeddingPlanning('destination')">
            <i class="bi bi-globe me-1"></i> Destination
          </button>
        </div>
      </div>
    `;
    return;
  }
  
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  
  kategoriList.forEach((kat, idx) => {
    const items = checklistItems[kat.id] ? Object.entries(checklistItems[kat.id]) : [];
    const validItems = items.filter(([_, item]) => item !== null);
    const completedCount = validItems.filter(([_, item]) => item.selesai).length;
    const percentItem = validItems.length > 0 ? (completedCount / validItems.length) * 100 : 0;
    
    // MENGGUNAKAN TOMBOL LANGSUNG, BUKAN DROPDOWN
    tempDiv.innerHTML = `
      <div class="card mb-3 border-0 shadow-sm" data-kategori-id="${kat.id}">
        <div class="card-header bg-transparent border-0 d-flex justify-content-between align-items-center p-3 flex-wrap gap-2">
          <div class="d-flex align-items-center gap-2" style="cursor: pointer;" data-bs-toggle="collapse" data-bs-target="#collapse${idx}">
            <i class="bi ${kat.icon} fs-4 text-primary"></i>
            <div>
              <h6 class="fw-bold mb-0">${escapeHtml(kat.nama)}</h6>
              ${kat.estimasiBiaya ? `<small class="text-muted">💰 Target: Rp ${kat.estimasiBiaya.toLocaleString('id-ID')}</small>` : ''}
            </div>
            <span class="badge bg-secondary rounded-pill">${completedCount}/${validItems.length}</span>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="window.editKategori('${kat.id}')">
              <i class="bi bi-pencil me-1"></i> Edit
            </button>
            <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="window.deleteKategori('${kat.id}')">
              <i class="bi bi-trash3 me-1"></i> Hapus
            </button>
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
                  <input type="checkbox" class="form-check-input fs-5" id="item_${itemId}" ${item.selesai ? 'checked' : ''} onchange="window.toggleItem('${kat.id}', '${itemId}', this.checked)">
                  <label class="checklist-label mb-0 ${item.selesai ? 'text-decoration-line-through text-muted' : ''}" for="item_${itemId}">${escapeHtml(item.nama)}</label>
                </div>
                <div class="d-flex gap-1">
                  <button class="btn btn-sm btn-outline-secondary rounded-pill" onclick="window.editItem('${kat.id}', '${itemId}')">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="window.deleteItem('${kat.id}', '${itemId}')">
                    <i class="bi bi-trash3"></i>
                  </button>
                </div>
              </div>
            `).join('')}
            <div class="p-3 text-center">
              <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="window.addItemToKategori('${kat.id}')">
                <i class="bi bi-plus-lg me-1"></i> Tambah Item
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }
  });
  
  container.innerHTML = '';
  container.appendChild(fragment);
}

// ============ GENERATE WEDDING PLANNING ============
window.generateWeddingPlanning = async function(templateId = 'basic') {
  const template = weddingTemplates[templateId];
  if (!template) {
    showNotif("Template tidak ditemukan", true, 'error');
    return;
  }
  
  const confirmed = await showCustomConfirm(
    "Generate Planning Wedding", 
    `Yakin ingin menggunakan template "${template.name}"? Data catatan yang ada akan DIGANTI SEPENUHNYA.`
  );
  
  if (!confirmed) return;
  
  showLoading("Membuat planning wedding...");
  
  try {
    await remove(ref(db, `data/catatan/bersama`));
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let totalEstimasi = 0;
    
    for (const kat of template.categories) {
      const kategoriRef = push(ref(db, `data/catatan/bersama/kategori`));
      await set(kategoriRef, {
        nama: kat.nama,
        icon: kat.icon,
        estimasiBiaya: kat.estimasiBiaya
      });
      
      const kategoriId = kategoriRef.key;
      totalEstimasi += kat.estimasiBiaya;
      
      for (const item of kat.items) {
        const itemRef = push(ref(db, `data/catatan/bersama/items/${kategoriId}`));
        await set(itemRef, {
          nama: item,
          selesai: false
        });
      }
    }
    
    clearCache(`catatan_kategori_bersama`);
    clearCache(`catatan_items_bersama`);
    
    await loadKategoriOptimized(true);
    await loadChecklistItemsOptimized(true);
    
    renderKategori();
    updateProgress();
    generateAIRecommendations();
    
    showNotif(`✅ Template "${template.name}" berhasil! Total estimasi: Rp ${totalEstimasi.toLocaleString('id-ID')}`, false, 'success');
    
    if (typeof triggerConfetti === 'function') triggerConfetti();
    
  } catch (err) {
    console.error(err);
    showNotif("❌ Gagal membuat planning", true, 'error');
  } finally {
    hideLoading();
  }
};

// ============ AI RECOMMENDATIONS ============
async function generateAIRecommendations() {
  if (isGeneratingAI) return;
  isGeneratingAI = true;
  
  const container = document.getElementById('aiRecommendations');
  if (!container) {
    isGeneratingAI = false;
    return;
  }
  
  let total = 0;
  let selesai = 0;
  let totalEstimasi = 0;
  
  kategoriList.forEach(kat => {
    const katItems = checklistItems[kat.id] ? Object.values(checklistItems[kat.id]) : [];
    const validItems = katItems.filter(item => item !== null);
    const completedItems = validItems.filter(item => item.selesai);
    total += validItems.length;
    selesai += completedItems.length;
    totalEstimasi += kat.estimasiBiaya || 0;
  });
  
  const percent = total > 0 ? (selesai / total) * 100 : 0;
  
  container.innerHTML = `
    <div class="card p-3 mb-4" style="background: linear-gradient(135deg, #667eea15, #764ba215); border-radius: 16px;">
      <div class="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-magic fs-5 text-purple"></i>
          <span class="fw-bold small">✨ AI Planning Assistant</span>
        </div>
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-primary rounded-pill" onclick="window.generateWeddingPlanning('basic')" style="font-size: 11px;">
            <i class="bi bi-stars me-1"></i> Basic Plan
          </button>
          <button class="btn btn-outline-primary rounded-pill" onclick="window.generateWeddingPlanning('premium')" style="font-size: 11px;">
            <i class="bi bi-diamond me-1"></i> Premium Plan
          </button>
          <button class="btn btn-outline-primary rounded-pill" onclick="window.generateWeddingPlanning('destination')" style="font-size: 11px;">
            <i class="bi bi-globe me-1"></i> Destination
          </button>
        </div>
      </div>
      
      <div class="progress mb-2" style="height: 6px;">
        <div class="progress-bar bg-success" style="width: ${percent}%"></div>
      </div>
      
      <div class="d-flex justify-content-between small text-muted mb-3">
        <span>Progress: ${Math.round(percent)}%</span>
        <span>Estimasi Total: Rp ${totalEstimasi.toLocaleString('id-ID')}</span>
      </div>
      
      ${kategoriList.length === 0 ? `
        <div class="alert alert-info alert-sm py-2 mb-0">
          <i class="bi bi-info-circle me-1"></i>
          Belum ada checklist. Klik salah satu template di atas untuk memulai planning pernikahan Anda!
        </div>
      ` : ''}
    </div>
  `;
  
  isGeneratingAI = false;
}

// ============ TOGGLE ITEM ============
window.toggleItem = async function(kategoriId, itemId, selesai) {
  await update(ref(db, `data/catatan/bersama/items/${kategoriId}/${itemId}`), { selesai });
  clearCache(`catatan_items_bersama`);
  updateProgress();
};

// ============ PERBAIKAN: DELETE ITEM (LENGKAP) ============
window.deleteItem = async function(kategoriId, itemId) {
  console.log("deleteItem called with kategoriId:", kategoriId, "itemId:", itemId);
  
  if (!kategoriId || !itemId) {
    showNotif("ID tidak valid", true, 'error');
    return;
  }
  
  // Cari nama item untuk ditampilkan di konfirmasi
  let itemName = "Item ini";
  if (checklistItems[kategoriId] && checklistItems[kategoriId][itemId]) {
    itemName = checklistItems[kategoriId][itemId].nama || "Item ini";
  }
  
  const confirmed = await showCustomConfirm("Hapus Item", `Yakin ingin menghapus item "${itemName}"?`);
  
  if (!confirmed) return;
  
  showLoading("Menghapus item...");
  
  try {
    await remove(ref(db, `data/catatan/bersama/items/${kategoriId}/${itemId}`));
    console.log("Item removed from Firebase");
    
    clearCache(`catatan_items_bersama`);
    await loadChecklistItemsOptimized(true);
    
    renderKategori();
    updateProgress();
    generateAIRecommendations();
    
    showNotif(`✅ Item "${itemName}" berhasil dihapus`, false, 'warning');
    
  } catch (err) {
    console.error("Error deleting item:", err);
    showNotif("❌ Gagal menghapus item", true, 'error');
  } finally {
    hideLoading();
  }
};

// ============ PERBAIKAN: DELETE KATEGORI (LENGKAP) ============
window.deleteKategori = async function(id) {
  console.log("deleteKategori called with id:", id);
  
  if (!id) {
    showNotif("ID Kategori tidak valid", true, 'error');
    return;
  }
  
  // Cari nama kategori untuk ditampilkan di konfirmasi
  const kategori = kategoriList.find(k => k.id === id);
  const kategoriName = kategori ? kategori.nama : 'Kategori ini';
  
  const confirmed = await showCustomConfirm(
    "Hapus Kategori", 
    `Yakin ingin menghapus kategori "${kategoriName}"? Semua item di dalamnya juga akan terhapus secara permanen.`
  );
  
  if (!confirmed) return;
  
  showLoading("Menghapus kategori...");
  
  try {
    // Hapus data kategori dari Firebase
    await remove(ref(db, `data/catatan/bersama/kategori/${id}`));
    console.log("Kategori removed from Firebase");
    
    // Hapus semua items dalam kategori tersebut
    await remove(ref(db, `data/catatan/bersama/items/${id}`));
    console.log("Items removed from Firebase");
    
    // Clear semua cache terkait catatan
    clearCache(`catatan_kategori_bersama`);
    clearCache(`catatan_items_bersama`);
    
    // Refresh data dari Firebase
    await loadKategoriOptimized(true);
    await loadChecklistItemsOptimized(true);
    
    // Render ulang UI
    renderKategori();
    updateProgress();
    generateAIRecommendations();
    
    showNotif(`✅ Kategori "${kategoriName}" berhasil dihapus`, false, 'success');
    
  } catch (err) {
    console.error("Error deleting kategori:", err);
    showNotif("❌ Gagal menghapus kategori: " + (err.message || "Unknown error"), true, 'error');
  } finally {
    hideLoading();
  }
};

// ============ EDIT KATEGORI ============
window.editKategori = function(id) {
  openKategoriModal(id);
};

// ============ MODAL KATEGORI ============
window.openKategoriModal = function(editId = null) {
  editKategoriId = editId;
  
  let modal = document.getElementById('kategoriModal');
  if (modal) {
    if (editId) loadKategoriData(editId);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    return;
  }
  
  const modalHtml = `
    <div class="modal fade" id="kategoriModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0 bg-warning text-dark py-3">
            <h5 class="fw-bold mb-0">${editId ? '✏️ Edit Kategori' : '📁 Tambah Kategori'}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body modal-form p-4">
            <div class="mb-3">
              <label class="fw-semibold mb-2">Nama Kategori</label>
              <input type="text" id="kategoriNama" class="form-control form-control-lg rounded-3">
            </div>
            <div class="mb-3">
              <label class="fw-semibold mb-2">Icon</label>
              <select id="kategoriIcon" class="form-select form-select-lg rounded-3">
                <option value="bi-files">📋 Dokumen</option>
                <option value="bi-building">🏛️ Venue</option>
                <option value="bi-person-standing">👗 Busana</option>
                <option value="bi-camera">📸 Dokumentasi</option>
                <option value="bi-cup-straw">🍽️ Konsumsi</option>
                <option value="bi-envelope">✉️ Undangan</option>
                <option value="bi-music-note">🎵 Hiburan</option>
                <option value="bi-truck">🚗 Transportasi</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="fw-semibold mb-2">Estimasi Biaya (Rp)</label>
              <input type="number" id="kategoriEstimasi" class="form-control form-control-lg rounded-3">
              <small class="text-muted">Target tabungan untuk kategori ini</small>
            </div>
          </div>
          <div class="modal-footer border-0 pb-4 px-4">
            <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-warning rounded-pill px-4" onclick="window.saveKategori()">Simpan</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  modal = document.getElementById('kategoriModal');
  
  if (editId) loadKategoriData(editId);
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

async function loadKategoriData(id) {
  const snapshot = await get(ref(db, `data/catatan/bersama/kategori/${id}`));
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
  
  showLoading("Menyimpan kategori...");
  try {
    if (editKategoriId) {
      await update(ref(db, `data/catatan/bersama/kategori/${editKategoriId}`), { nama, icon, estimasiBiaya });
      showNotif("Kategori berhasil diupdate", false, 'success');
      editKategoriId = null;
    } else {
      await push(ref(db, `data/catatan/bersama/kategori`), { nama, icon, estimasiBiaya });
      showNotif("Kategori berhasil ditambahkan", false, 'success');
    }
    
    clearCache(`catatan_kategori_bersama`);
    await loadKategoriOptimized(true);
    renderKategori();
    generateAIRecommendations();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('kategoriModal'));
    if (modal) modal.hide();
  } catch (err) {
    console.error(err);
    showNotif("Gagal menyimpan", true, 'error');
  } finally {
    hideLoading();
  }
};

// ============ TAMBAH ITEM KE KATEGORI ============
window.addItemToKategori = function(kategoriId) {
  editItemParentId = kategoriId;
  editItemId = null;
  
  let modal = document.getElementById('itemModal');
  if (modal) {
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    return;
  }
  
  const modalHtml = `
    <div class="modal fade" id="itemModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0 bg-primary text-white">
            <h5 class="fw-bold mb-0">📝 Tambah Item</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4">
            <input type="text" id="itemNama" class="form-control form-control-lg rounded-3" placeholder="Nama item">
          </div>
          <div class="modal-footer border-0 pb-4 px-4">
            <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-primary rounded-pill px-4" onclick="window.saveItem()">Simpan</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  modal = document.getElementById('itemModal');
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

// ============ EDIT ITEM ============
window.editItem = function(kategoriId, itemId) {
  editItemParentId = kategoriId;
  editItemId = itemId;
  
  let modal = document.getElementById('itemModal');
  if (!modal) {
    const modalHtml = `
      <div class="modal fade" id="itemModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-md">
          <div class="modal-content rounded-4">
            <div class="modal-header border-0 bg-primary text-white">
              <h5 class="fw-bold mb-0">✏️ Edit Item</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
              <input type="text" id="itemNama" class="form-control form-control-lg rounded-3" placeholder="Nama item">
            </div>
            <div class="modal-footer border-0 pb-4 px-4">
              <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
              <button class="btn btn-primary rounded-pill px-4" onclick="window.saveItem()">Simpan</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('itemModal');
  }
  
  const loadItemData = async () => {
    const snapshot = await get(ref(db, `data/catatan/bersama/items/${kategoriId}/${itemId}`));
    const data = snapshot.val();
    if (data) {
      document.getElementById('itemNama').value = data.nama || '';
    }
  };
  loadItemData();
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

// ============ SAVE ITEM ============
window.saveItem = async function() {
  const nama = document.getElementById('itemNama').value;
  
  if (!nama) {
    showNotif("Nama item harus diisi", true, 'error');
    return;
  }
  
  showLoading("Menyimpan item...");
  try {
    if (editItemId) {
      await update(ref(db, `data/catatan/bersama/items/${editItemParentId}/${editItemId}`), { nama });
      showNotif("Item berhasil diupdate", false, 'success');
      editItemId = null;
    } else {
      await push(ref(db, `data/catatan/bersama/items/${editItemParentId}`), { nama, selesai: false });
      showNotif("Item berhasil ditambahkan", false, 'success');
    }
    
    clearCache(`catatan_items_bersama`);
    await loadChecklistItemsOptimized(true);
    renderKategori();
    updateProgress();
    generateAIRecommendations();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('itemModal'));
    if (modal) modal.hide();
  } catch (err) {
    console.error(err);
    showNotif("Gagal menyimpan", true, 'error');
  } finally {
    hideLoading();
  }
};

// ============ EXPORTS ============
window.initCatatan = initCatatan;
window.generateAIRecommendations = generateAIRecommendations;
