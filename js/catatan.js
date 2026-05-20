// js/catatan.js - Optimasi dengan Caching
import { db, ref, push, onValue, remove, update, get, set } from './firebase-config.js';
import { showNotif, escapeHtml, showCustomPrompt, showCustomConfirm, getCache, setCache, throttle, showLoading, hideLoading } from './utils.js';

let currentUser = null;
let kategoriList = [];
let checklistItems = {};
let editKategoriId = null;
let editItemParentId = null;
let editItemId = null;
let isGeneratingAI = false;
let isInitialized = false;

const defaultKategori = [
  { nama: "Dokumen Penting", icon: "bi-files", estimasiBiaya: 500000, items: ["KTP (scan dan asli)", "KK (scan dan asli)", "Akta Kelahiran", "Ijazah terakhir"] },
  { nama: "Venue & Dekorasi", icon: "bi-building", estimasiBiaya: 25000000, items: ["Survey venue", "Booking venue akad", "Dekorasi pelaminan", "Backdrop foto"] },
  { nama: "Busana & Makeup", icon: "bi-person-standing", estimasiBiaya: 5000000, items: ["Baju akad pria", "Baju akad wanita", "MUA untuk akad", "Makeup trial"] },
  { nama: "Dokumentasi", icon: "bi-camera", estimasiBiaya: 7000000, items: ["Cari fotografer", "Booking pre-wedding", "Foto akad", "Video documentary"] },
  { nama: "Konsumsi", icon: "bi-cup-straw", estimasiBiaya: 15000000, items: ["Catering untuk tamu", "Menu utama resepsi", "Kue pernikahan", "Air mineral"] }
];

