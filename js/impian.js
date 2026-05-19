// js/impian.js
import { db, ref, push, onValue, remove, update } from './firebase-config.js';
import { showNotif, formatNumberRp, escapeHtml } from './utils.js';

let currentUser = null;

export function initImpian() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  loadImpian();
}

function loadImpian() {
  onValue(ref(db, `data/impian/${currentUser}`), (snapshot) => {
    const data = snapshot.val() || {};
    const impianList = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    renderImpian(impianList);
  });
}

function renderImpian(impianList) {
  const container = document.getElementById('impianList');
  if (!container) return;
  
  if (impianList.length === 0) {
    container.innerHTML = '<div class="col-12 text-center text-muted py-5">Belum ada impian. Ayo tambah impianmu!</div>';
    return;
  }
  
  container.innerHTML = impianList.sort((a, b) => b.prioritas - a.prioritas).map(impian => `
    <div class="col-md-6 col-12">
      <div class="impian-card ${impian.tercapai ? 'achieved' : ''}">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h6 class="fw-bold mb-0">${escapeHtml(impian.judul)}</h6>
            <small class="text-muted">${impian.kategori || 'Impian'}</small>
          </div>
          <div class="dropdown">
            <button class="btn-icon" data-bs-toggle="dropdown">
              <i class="bi bi-three-dots-vertical"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><a class="dropdown-item" onclick="editImpian('${impian.id}')">Edit</a></li>
              <li><a class="dropdown-item text-danger" onclick="deleteImpian('${impian.id}')">Hapus</a></li>
            </ul>
          </div>
        </div>
        <p class="small mb-2">${escapeHtml(impian.deskripsi) || 'Tidak ada deskripsi'}</p>
        <div class="impian-progress">
          <div class="d-flex justify-content-between small mb-1">
            <span>Progress</span>
            <span>${impian.progress || 0}%</span>
          </div>
          <div class="progress" style="height: 4px;">
            <div class="progress-bar bg-purple" style="width: ${impian.progress || 0}%"></div>
          </div>
        </div>
        ${impian.tercapai ? '<span class="badge bg-success mt-2">✨ Tercapai!</span>' : ''}
      </div>
    </div>
  `).join('');
}

window.openImpianModal = function(editId = null) {
  const modalHtml = `
    <div class="modal fade" id="impianModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0">
            <h5 class="fw-bold">${editId ? 'Edit Impian' : 'Tambah Impian Baru'}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body modal-form">
            <input type="hidden" id="impianEditId" value="${editId || ''}">
            <div class="mb-3">
              <label>Judul Impian</label>
              <input type="text" id="impianJudul" class="form-control" placeholder="Contoh: Beli Rumah">
            </div>
            <div class="mb-3">
              <label>Kategori</label>
              <select id="impianKategori" class="form-select">
                <option value="Rumah">🏠 Rumah</option>
                <option value="Kendaraan">🚗 Kendaraan</option>
                <option value="Travel">✈️ Travel</option>
                <option value="Pendidikan">📚 Pendidikan</option>
                <option value="Bisnis">💼 Bisnis</option>
                <option value="Lainnya">✨ Lainnya</option>
              </select>
            </div>
            <div class="mb-3">
              <label>Target Nominal (Opsional)</label>
              <input type="number" id="impianTarget" class="form-control" placeholder="Rp">
            </div>
            <div class="mb-3">
              <label>Progress (%)</label>
              <input type="range" id="impianProgress" class="form-range" min="0" max="100" value="0">
              <span id="progressValue" class="small">0%</span>
            </div>
            <div class="mb-3">
              <label>Deskripsi</label>
              <textarea id="impianDeskripsi" class="form-control" rows="3" placeholder="Ceritakan impianmu..."></textarea>
            </div>
            <div class="form-check">
              <input type="checkbox" id="impianTercapai" class="form-check-input">
              <label class="form-check-label">Sudah tercapai ✨</label>
            </div>
          </div>
          <div class="modal-footer border-0">
            <button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-purple rounded-pill" onclick="saveImpian()">Simpan</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  let modal = document.getElementById('impianModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('impianModal');
  }
  
  // If edit, load data
  if (editId) {
    loadImpianData(editId);
  }
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

window.saveImpian = async function() {
  const editId = document.getElementById('impianEditId').value;
  const judul = document.getElementById('impianJudul').value;
  const kategori = document.getElementById('impianKategori').value;
  const target = parseInt(document.getElementById('impianTarget').value) || 0;
  const progress = parseInt(document.getElementById('impianProgress').value);
  const deskripsi = document.getElementById('impianDeskripsi').value;
  const tercapai = document.getElementById('impianTercapai').checked;
  
  if (!judul) {
    showNotif("Judul impian harus diisi", true, 'error');
    return;
  }
  
  const currentUser = sessionStorage.getItem("progrowth_user");
  const impianData = { judul, kategori, target, progress, deskripsi, tercapai, updatedAt: Date.now() };
  
  if (editId) {
    await update(ref(db, `data/impian/${currentUser}/${editId}`), impianData);
    showNotif("Impian berhasil diupdate", false, 'success');
  } else {
    impianData.createdAt = Date.now();
    await push(ref(db, `data/impian/${currentUser}`), impianData);
    showNotif("Impian baru ditambahkan! 🎯", false, 'success');
  }
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('impianModal'));
  if (modal) modal.hide();
};

window.editImpian = function(id) {
  openImpianModal(id);
};

window.deleteImpian = async function(id) {
  const currentUser = sessionStorage.getItem("progrowth_user");
  await remove(ref(db, `data/impian/${currentUser}/${id}`));
  showNotif("Impian dihapus", false, 'warning');
};

async function loadImpianData(id) {
  const currentUser = sessionStorage.getItem("progrowth_user");
  const snapshot = await get(ref(db, `data/impian/${currentUser}/${id}`));
  const data = snapshot.val();
  
  if (data) {
    document.getElementById('impianJudul').value = data.judul || '';
    document.getElementById('impianKategori').value = data.kategori || 'Lainnya';
    document.getElementById('impianTarget').value = data.target || '';
    document.getElementById('impianProgress').value = data.progress || 0;
    document.getElementById('progressValue').innerHTML = `${data.progress || 0}%`;
    document.getElementById('impianDeskripsi').value = data.deskripsi || '';
    document.getElementById('impianTercapai').checked = data.tercapai || false;
  }
}

// Progress slider event
document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('input', (e) => {
    if (e.target.id === 'impianProgress') {
      const val = e.target.value;
      const span = document.getElementById('progressValue');
      if (span) span.innerHTML = `${val}%`;
    }
  });
});

window.initImpian = initImpian;
