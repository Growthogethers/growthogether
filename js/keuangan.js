// js/keuangan.js - Per User & Fix Update (tidak double data)
import { db, ref, push, onValue, remove, update, get, set } from './firebase-config.js';
import { showNotif, formatNumberRp, escapeHtml } from './utils.js';

let currentUser = null;
let transaksiList = [];
let targetTabungan = 0;
let editTransaksiId = null;

export function initKeuangan() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  loadTargetTabungan();
  loadTransaksi();
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

function loadTransaksi() {
  onValue(ref(db, `data/keuangan/${currentUser}/transaksi`), (snapshot) => {
    const data = snapshot.val() || {};
    transaksiList = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    renderTransaksi();
    updateRingkasan();
  });
}

function updateRingkasan() {
  const pemasukan = transaksiList.filter(t => t.tipe === 'pemasukan').reduce((sum, t) => sum + (t.nominal || 0), 0);
  const pengeluaran = transaksiList.filter(t => t.tipe === 'pengeluaran').reduce((sum, t) => sum + (t.nominal || 0), 0);
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
  
  container.innerHTML = transaksiList.sort((a, b) => b.tanggal - a.tanggal).map(t => `
    <div class="list-group-item d-flex justify-content-between align-items-center">
      <div>
        <span class="fw-medium">${escapeHtml(t.kategori)}</span>
        <small class="d-block text-muted">${new Date(t.tanggal).toLocaleDateString('id-ID')}</small>
        ${t.catatan ? `<small class="d-block text-muted">${escapeHtml(t.catatan)}</small>` : ''}
      </div>
      <div class="text-end">
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

window.openTransaksiModal = function(editId = null) {
  editTransaksiId = editId;
  
  const modalHtml = `
    <div class="modal fade" id="transaksiModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0">
            <h5 class="fw-bold">${editId ? 'Edit Transaksi' : 'Tambah Transaksi'}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body modal-form">
            <div class="mb-3">
              <label>Tipe</label>
              <select id="transaksiTipe" class="form-select">
                <option value="pemasukan">+ Pemasukan</option>
                <option value="pengeluaran">- Pengeluaran</option>
              </select>
            </div>
            <div class="mb-3">
              <label>Kategori</label>
              <select id="transaksiKategori" class="form-select">
                <option value="Makanan">🍜 Makanan</option>
                <option value="Transportasi">🚗 Transportasi</option>
                <option value="Belanja">🛍️ Belanja</option>
                <option value="Tabungan">🏦 Tabungan</option>
                <option value="Hiburan">🎬 Hiburan</option>
                <option value="Kesehatan">🏥 Kesehatan</option>
                <option value="Lainnya">📝 Lainnya</option>
              </select>
            </div>
            <div class="mb-3">
              <label>Nominal</label>
              <input type="number" id="transaksiNominal" class="form-control" placeholder="Masukkan nominal">
            </div>
            <div class="mb-3">
              <label>Tanggal</label>
              <input type="date" id="transaksiTanggal" class="form-control" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="mb-3">
              <label>Catatan</label>
              <textarea id="transaksiCatatan" class="form-control" rows="2" placeholder="Opsional"></textarea>
            </div>
          </div>
          <div class="modal-footer border-0">
            <button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-success rounded-pill" onclick="saveTransaksi()">Simpan</button>
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
  
  // If edit, load data
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
  
  const currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  const transaksiData = {
    tipe, kategori, nominal, tanggal: new Date(tanggal).getTime(), catatan, updatedAt: Date.now()
  };
  
  if (editTransaksiId) {
    // UPDATE existing data
    await update(ref(db, `data/keuangan/${currentUser}/transaksi/${editTransaksiId}`), transaksiData);
    showNotif("Transaksi berhasil diupdate", false, 'success');
    editTransaksiId = null;
  } else {
    // CREATE new data
    transaksiData.createdAt = Date.now();
    await push(ref(db, `data/keuangan/${currentUser}/transaksi`), transaksiData);
    showNotif("Transaksi berhasil ditambahkan", false, 'success');
  }
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('transaksiModal'));
  if (modal) modal.hide();
};

window.editTransaksi = function(id) {
  openTransaksiModal(id);
};

window.deleteTransaksi = async function(id) {
  const currentUser = sessionStorage.getItem("progrowth_user");
  await remove(ref(db, `data/keuangan/${currentUser}/transaksi/${id}`));
  showNotif("Transaksi dihapus", false, 'warning');
};

window.setTargetTabungan = function() {
  const modalHtml = `
    <div class="modal fade" id="targetModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0">
            <h5 class="fw-bold">Target Tabungan</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <input type="number" id="targetInput" class="form-control" placeholder="Masukkan target" value="${targetTabungan}">
            <small class="text-muted">Target tabungan untuk pernikahan / bersama</small>
          </div>
          <div class="modal-footer border-0">
            <button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-primary rounded-pill" onclick="saveTarget()">Simpan</button>
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
  const currentUser = sessionStorage.getItem("progrowth_user");
  
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
window.editTransaksi = editTransaksi;