// Throttled render
const throttledRender = throttle(() => {
  renderKategori();
  updateProgress();
}, 300);

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
    
    // Setup listener dengan throttle
    const throttledUpdate = throttle(() => {
      updateProgress();
      renderKategori();
      generateAIRecommendations();
    }, 1000);
    
    onValue(ref(db, `data/catatan/${currentUser}/items`), (snapshot) => {
      checklistItems = snapshot.val() || {};
      setCache(`catatan_items_${currentUser}`, checklistItems, 3);
      throttledUpdate();
    });
    
    onValue(ref(db, `data/catatan/${currentUser}/kategori`), () => {
      clearCache(`catatan_kategori_${currentUser}`);
      loadKategoriOptimized().then(() => throttledUpdate());
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
  const cacheKey = `catatan_kategori_${currentUser}`;
  if (!forceRefresh) {
    const cached = getCache(cacheKey);
    if (cached) {
      kategoriList = cached;
      return;
    }
  }
  
  const snapshot = await get(ref(db, `data/catatan/${currentUser}/kategori`));
  const saved = snapshot.val();
  
  if (saved && Object.keys(saved).length > 0) {
    kategoriList = Object.entries(saved).map(([id, val]) => ({ id, ...val }));
  } else {
    // Load default dengan batch write
    for (const kat of defaultKategori) {
      const newRef = push(ref(db, `data/catatan/${currentUser}/kategori`));
      const kategoriId = newRef.key;
      await set(ref(db, `data/catatan/${currentUser}/kategori/${kategoriId}`), { 
        nama: kat.nama, 
        icon: kat.icon,
        estimasiBiaya: kat.estimasiBiaya 
      });
      
      const updates = {};
      for (const item of kat.items) {
        const itemRef = push(ref(db, `data/catatan/${currentUser}/items/${kategoriId}`));
        updates[`data/catatan/${currentUser}/items/${kategoriId}/${itemRef.key}`] = { 
          nama: item, 
          selesai: false 
        };
      }
      await update(ref(db), updates);
    }
    await loadKategoriOptimized(true);
  }
  
  setCache(cacheKey, kategoriList, 10);
}

async function loadChecklistItemsOptimized(forceRefresh = false) {
  const cacheKey = `catatan_items_${currentUser}`;
  if (!forceRefresh) {
    const cached = getCache(cacheKey);
    if (cached) {
      checklistItems = cached;
      return;
    }
  }
  
  const snapshot = await get(ref(db, `data/catatan/${currentUser}/items`));
  checklistItems = snapshot.val() || {};
  setCache(cacheKey, checklistItems, 5);
}

async function updateProgressFromKeuangan() {
  const transaksiSnap = await get(ref(db, `data/keuangan/${currentUser}/transaksi`));
  const transaksi = transaksiSnap.val() || {};
  
  for (const [katId, items] of Object.entries(checklistItems)) {
    if (items) {
      for (const [itemId, item] of Object.entries(items)) {
        if (item && item.sourceId) {
          const hasTransaction = Object.values(transaksi).some(t => t.sourceId === `${katId}_${itemId}`);
          if (hasTransaction !== item.selesai) {
            await update(ref(db, `data/catatan/${currentUser}/items/${katId}/${itemId}`), { 
              selesai: hasTransaction,
              updatedFromKeuangan: true
            });
          }
        }
      }
    }
  }
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
    
    if (kat.estimasiBiaya && validItems.length > 0) {
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
  if (estimasiBiayaEl && totalEstimasiBiaya > 0) {
    estimasiBiayaEl.innerHTML = `💰 Estimasi Total: Rp ${totalEstimasiBiaya.toLocaleString('id-ID')} | Terpakai: Rp ${Math.round(estimasiTerselesaikan).toLocaleString('id-ID')}`;
  }
}

function renderKategori() {
  const container = document.getElementById('kategoriContainer');
  if (!container) return;
  
  if (!kategoriList || kategoriList.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi bi-folder2-open fs-1"></i>
        <p class="mt-2">Belum ada kategori. Klik tombol + Kategori untuk menambah.</p>
      </div>
    `;
    return;
  }
  
  // Gunakan fragment untuk performance
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  
  kategoriList.forEach((kat, idx) => {
    const items = checklistItems[kat.id] ? Object.entries(checklistItems[kat.id]) : [];
    const validItems = items.filter(([_, item]) => item !== null);
    const completedCount = validItems.filter(([_, item]) => item.selesai).length;
    const percentItem = validItems.length > 0 ? (completedCount / validItems.length) * 100 : 0;
    
    tempDiv.innerHTML = `
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
                  <input type="checkbox" class="form-check-input fs-5" id="item_${itemId}" ${item.selesai ? 'checked' : ''} onchange="toggleItem('${kat.id}', '${itemId}', this.checked)" ${item.updatedFromKeuangan ? 'disabled' : ''}>
                  <label class="checklist-label mb-0 ${item.selesai ? 'text-decoration-line-through text-muted' : ''}" for="item_${itemId}">${escapeHtml(item.nama)}</label>
                </div>
                <div>
                  ${!item.selesai ? `<button class="btn-icon btn-sm" onclick="addItemToKeuangan('${kat.id}', '${itemId}', '${escapeHtml(item.nama)}')" title="Tambah ke Keuangan">
                    <i class="bi bi-wallet2 text-success"></i>
                  </button>` : ''}
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
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }
  });
  
  container.innerHTML = '';
  container.appendChild(fragment);
}

