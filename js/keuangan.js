// js/keuangan.js - Optimasi dengan Caching
import { db, ref, push, onValue, remove, update, get, set } from './firebase-config.js';
import { showNotif, formatNumberRp, escapeHtml, showCustomPrompt, showCustomConfirm, getCache, setCache, throttle, showLoading, hideLoading } from './utils.js';

let currentUser = null;
let transaksiList = [];
let targetBersama = 0;
let editTransaksiId = null;
let dynamicCategories = ['Pernikahan', 'Makanan', 'Transportasi', 'Belanja', 'Tabungan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Tagihan', 'Lainnya'];
let isInitialized = false;

// Throttled render functions
const throttledRenderTransaksi = throttle(() => {
  renderTransaksi();
  updateRingkasan();
}, 300);

export function initKeuangan() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) {
    console.log("No user logged in");
    return;
  }
  
  if (isInitialized) {
    // Refresh data saja
    loadAllTransaksiOptimized();
    return;
  }
  
  showLoading("Memuat data keuangan...");
  isInitialized = true;
  
  const keuanganUserName = document.getElementById('keuanganUserName');
  if (keuanganUserName) {
    const displayName = currentUser === "FACHMI" ? "Fachmi" : "Azizah";
    keuanganUserName.innerHTML = `Keuangan ${displayName}`;
  }
  
  // Parallel loading
  Promise.all([
    loadTargetBersama(),
    loadDynamicCategories(),
    loadAllTransaksiOptimized()
  ]).finally(() => {
    hideLoading();
  });
}

async function loadDynamicCategories() {
  const cacheKey = `categories_${currentUser}`;
  const cached = getCache(cacheKey);
  if (cached) {
    dynamicCategories = cached;
    updateKategoriSelect();
    return;
  }
  
  try {
    const [catatanSnapshot, impianSnapshot] = await Promise.all([
      get(ref(db, `data/catatan/${currentUser}/kategori`)),
      get(ref(db, `data/impian/${currentUser}`))
    ]);
    
    const catatanKategori = catatanSnapshot.val() || {};
    const catatanNama = Object.values(catatanKategori).map(k => k.nama?.replace(/[📋🏛️👗💍📸🍽️🎵📝💰👥]/g, '').trim());
    
    const impianData = impianSnapshot.val() || {};
    const impianKategori = Object.values(impianData).map(i => i.kategori);
    
    const allCategories = [...new Set([...dynamicCategories, ...catatanNama, ...impianKategori])];
    dynamicCategories = allCategories.filter(c => c && c.length > 0);
    
    setCache(cacheKey, dynamicCategories, 10);
    updateKategoriSelect();
  } catch (err) {
    console.error("Error loading dynamic categories:", err);
  }
}

function updateKategoriSelect() {
  const select = document.getElementById('transaksiKategori');
  if (!select) return;
  
  const options = dynamicCategories.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('');
  select.innerHTML = options;
}

async function loadAllTransaksiOptimized() {
  const cacheKey = `keuangan_transaksi_${currentUser}`;
  const cached = getCache(cacheKey);
  if (cached) {
    transaksiList = cached;
    renderTransaksi();
    updateRingkasan();
    return;
  }
  
  try {
    const [fachmiSnap, azizahSnap] = await Promise.all([
      get(ref(db, `data/keuangan/FACHMI/transaksi`)),
      get(ref(db, `data/keuangan/AZIZAH/transaksi`))
    ]);
    
    const fachmiData = fachmiSnap.val() || {};
    const azizahData = azizahSnap.val() || {};
    
    const fachmiList = Object.entries(fachmiData).map(([id, val]) => ({ 
      id, ...val, userId: 'FACHMI', userName: 'Fachmi' 
    }));
    
    const azizahList = Object.entries(azizahData).map(([id, val]) => ({ 
      id, ...val, userId: 'AZIZAH', userName: 'Azizah' 
    }));
    
    transaksiList = [...fachmiList, ...azizahList];
    
    setCache(cacheKey, transaksiList, 3);
    renderTransaksi();
    updateRingkasan();
  } catch (err) {
    console.error("Error loading transaksi:", err);
    showNotif("Gagal memuat data keuangan", true, 'error');
  }
}

