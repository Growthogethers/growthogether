// js/keuangan.js - Real Time dengan Session User & Modal Besar
import { db, ref, push, onValue, remove, update, get, set } from './firebase-config.js';
import { showNotif, formatNumberRp, escapeHtml } from './utils.js';

let currentUser = null;
let transaksiList = [];
let targetTabungan = 0;
let editTransaksiId = null;

export function initKeuangan() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) {
    console.log("No user logged in");
    return;
  }
  
  // Update header
  const keuanganUserName = document.getElementById('keuanganUserName');
  if (keuanganUserName) {
    const displayName = currentUser === "FACHMI" ? "Fachmi" : "Azizah";
    keuanganUserName.innerHTML = `Keuangan ${displayName}`;
  }
  
  loadTargetTabungan();
  loadAllTransaksi(); // Load semua transaksi dari semua user
}

function loadAllTransaksi() {
  // Load transaksi Fachmi
  onValue(ref(db, `data/keuangan/FACHMI/transaksi`), (snapshot) => {
    const data = snapshot.val() || {};
    const fachmiList = Object.entries(data).map(([id, val]) => ({ 
      id, ...val, userId: 'FACHMI', userName: 'Fachmi' 
    }));
    
    // Load transaksi Azizah
    onValue(ref(db, `data/keuangan/AZIZAH/transaksi`), (snapshot2) => {
      const data2 = snapshot2.val() || {};
      const azizahList = Object.entries(data2).map(([id, val]) => ({ 
        id, ...val, userId: 'AZIZAH', userName: 'Azizah' 
      }));
      
      transaksiList = [...fachmiList, ...azizahList];
      renderTransaksi();
      updateRingkasan();
    }, { onlyOnce: true });
  }, { onlyOnce: false });
}

async function loadTargetTabungan() {
  try {
    const snapshot = await get(ref(db, `data/keuangan/${currentUser}/target`));
    targetTabungan = snapshot.val() || 0;
    updateTargetUI();
  } catch (err) {
    console.error("Error loading target:", err);
  }
}

function updateRingkasan() {
  // Ringkasan untuk user yang sedang login
  const userTransaksi = transaksiList.filter(t => t.userId === currentUser);
  const pemasukan = userTransaksi.filter(t => t.tipe === 'pemasukan').reduce((sum, t) => sum + (t.nominal || 0), 0);
  const pengeluaran = userTransaksi.filter(t => t.tipe === 'pengeluaran').reduce((sum, t) => sum + (t.nominal || 0), 0);
  const saldo = pemasukan - pengeluaran;
  
  const totalSaldoEl = document.getElementById('totalSaldo');
  const totalPemasukanEl = document.getElementById('totalPemasukan');
  const totalPengeluaranEl = document.getElementById('totalPengeluaran');
  const terkumpulEl = document.getElementById('terkumpul');
  const targetProgressEl = document.getElementById('targetProgress');
  
  if (totalSaldoEl) totalSaldoEl.innerHTML = formatNumberRp(saldo);
  if (totalPemasukanEl) totalPemasukanEl.innerHTML = formatNumberRp(pemasukan);
  if (totalPengeluaranEl) totalPengeluaranEl.innerHTML = formatNumberRp(pengeluaran);
  if (terkumpulEl) terkumpulEl.innerHTML = formatNumberRp(saldo);
  
  const percent = targetTabungan > 0 ? (saldo / targetTabungan) * 100 : 0;
  if (targetProgressEl) targetProgressEl.style.width = `${Math.min(percent, 100)}%`;
}

function updateTargetUI() {
  const targetAmountEl = document.getElementById('targetAmount');
  if (targetAmountEl) targetAmountEl.innerHTML = `Target: ${formatNumberRp(targetTabungan)}`;
}

function renderTransaksi() {
  const container = document.getElementById('transaksiList');
  if (!container) return;
  
  if (transaksiList.length === 0) {
    container.innerHTML = '<div class="text-center text-muted py-4">Belum ada transaksi</div>';
    return;
  }
  
  // Urutkan berdasarkan tanggal terbaru
  const sortedList = [...transaksiList].sort((a, b) => b.tanggal - a.tanggal);
  
  container.innerHTML = sortedList.map(t => `
    <div class="list-group-item d-flex justify-content-between align-items-center ${t.userId === currentUser ? 'bg-light' : ''}" style="border-left: 3px solid ${t.userId === 'FACHMI' ? '#6366f1' : '#ec4899'}">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="badge ${t.userId === 'FACHMI' ? 'bg-primary' : 'bg-pink'}">${escapeHtml(t.userName)}</span>
          <span class="fw-medium">${escapeHtml(t.kategori)}</span>
        </div>
        <small class="d-block text-muted">${new Date(t.tanggal).toLocaleDateString('id-ID')}</small>
        ${t.catatan ? `<small class="d-block text-muted">📝 ${escapeHtml(t.catatan)}</small>` : ''}
      </div>
      <div class="text-end">
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
  `).join('');
}

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
                <option value="Makanan">🍜 Makanan & Minuman</option>
                <option value="Transportasi">🚗 Transportasi</option>
                <option value="Belanja">🛍️ Belanja</option>
                <option value="Tabungan">🏦 Tabungan</option>
                <option value="Hiburan">🎬 Hiburan</option>
                <option value="Kesehatan">🏥 Kesehatan</option>
                <option value="Pendidikan">📚 Pendidikan</option>
                <option value="Tagihan">💡 Tagihan</option>
                <option value="Lainnya">📝 Lainnya</option>
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
  
  const transaksiData = {
    tipe, kategori, nominal, tanggal: new Date(tanggal).getTime(), catatan, updatedAt: Date.now()
  };
  
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
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('transaksiModal'));
  if (modal) modal.hide();
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
  
  if (confirm("Yakin ingin menghapus transaksi ini?")) {
    await remove(ref(db, `data/keuangan/${userId}/transaksi/${id}`));
    showNotif("Transaksi dihapus", false, 'warning');
  }
};

window.setTargetTabungan = function() {
  const modalHtml = `
    <div class="modal fade" id="targetModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0 bg-primary text-white">
            <h5 class="fw-bold mb-0">🎯 Target Tabungan Saya</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4">
            <label class="fw-semibold mb-2">Target Tabungan</label>
            <input type="number" id="targetInput" class="form-control form-control-lg rounded-3" placeholder="Masukkan target" value="${targetTabungan}">
            <small class="text-muted mt-2 d-block">Target tabungan pribadi Anda</small>
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
  
  if (target && currentUser) {
    await set(ref(db, `data/keuangan/${currentUser}/target`), target);
    targetTabungan = target;
    updateTargetUI();
    updateRingkasan();
    showNotif("Target tabungan disimpan", false, 'success');
    const modal = bootstrap.Modal.getInstance(document.getElementById('targetModal'));
    if (modal) modal.hide();
  }
};

window.initKeuangan = initKeuangan;