async function generateAIRecommendations() {
  if (isGeneratingAI) return;
  isGeneratingAI = true;
  
  const container = document.getElementById('aiRecommendations');
  if (!container) {
    isGeneratingAI = false;
    return;
  }
  
  container.innerHTML = `
    <div class="card p-3 mb-4" style="background: linear-gradient(135deg, #667eea15, #764ba215); border-radius: 16px;">
      <div class="d-flex align-items-center gap-3">
        <div class="spinner-border text-purple" role="status" style="width: 20px; height: 20px;"></div>
        <span class="small">AI sedang menganalisis...</span>
      </div>
    </div>
  `;
  
  // Simulasi AI analysis
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const completedItems = [];
  const incompleteItems = [];
  let totalEstimasi = 0;
  
  kategoriList.forEach(kat => {
    totalEstimasi += kat.estimasiBiaya || 0;
    const items = checklistItems[kat.id] ? Object.values(checklistItems[kat.id]) : [];
    items.forEach(item => {
      if (item && item.selesai) completedItems.push(item);
      else if (item) incompleteItems.push(item);
    });
  });
  
  const progress = kategoriList.length > 0 ? (completedItems.length / (completedItems.length + incompleteItems.length)) * 100 : 0;
  
  let recommendations = [];
  
  if (incompleteItems.length > 0) {
    recommendations.push({
      title: "📋 Prioritas Checklist",
      description: `${incompleteItems.length} item perlu diselesaikan.`,
      action: "Lihat Checklist"
    });
  }
  
  if (totalEstimasi > 0) {
    recommendations.push({
      title: "💰 Estimasi Biaya",
      description: `Total: Rp ${totalEstimasi.toLocaleString('id-ID')}`,
      action: "Atur Keuangan",
      actionLink: "keuangan"
    });
  }
  
  if (progress < 30) {
    recommendations.push({
      title: "🚀 Mulai Persiapan",
      description: "Fokus pada dokumen dan venue terlebih dahulu.",
      action: "Mulai"
    });
  } else if (progress >= 70 && incompleteItems.length > 0) {
    recommendations.push({
      title: "🎉 Hampir Selesai!",
      description: `Tinggal ${incompleteItems.length} item lagi.`,
      action: "Finalisasi"
    });
  }
  
  container.innerHTML = `
    <div class="card p-3 mb-4" style="background: linear-gradient(135deg, #667eea15, #764ba215); border-radius: 16px;">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-robot fs-5 text-purple"></i>
          <span class="fw-bold small">✨ Rekomendasi AI</span>
        </div>
        <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="generateAIRecommendations()" style="font-size: 11px;">
          <i class="bi bi-arrow-repeat me-1"></i> Refresh
        </button>
      </div>
      <div class="d-flex flex-wrap gap-2">
        ${recommendations.map(rec => `
          <div class="p-2 bg-white rounded-3 flex-grow-1" style="background: var(--card-bg) !important;">
            <div class="fw-semibold small">${rec.title}</div>
            <small class="text-muted d-block">${rec.description}</small>
            <button class="btn btn-sm btn-outline-primary rounded-pill mt-1" style="font-size: 11px;" 
                    onclick="applyAIRecommendation('${rec.actionLink || 'catatan'}')">
              ${rec.action} <i class="bi bi-arrow-right ms-1"></i>
            </button>
          </div>
        `).join('')}
        ${recommendations.length === 0 ? '<div class="text-muted small py-2 text-center">✨ Persiapan Anda sudah baik! Tetap semangat!</div>' : ''}
      </div>
    </div>
  `;
  
  isGeneratingAI = false;
}

window.applyAIRecommendation = function(action) {
  if (action === 'keuangan') {
    window.location.href = '#keuangan-page';
    showPage('keuangan');
  }
};

window.generateAIRecommendations = generateAIRecommendations;