async function loadTargetBersama() {
  const cacheKey = 'keuangan_target_bersama';
  const cached = getCache(cacheKey);
  if (cached !== null) {
    targetBersama = cached;
    updateTargetUI();
    return;
  }
  
  try {
    const snapshot = await get(ref(db, `data/keuangan/targetBersama`));
    targetBersama = snapshot.val() || 0;
    setCache(cacheKey, targetBersama, 30);
    updateTargetUI();
  } catch (err) {
    console.error("Error loading target:", err);
  }
}

function updateRingkasan() {
  const fachmiTransaksi = transaksiList.filter(t => t.userId === 'FACHMI');
  const azizahTransaksi = transaksiList.filter(t => t.userId === 'AZIZAH');
  
  const fachmiPemasukan = fachmiTransaksi.filter(t => t.tipe === 'pemasukan').reduce((sum, t) => sum + (t.nominal || 0), 0);
  const fachmiPengeluaran = fachmiTransaksi.filter(t => t.tipe === 'pengeluaran').reduce((sum, t) => sum + (t.nominal || 0), 0);
  const azizahPemasukan = azizahTransaksi.filter(t => t.tipe === 'pemasukan').reduce((sum, t) => sum + (t.nominal || 0), 0);
  const azizahPengeluaran = azizahTransaksi.filter(t => t.tipe === 'pengeluaran').reduce((sum, t) => sum + (t.nominal || 0), 0);
  
  const fachmiSaldo = fachmiPemasukan - fachmiPengeluaran;
  const azizahSaldo = azizahPemasukan - azizahPengeluaran;
  const totalSaldo = fachmiSaldo + azizahSaldo;
  
  const userTransaksi = transaksiList.filter(t => t.userId === currentUser);
  const userPemasukan = userTransaksi.filter(t => t.tipe === 'pemasukan').reduce((sum, t) => sum + (t.nominal || 0), 0);
  const userPengeluaran = userTransaksi.filter(t => t.tipe === 'pengeluaran').reduce((sum, t) => sum + (t.nominal || 0), 0);
  const userSaldo = userPemasukan - userPengeluaran;
  
  const totalSaldoEl = document.getElementById('totalSaldo');
  const totalPemasukanEl = document.getElementById('totalPemasukan');
  const totalPengeluaranEl = document.getElementById('totalPengeluaran');
  const terkumpulEl = document.getElementById('terkumpul');
  const targetProgressEl = document.getElementById('targetProgress');
  const saldoDetailEl = document.getElementById('saldoDetail');
  
  if (totalSaldoEl) totalSaldoEl.innerHTML = formatNumberRp(userSaldo);
  if (totalPemasukanEl) totalPemasukanEl.innerHTML = formatNumberRp(userPemasukan);
  if (totalPengeluaranEl) totalPengeluaranEl.innerHTML = formatNumberRp(userPengeluaran);
  if (terkumpulEl) terkumpulEl.innerHTML = formatNumberRp(totalSaldo);
  if (saldoDetailEl) saldoDetailEl.innerHTML = `Saldo Anda: ${formatNumberRp(userSaldo)} | Total bersama: ${formatNumberRp(totalSaldo)}`;
  
  const percent = targetBersama > 0 ? (totalSaldo / targetBersama) * 100 : 0;
  if (targetProgressEl) targetProgressEl.style.width = `${Math.min(percent, 100)}%`;
}

function updateTargetUI() {
  const targetAmountEl = document.getElementById('targetAmount');
  if (targetAmountEl) targetAmountEl.innerHTML = `Target Bersama: ${formatNumberRp(targetBersama)}`;
  if (typeof window.renderDashboard === 'function') window.renderDashboard();
}

