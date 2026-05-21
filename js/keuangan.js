// js/keuangan.js - Versi terhubung dengan Catatan per kategori
import { db, ref, push, onValue, remove, update, get, set } from './firebase-config.js';
import { 
  showNotif, formatNumberRp, escapeHtml, showCustomPrompt, showCustomConfirm, 
  getCache, setCache, clearCache, throttle, showLoading, hideLoading 
} from './utils.js';

let currentUser = null;
let transaksiList = [];
let kategoriList = [];
let targetKategori = {};
let editTransaksiId = null;
let dynamicCategories = [];
let isInitialized = false;

// Ambil kategori dari catatan bersama
async function loadKategoriFromCatatan() {
  try {
    const snapshot = await get(ref(db, `data/catatan/bersama/kategori`));
    const data = snapshot.val() || {};
    kategoriList = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    
    // Buat dynamic categories dari nama kategori catatan
    dynamicCategories = kategoriList.map(k => k.nama);
    
    // Load target per kategori dari catatan
    for (const kat of kategoriList) {
      targetKategori[kat.nama] = kat.estimasiBiaya || 0;
    }
    
    updateKategoriSelect();
    return kategoriList;
  } catch (err) {
    console.error("Error loading kategori from catatan:", err);
    return [];
  }
}

function updateKategoriSelect() {
  const select = document.getElementById('transaksiKategori');
  if (!select) return;
  
  let options = '';
  if (dynamicCategories.length > 0) {
    options = dynamicCategories.map(k => `<option value="${escapeHtml(k)}">📁 ${escapeHtml(k)}</option>`).join('');
  } else {
    options = `<option value="Pernikahan">💍 Pernikahan</option>
               <option value="Makanan">🍜 Makanan</option>
               <option value="Transportasi">🚗 Transportasi</option>
               <option value="Lainnya">📝 Lainnya</option>`;
  }
  select.innerHTML = options;
}

export function initKeuangan() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  if (isInitialized) {
    refreshData();
    return;
  }
  
  showLoading("Memuat data keuangan...");
  isInitialized = true;
  
  const keuanganUserName = document.getElementById('keuanganUserName');
  if (keuanganUserName) {
    const displayName = currentUser === "FACHMI" ? "Fachmi" : "Azizah";
    keuanganUserName.innerHTML = `Keuangan ${displayName}`;
  }
  
  Promise.all([
    loadKategoriFromCatatan(),
    loadAllTransaksiOptimized()
  ]).finally(() => {
    hideLoading();
    renderKategoriProgress();
  });
  
  // Setup listener untuk perubahan kategori
  onValue(ref(db, `data/catatan/bersama/kategori`), () => {
    loadKategoriFromCatatan();
    renderKategoriProgress();
  });
  
  onValue(ref(db, `data/keuangan/${currentUser}/transaksi`), () => {
    loadAllTransaksiOptimized(true);
    renderKategoriProgress();
  });
}

async function refreshData() {
  showLoading("Memperbarui data...");
  try {
    await loadKategoriFromCatatan();
    await loadAllTransaksiOptimized(true);
    renderKategoriProgress();
  } catch (err) {
    console.error("Error refreshing:", err);
  } finally {
    hideLoading();
  }
}