window.addItemToKeuangan = async function(kategoriId, itemId, itemNama) {
  const kat = kategoriList.find(k => k.id === kategoriId);
  const estimasiBiaya = kat?.estimasiBiaya || 0;
  const biayaPerItem = Math.round(estimasiBiaya / 10) || 100000;
  
  const nominal = await showCustomPrompt(`Masukkan nominal untuk "${itemNama}"`, `Estimasi: Rp ${biayaPerItem.toLocaleString('id-ID')}`, biayaPerItem);
  
  if (nominal && !isNaN(nominal) && parseInt(nominal) > 0) {
    const confirmed = await showCustomConfirm("Konfirmasi", `Tambahkan keuangan untuk "${itemNama}" sebesar Rp ${parseInt(nominal).toLocaleString('id-ID')}?`);
    if (confirmed) {
      showLoading("Menambahkan ke keuangan...");
      try {
        const transaksi = await window.addTransaksiFromExternal(currentUser, {
          tipe: 'pengeluaran',
          kategori: 'Pernikahan',
          nominal: parseInt(nominal),
          catatan: `Biaya untuk: ${itemNama} (dari Catatan)`,
          fromCatatan: true,
          sourceType: 'catatan_item',
          sourceId: `${kategoriId}_${itemId}`
        });
        
        await update(ref(db, `data/catatan/${currentUser}/items/${kategoriId}/${itemId}`), { 
          selesai: true,
          linkedTransactionId: transaksi.id,
          updatedFromKeuangan: true
        });
        
        clearCache(`catatan_items_${currentUser}`);
        await loadChecklistItemsOptimized(true);
        renderKategori();
        updateProgress();
        
        showNotif(`✅ "${itemNama}" ditambahkan!`, false, 'success');
      } catch (err) {
        showNotif("Gagal menambahkan", true, 'error');
      } finally {
        hideLoading();
      }
    }
  }
};

window.addBudgetToKeuangan = async function(kategoriId) {
  const kat = kategoriList.find(k => k.id === kategoriId);
  if (!kat || !kat.estimasiBiaya) {
    showNotif("Kategori ini tidak memiliki estimasi biaya", true, 'error');
    return;
  }
  
  const confirmed = await showCustomConfirm("Konfirmasi", `Tambahkan budget untuk "${kat.nama}" sebesar Rp ${kat.estimasiBiaya.toLocaleString('id-ID')}?`);
  if (confirmed) {
    showLoading("Menambahkan ke keuangan...");
    try {
      await window.addTransaksiFromExternal(currentUser, {
        tipe: 'pengeluaran',
        kategori: 'Pernikahan',
        nominal: kat.estimasiBiaya,
        catatan: `Budget untuk: ${kat.nama}`,
        fromCatatan: true,
        sourceType: 'catatan_kategori',
        sourceId: kategoriId
      });
      showNotif(`✅ Budget "${kat.nama}" ditambahkan!`, false, 'success');
    } catch (err) {
      showNotif("Gagal menambahkan", true, 'error');
    } finally {
      hideLoading();
    }
  }
};

window.toggleItem = async function(kategoriId, itemId, selesai) {
  if (selesai) {
    const item = checklistItems[kategoriId]?.[itemId];
    if (item && !item.linkedTransactionId) {
      showNotif("Silakan tambahkan item ini ke Keuangan terlebih dahulu", false, 'warning');
      addItemToKeuangan(kategoriId, itemId, item.nama);
      return;
    }
  }
  await update(ref(db, `data/catatan/${currentUser}/items/${kategoriId}/${itemId}`), { selesai });
  clearCache(`catatan_items_${currentUser}`);
  updateProgress();
};

window.deleteItem = async function(kategoriId, itemId) {
  const confirmed = await showCustomConfirm("Hapus Item", "Yakin ingin menghapus item ini?");
  if (confirmed) {
    showLoading("Menghapus item...");
    try {
      const item = checklistItems[kategoriId]?.[itemId];
      if (item && item.linkedTransactionId) {
        await window.deleteTransaksiWithRelation(item.linkedTransactionId, currentUser);
      }
      await remove(ref(db, `data/catatan/${currentUser}/items/${kategoriId}/${itemId}`));
      clearCache(`catatan_items_${currentUser}`);
      await loadChecklistItemsOptimized(true);
      renderKategori();
      updateProgress();
      showNotif("Item dihapus", false, 'warning');
    } catch (err) {
      showNotif("Gagal menghapus", true, 'error');
    } finally {
      hideLoading();
    }
  }
};