function renderTransaksi() {
  const container = document.getElementById('transaksiList');
  if (!container) return;
  
  if (!transaksiList || transaksiList.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4">Belum ada transaksi</div>';
    return;
  }
  
  const sortedList = [...transaksiList].sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));
  
  // Gunakan DocumentFragment untuk performance
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  
  sortedList.forEach(t => {
    tempDiv.innerHTML = `
      <div class="list-group-item d-flex justify-content-between align-items-start ${t.userId === currentUser ? 'bg-light' : ''}" style="border-left: 3px solid ${t.userId === 'FACHMI' ? '#6366f1' : '#ec4899'}; margin-bottom: 8px; border-radius: 12px;">
        <div class="flex-grow-1">
          <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <span class="badge ${t.userId === 'FACHMI' ? 'bg-primary' : 'bg-pink'}">${escapeHtml(t.userName)}</span>
            <span class="fw-medium">${escapeHtml(t.kategori)}</span>
            ${t.fromImpian ? '<span class="badge bg-purple"><i class="bi bi-stars me-1"></i>Impian</span>' : ''}
            ${t.fromCatatan ? '<span class="badge bg-warning"><i class="bi bi-journal me-1"></i>Catatan</span>' : ''}
            ${t.sourceId ? '<span class="badge bg-secondary">🔗 Terhubung</span>' : ''}
          </div>
          <small class="d-block text-muted">${t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID') : '-'}</small>
          ${t.catatan ? `<small class="d-block text-muted">📝 ${escapeHtml(t.catatan)}</small>` : ''}
        </div>
        <div class="text-end ms-2">
          <span class="fw-bold ${t.tipe === 'pemasukan' ? 'text-success' : 'text-danger'}">
            ${t.tipe === 'pemasukan' ? '+' : '-'} ${formatNumberRp(t.nominal)}
          </span>
          ${t.userId === currentUser ? `
            <div class="mt-1">
              <button class="btn-icon btn-sm" onclick="editTransaksi('${t.id}', '${t.userId}')">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn-icon btn-sm" onclick="deleteTransaksi('${t.id}', '${t.userId}')">
                <i class="bi bi-trash3"></i>
              </button>
            </div>
          ` : ''}
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

export async function addTransaksiFromExternal(userId, data) {
  const transaksiData = {
    tipe: data.tipe || 'pengeluaran',
    kategori: data.kategori || 'Pernikahan',
    nominal: data.nominal,
    tanggal: Date.now(),
    catatan: data.catatan || '',
    fromImpian: data.fromImpian || false,
    fromCatatan: data.fromCatatan || false,
    sourceId: data.sourceId || null,
    sourceType: data.sourceType || null,
    createdAt: Date.now(),
    createdBy: userId
  };
  
  const newRef = await push(ref(db, `data/keuangan/${userId}/transaksi`), transaksiData);
  // Clear cache
  clearCache(`keuangan_transaksi_${userId}`);
  return { id: newRef.key, ...transaksiData };
}

export async function deleteTransaksiWithRelation(transaksiId, userId) {
  const transaksiSnap = await get(ref(db, `data/keuangan/${userId}/transaksi/${transaksiId}`));
  const transaksi = transaksiSnap.val();
  
  if (!transaksi) return;
  
  if (transaksi.fromCatatan && transaksi.sourceId && transaksi.sourceType === 'catatan_item') {
    const [kategoriId, itemId] = transaksi.sourceId.split('_');
    await update(ref(db, `data/catatan/${userId}/items/${kategoriId}/${itemId}`), { 
      selesai: false,
      linkedTransactionId: null 
    });
  }
  
  if (transaksi.fromImpian && transaksi.sourceId) {
    const impianSnap = await get(ref(db, `data/impian/${userId}/${transaksi.sourceId}`));
    const impian = impianSnap.val();
    if (impian && impian.target && impian.progress) {
      const newProgress = Math.max(0, impian.progress - (transaksi.nominal / impian.target * 100));
      await update(ref(db, `data/impian/${userId}/${transaksi.sourceId}`), { 
        progress: Math.round(newProgress),
        terhubungKeuangan: false
      });
    }
  }
  
  await remove(ref(db, `data/keuangan/${userId}/transaksi/${transaksiId}`));
  clearCache(`keuangan_transaksi_${userId}`);
}

// Setup realtime listeners dengan throttle
let isListenerActive = false;
function setupRealtimeListeners() {
  if (isListenerActive) return;
  isListenerActive = true;
  
  const throttledUpdate = throttle(() => {
    loadAllTransaksiOptimized();
    loadDynamicCategories();
  }, 1000);
  
  onValue(ref(db, `data/keuangan/FACHMI/transaksi`), () => throttledUpdate());
  onValue(ref(db, `data/keuangan/AZIZAH/transaksi`), () => throttledUpdate());
  onValue(ref(db, `data/keuangan/targetBersama`), () => {
    loadTargetBersama();
    throttledUpdate();
  });
}

// Panggil setup listeners setelah init
setTimeout(() => setupRealtimeListeners(), 2000);

window.openTransaksiModal = function(editId = null, editUserId = null) {
  editTransaksiId = editId;
  
  const modalHtml = `
    <div class="modal fade" id="transaksiModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content rounded-4" style="max-width: 500px;">
          <div class="modal-header border-0 bg-success text-white py-3">
            <h5 class="fw-bold mb-0">${editId ? '✏️ Edit Transaksi' : '💰 Tambah Transaksi'}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body modal-form p-4">
            <div class="mb-3">
              <label class="fw-semibold mb-2">Tipe Transaksi</label>
              <select id="transaksiTipe" class="form-select form-select-lg rounded-3">
                <option value="pemasukan">📥 + Pemasukan</option>
                <option value="pengeluaran">📤 - Pengeluaran</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="fw-semibold mb-2">Kategori</label>
              <select id="transaksiKategori" class="form-select form-select-lg rounded-3">
                ${dynamicCategories.map(k => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join('')}
              </select>
            </div>
            <div class="mb-3">
              <label class="fw-semibold mb-2">Nominal</label>
              <input type="number" id="transaksiNominal" class="form-control form-control-lg rounded-3" placeholder="Masukkan nominal">
            </div>
            <div class="mb-3">
              <label class="fw-semibold mb-2">Tanggal</label>
              <input type="date" id="transaksiTanggal" class="form-control form-control-lg rounded-3" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="mb-3">
              <label class="fw-semibold mb-2">Catatan (Opsional)</label>
              <textarea id="transaksiCatatan" class="form-control rounded-3" rows="3" placeholder="Tambahkan catatan..."></textarea>
            </div>
          </div>
          <div class="modal-footer border-0 pb-4 px-4">
            <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-success rounded-pill px-4" onclick="saveTransaksi()">Simpan Transaksi</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  let modal = document.getElementById('transaksiModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('transaksiModal');
  }
  
  if (editId && editUserId) {
    loadTransaksiData(editId, editUserId);
  }
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

async function loadTransaksiData(id, userId) {
  const snapshot = await get(ref(db, `data/keuangan/${userId}/transaksi/${id}`));
  const data = snapshot.val();
  if (data) {
    document.getElementById('transaksiTipe').value = data.tipe || 'pemasukan';
    document.getElementById('transaksiKategori').value = data.kategori || 'Lainnya';
    document.getElementById('transaksiNominal').value = data.nominal || '';
    document.getElementById('transaksiTanggal').value = data.tanggal ? new Date(data.tanggal).toISOString().split('T')[0] : '';
    document.getElementById('transaksiCatatan').value = data.catatan || '';
  }
}

window.saveTransaksi = async function() {
  const tipe = document.getElementById('transaksiTipe').value;
  const kategori = document.getElementById('transaksiKategori').value;
  const nominal = parseInt(document.getElementById('transaksiNominal').value);
  const tanggal = document.getElementById('transaksiTanggal').value;
  const catatan = document.getElementById('transaksiCatatan').value;
  
  if (!nominal || nominal <= 0) {
    showNotif("Nominal tidak valid", true, 'error');
    return;
  }
  
  if (!currentUser) {
    showNotif("User tidak terdeteksi", true, 'error');
    return;
  }
  
  showLoading("Menyimpan transaksi...");
  
  const transaksiData = {
    tipe, kategori, nominal, tanggal: new Date(tanggal).getTime(), catatan, updatedAt: Date.now()
  };
  
  try {
    if (editTransaksiId) {
      await update(ref(db, `data/keuangan/${currentUser}/transaksi/${editTransaksiId}`), transaksiData);
      showNotif("Transaksi berhasil diupdate", false, 'success');
      editTransaksiId = null;
    } else {
      transaksiData.createdAt = Date.now();
      transaksiData.createdBy = currentUser;
      await push(ref(db, `data/keuangan/${currentUser}/transaksi`), transaksiData);
      showNotif("Transaksi berhasil ditambahkan", false, 'success');
    }
    
    clearCache(`keuangan_transaksi_${currentUser}`);
    await loadAllTransaksiOptimized();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('transaksiModal'));
    if (modal) modal.hide();
  } catch (err) {
    console.error(err);
    showNotif("Gagal menyimpan transaksi", true, 'error');
  } finally {
    hideLoading();
  }
};

window.editTransaksi = function(id, userId) {
  if (userId === currentUser) {
    openTransaksiModal(id, userId);
  } else {
    showNotif("Anda hanya bisa mengedit transaksi sendiri", true, 'error');
  }
};

window.deleteTransaksi = async function(id, userId) {
  if (userId !== currentUser) {
    showNotif("Anda hanya bisa menghapus transaksi sendiri", true, 'error');
    return;
  }
  
  const confirmed = await showCustomConfirm("Hapus Transaksi", "Yakin ingin menghapus transaksi ini? Data yang terhubung (Catatan/Impian) juga akan diperbarui.");
  if (confirmed) {
    showLoading("Menghapus transaksi...");
    try {
      await deleteTransaksiWithRelation(id, userId);
      showNotif("Transaksi dihapus", false, 'warning');
      clearCache(`keuangan_transaksi_${currentUser}`);
      await loadAllTransaksiOptimized();
    } catch (err) {
      showNotif("Gagal menghapus transaksi", true, 'error');
    } finally {
      hideLoading();
    }
  }
};

window.setTargetTabungan = function() {
  const modalHtml = `
    <div class="modal fade" id="targetModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0 bg-primary text-white">
            <h5 class="fw-bold mb-0">🎯 Target Tabungan Bersama</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4">
            <label class="fw-semibold mb-2">Target Tabungan Bersama</label>
            <input type="number" id="targetInput" class="form-control form-control-lg rounded-3" placeholder="Masukkan target bersama" value="${targetBersama}">
            <small class="text-muted mt-2 d-block">✨ Target ini akan terlihat oleh kedua pasangan</small>
          </div>
          <div class="modal-footer border-0 pb-4">
            <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-primary rounded-pill px-4" onclick="saveTarget()">Simpan Target</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  let modal = document.getElementById('targetModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('targetModal');
  }
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

window.saveTarget = async function() {
  const target = parseInt(document.getElementById('targetInput').value);
  
  if (target && target > 0) {
    showLoading("Menyimpan target...");
    try {
      await set(ref(db, `data/keuangan/targetBersama`), target);
      targetBersama = target;
      clearCache('keuangan_target_bersama');
      updateTargetUI();
      updateRingkasan();
      showNotif("Target tabungan bersama disimpan! 💪", false, 'success');
      const modal = bootstrap.Modal.getInstance(document.getElementById('targetModal'));
      if (modal) modal.hide();
    } catch (err) {
      showNotif("Gagal menyimpan target", true, 'error');
    } finally {
      hideLoading();
    }
  }
};

window.initKeuangan = initKeuangan;
window.addTransaksiFromExternal = addTransaksiFromExternal;
window.deleteTransaksiWithRelation = deleteTransaksiWithRelation;