// Render progress per kategori dari catatan
function renderKategoriProgress() {
  const container = document.getElementById('kategoriProgressContainer');
  if (!container) return;
  
  if (kategoriList.length === 0) {
    container.innerHTML = `
      <div class="alert alert-info py-2">
        <i class="bi bi-info-circle me-2"></i>
        Belum ada target dari Catatan. Silakan buat planning wedding di menu Catatan.
      </div>
    `;
    return;
  }
  
  // Hitung total pemasukan & pengeluaran per kategori
  const pemasukanPerKategori = {};
  const pengeluaranPerKategori = {};
  
  transaksiList.forEach(t => {
    if (t.tipe === 'pemasukan') {
      pemasukanPerKategori[t.kategori] = (pemasukanPerKategori[t.kategori] || 0) + t.nominal;
    } else {
      pengeluaranPerKategori[t.kategori] = (pengeluaranPerKategori[t.kategori] || 0) + t.nominal;
    }
  });
  
  let html = '<div class="mb-3"><h6 class="fw-bold mb-2"><i class="bi bi-pie-chart me-2"></i>Progress Tabungan per Kategori</h6></div>';
  
  for (const kat of kategoriList) {
    const target = kat.estimasiBiaya || 0;
    const terkumpul = (pemasukanPerKategori[kat.nama] || 0) - (pengeluaranPerKategori[kat.nama] || 0);
    const percent = target > 0 ? Math.min(100, (terkumpul / target) * 100) : 0;
    const status = terkumpul >= target ? 'success' : terkumpul > 0 ? 'warning' : 'secondary';
    
    html += `
      <div class="category-progress-card" data-kategori="${escapeHtml(kat.nama)}">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div>
            <i class="bi ${kat.icon || 'bi-folder'} me-2"></i>
            <strong>${escapeHtml(kat.nama)}</strong>
          </div>
          <small class="text-muted">Target: ${formatNumberRp(target)}</small>
        </div>
        <div class="progress mb-1">
          <div class="progress-bar bg-${status}" style="width: ${percent}%"></div>
        </div>
        <div class="d-flex justify-content-between small">
          <span>Terkumpul: ${formatNumberRp(terkumpul)}</span>
          <span>${Math.round(percent)}%</span>
        </div>
        <div class="mt-2 d-flex gap-2">
          <button class="btn btn-sm btn-outline-success rounded-pill" onclick="addPemasukanKeKategori('${escapeHtml(kat.nama)}')">
            <i class="bi bi-plus-circle me-1"></i> Tambah Tabungan
          </button>
          <button class="btn btn-sm btn-outline-danger rounded-pill" onclick="addPengeluaranKeKategori('${escapeHtml(kat.nama)}')">
            <i class="bi bi-dash-circle me-1"></i> Pengeluaran
          </button>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

// Tambah pemasukan ke kategori tertentu
window.addPemasukanKeKategori = async function(kategoriNama) {
  const nominal = await showCustomPrompt(
    `Tambah Tabungan untuk "${kategoriNama}"`, 
    `Masukkan nominal tabungan`, 
    100000
  );
  
  if (nominal && !isNaN(nominal) && parseInt(nominal) > 0) {
    const confirmed = await showCustomConfirm("Konfirmasi", `Tambahkan tabungan untuk "${kategoriNama}" sebesar Rp ${parseInt(nominal).toLocaleString('id-ID')}?`);
    if (confirmed) {
      showLoading("Menyimpan transaksi...");
      try {
        await addTransaksiFromExternal(currentUser, {
          tipe: 'pemasukan',
          kategori: kategoriNama,
          nominal: parseInt(nominal),
          catatan: `Tabungan untuk: ${kategoriNama}`,
          fromKeuangan: true
        });
        
        showNotif(`✅ Tabungan "${kategoriNama}" berhasil ditambahkan!`, false, 'success');
        
        // Trigger confetti animation
        if (typeof window.triggerConfetti === 'function') {
          window.triggerConfetti();
        }
        
        await loadAllTransaksiOptimized(true);
        renderKategoriProgress();
      } catch (err) {
        showNotif("Gagal menambahkan", true, 'error');
      } finally {
        hideLoading();
      }
    }
  }
};

// Tambah pengeluaran ke kategori tertentu
window.addPengeluaranKeKategori = async function(kategoriNama) {
  const nominal = await showCustomPrompt(
    `Pengeluaran untuk "${kategoriNama}"`, 
    `Masukkan nominal pengeluaran`, 
    50000
  );
  
  if (nominal && !isNaN(nominal) && parseInt(nominal) > 0) {
    const confirmed = await showCustomConfirm("Konfirmasi", `Tambahkan pengeluaran untuk "${kategoriNama}" sebesar Rp ${parseInt(nominal).toLocaleString('id-ID')}?`);
    if (confirmed) {
      showLoading("Menyimpan transaksi...");
      try {
        await addTransaksiFromExternal(currentUser, {
          tipe: 'pengeluaran',
          kategori: kategoriNama,
          nominal: parseInt(nominal),
          catatan: `Pengeluaran untuk: ${kategoriNama}`,
          fromKeuangan: true
        });
        
        showNotif(`✅ Pengeluaran "${kategoriNama}" berhasil dicatat!`, false, 'success');
        await loadAllTransaksiOptimized(true);
        renderKategoriProgress();
      } catch (err) {
        showNotif("Gagal menambahkan", true, 'error');
      } finally {
        hideLoading();
      }
    }
  }
};

async function loadAllTransaksiOptimized(forceRefresh = false) {
  const cacheKey = `keuangan_transaksi_${currentUser}`;
  if (!forceRefresh) {
    const cached = getCache(cacheKey);
    if (cached) {
      transaksiList = cached;
      renderTransaksi();
      updateRingkasan();
      return;
    }
  }
  
  try {
    const snapshot = await get(ref(db, `data/keuangan/${currentUser}/transaksi`));
    const data = snapshot.val() || {};
    transaksiList = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    
    setCache(cacheKey, transaksiList, 3);
    renderTransaksi();
    updateRingkasan();
  } catch (err) {
    console.error("Error loading transaksi:", err);
    showNotif("Gagal memuat data keuangan", true, 'error');
  }
}

function updateRingkasan() {
  const pemasukan = transaksiList.filter(t => t.tipe === 'pemasukan').reduce((sum, t) => sum + (t.nominal || 0), 0);
  const pengeluaran = transaksiList.filter(t => t.tipe === 'pengeluaran').reduce((sum, t) => sum + (t.nominal || 0), 0);
  const saldo = pemasukan - pengeluaran;
  
  const totalSaldoEl = document.getElementById('totalSaldo');
  const totalPemasukanEl = document.getElementById('totalPemasukan');
  const totalPengeluaranEl = document.getElementById('totalPengeluaran');
  const saldoDetailEl = document.getElementById('saldoDetail');
  
  if (totalSaldoEl) totalSaldoEl.innerHTML = formatNumberRp(saldo);
  if (totalPemasukanEl) totalPemasukanEl.innerHTML = formatNumberRp(pemasukan);
  if (totalPengeluaranEl) totalPengeluaranEl.innerHTML = formatNumberRp(pengeluaran);
  if (saldoDetailEl) saldoDetailEl.innerHTML = `Total Pemasukan - Pengeluaran`;
}

function renderTransaksi() {
  const container = document.getElementById('transaksiList');
  if (!container) return;
  
  if (!transaksiList || transaksiList.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4">Belum ada transaksi</div>';
    return;
  }
  
  const sortedList = [...transaksiList].sort((a, b) => (b.tanggal || 0) - (a.tanggal || 0));
  
  container.innerHTML = sortedList.slice(0, 50).map(t => `
    <div class="list-group-item d-flex justify-content-between align-items-start" style="border-left: 3px solid ${t.tipe === 'pemasukan' ? '#10b981' : '#ef4444'}; margin-bottom: 8px; border-radius: 12px;">
      <div class="flex-grow-1">
        <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
          <span class="badge ${t.tipe === 'pemasukan' ? 'bg-success' : 'bg-danger'}">${t.tipe === 'pemasukan' ? '📥 Pemasukan' : '📤 Pengeluaran'}</span>
          <span class="fw-medium">${escapeHtml(t.kategori)}</span>
        </div>
        <small class="d-block text-muted">${t.tanggal ? new Date(t.tanggal).toLocaleDateString('id-ID') : '-'}</small>
        ${t.catatan ? `<small class="d-block text-muted">📝 ${escapeHtml(t.catatan)}</small>` : ''}
      </div>
      <div class="text-end ms-2">
        <span class="fw-bold ${t.tipe === 'pemasukan' ? 'text-success' : 'text-danger'}">
          ${t.tipe === 'pemasukan' ? '+' : '-'} ${formatNumberRp(t.nominal)}
        </span>
        <div class="mt-1">
          <button class="btn-icon btn-sm" onclick="editTransaksi('${t.id}')">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn-icon btn-sm" onclick="deleteTransaksi('${t.id}')">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

export async function addTransaksiFromExternal(userId, data) {
  const transaksiData = {
    tipe: data.tipe || 'pengeluaran',
    kategori: data.kategori || 'Pernikahan',
    nominal: data.nominal,
    tanggal: Date.now(),
    catatan: data.catatan || '',
    fromKeuangan: data.fromKeuangan || false,
    fromCatatan: data.fromCatatan || false,
    createdAt: Date.now(),
    createdBy: userId
  };
  
  const newRef = await push(ref(db, `data/keuangan/${userId}/transaksi`), transaksiData);
  clearCache(`keuangan_transaksi_${userId}`);
  return { id: newRef.key, ...transaksiData };
}

window.openTransaksiModal = function(editId = null) {
  editTransaksiId = editId;
  
  const modalHtml = `
    <div class="modal fade" id="transaksiModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-md">
        <div class="modal-content rounded-4">
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
              <select id="transaksiKategori" class="form-select form-select-lg rounded-3"></select>
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
    updateKategoriSelect();
  }
  
  if (editId) {
    loadTransaksiData(editId);
  }
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

async function loadTransaksiData(id) {
  const snapshot = await get(ref(db, `data/keuangan/${currentUser}/transaksi/${id}`));
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
      
      // Trigger confetti untuk pemasukan
      if (tipe === 'pemasukan' && typeof window.triggerConfetti === 'function') {
        window.triggerConfetti();
      }
    }
    
    clearCache(`keuangan_transaksi_${currentUser}`);
    await loadAllTransaksiOptimized(true);
    renderKategoriProgress();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('transaksiModal'));
    if (modal) modal.hide();
  } catch (err) {
    console.error(err);
    showNotif("Gagal menyimpan transaksi", true, 'error');
  } finally {
    hideLoading();
  }
};

window.editTransaksi = function(id) {
  openTransaksiModal(id);
};

window.deleteTransaksi = async function(id) {
  const confirmed = await showCustomConfirm("Hapus Transaksi", "Yakin ingin menghapus transaksi ini?");
  if (confirmed) {
    showLoading("Menghapus transaksi...");
    try {
      await remove(ref(db, `data/keuangan/${currentUser}/transaksi/${id}`));
      showNotif("Transaksi dihapus", false, 'warning');
      clearCache(`keuangan_transaksi_${currentUser}`);
      await loadAllTransaksiOptimized(true);
      renderKategoriProgress();
    } catch (err) {
      showNotif("Gagal menghapus", true, 'error');
    } finally {
      hideLoading();
    }
  }
};

window.initKeuangan = initKeuangan;
window.addTransaksiFromExternal = addTransaksiFromExternal;