window.deleteKategori = async function(id) {
  const confirmed = await showCustomConfirm("Hapus Kategori", "Yakin ingin menghapus kategori ini? Semua item di dalamnya juga akan terhapus.");
  if (confirmed) {
    showLoading("Menghapus kategori...");
    try {
      const items = checklistItems[id] || {};
      for (const [itemId, item] of Object.entries(items)) {
        if (item && item.linkedTransactionId) {
          await window.deleteTransaksiWithRelation(item.linkedTransactionId, currentUser);
        }
      }
      await remove(ref(db, `data/catatan/${currentUser}/kategori/${id}`));
      await remove(ref(db, `data/catatan/${currentUser}/items/${id}`));
      clearCache(`catatan_kategori_${currentUser}`);
      clearCache(`catatan_items_${currentUser}`);
      await loadKategoriOptimized(true);
      await loadChecklistItemsOptimized(true);
      renderKategori();
      updateProgress();
      showNotif("Kategori dihapus", false, 'warning');
    } catch (err) {
      showNotif("Gagal menghapus", true, 'error');
    } finally {
      hideLoading();
    }
  }
};

window.openKategoriModal = function(editId = null) {
  editKategoriId = editId;
  
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
              </select>
            </div>
            <div class="mb-3">
              <label class="fw-semibold mb-2">Estimasi Biaya (Rp)</label>
              <input type="number" id="kategoriEstimasi" class="form-control form-control-lg rounded-3">
              <small class="text-muted">Akan terhubung dengan menu Keuangan</small>
            </div>
          </div>
          <div class="modal-footer border-0 pb-4 px-4">
            <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-warning rounded-pill px-4" onclick="saveKategori()">Simpan</button>
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
  
  showLoading("Menyimpan kategori...");
  try {
    if (editKategoriId) {
      await update(ref(db, `data/catatan/${currentUser}/kategori/${editKategoriId}`), { nama, icon, estimasiBiaya });
      showNotif("Kategori berhasil diupdate", false, 'success');
      editKategoriId = null;
    } else {
      await push(ref(db, `data/catatan/${currentUser}/kategori`), { nama, icon, estimasiBiaya });
      showNotif("Kategori berhasil ditambahkan", false, 'success');
    }
    
    clearCache(`catatan_kategori_${currentUser}`);
    await loadKategoriOptimized(true);
    renderKategori();
    generateAIRecommendations();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('kategoriModal'));
    if (modal) modal.hide();
  } catch (err) {
    showNotif("Gagal menyimpan", true, 'error');
  } finally {
    hideLoading();
  }
};

window.editKategori = function(id) {
  openKategoriModal(id);
};

window.addItemToKategori = function(kategoriId) {
  editItemParentId = kategoriId;
  editItemId = null;
  
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
            <button class="btn btn-primary rounded-pill px-4" onclick="saveItem()">Simpan</button>
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
            <button class="btn btn-primary rounded-pill px-4" onclick="saveItem()">Simpan</button>
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
  
  showLoading("Menyimpan item...");
  try {
    if (editItemId) {
      await update(ref(db, `data/catatan/${currentUser}/items/${editItemParentId}/${editItemId}`), { nama });
      showNotif("Item berhasil diupdate", false, 'success');
      editItemId = null;
    } else {
      await push(ref(db, `data/catatan/${currentUser}/items/${editItemParentId}`), { nama, selesai: false });
      showNotif("Item berhasil ditambahkan", false, 'success');
    }
    
    clearCache(`catatan_items_${currentUser}`);
    await loadChecklistItemsOptimized(true);
    renderKategori();
    updateProgress();
    generateAIRecommendations();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('itemModal'));
    if (modal) modal.hide();
  } catch (err) {
    showNotif("Gagal menyimpan", true, 'error');
  } finally {
    hideLoading();
  }
};

window.initCatatan = initCatatan;
