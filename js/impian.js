// js/impian.js - User Friendly dengan Visual Progress
import { db, ref, push, onValue, remove, update, get } from './firebase-config.js';
import { showNotif, formatNumberRp, escapeHtml } from './utils.js';

let currentUser = null;
let editImpianId = null;

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
    container.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-stars fs-1 text-muted"></i>
        <p class="mt-2 text-muted">Belum ada impian. Ayo tambah impianmu!</p>
        <button class="btn btn-purple rounded-pill mt-2" onclick="openImpianModal()">
          <i class="bi bi-plus-lg me-1"></i> Tambah Impian
        </button>
      </div>
    `;
    return;
  }
  
  const sortedImpian = impianList.sort((a, b) => {
    if (a.tercapai === b.tercapai) return (b.progress || 0) - (a.progress || 0);
    return a.tercapai ? 1 : -1;
  });
  
  container.innerHTML = sortedImpian.map(impian => `
    <div class="col-md-6 col-12 mb-3">
      <div class="card impian-card h-100 ${impian.tercapai ? 'achieved' : ''}" style="border-left: 4px solid ${impian.tercapai ? '#10b981' : '#8b5cf6'}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <span class="badge bg-purple mb-2">${escapeHtml(impian.kategori || 'Impian')}</span>
              <h6 class="fw-bold mb-1">${escapeHtml(impian.judul)}</h6>
              ${impian.target ? `<small class="text-muted">Target: ${formatNumberRp(impian.target)}</small>` : ''}
            </div>
            <div class="dropdown">
              <button class="btn-icon" data-bs-toggle="dropdown">
                <i class="bi bi-three-dots-vertical"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><a class="dropdown-item" onclick="editImpian('${impian.id}')"><i class="bi bi-pencil me-2"></i>Edit</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><a class="dropdown-item text-danger" onclick="deleteImpian('${impian.id}')"><i class="bi bi-trash3 me-2"></i>Hapus</a></li>
              </ul>
            </div>
          </div>
          ${impian.deskripsi ? `<p class="small text-muted mb-2">${escapeHtml(impian.deskripsi)}</p>` : ''}
          
          ${!impian.tercapai ? `
            <div class="mt-3">
              <div class="d-flex justify-content-between small mb-1">
                <span>Progress</span>
                <span>${impian.progress || 0}%</span>
              </div>
              <div class="progress" style="height: 6px;">
                <div class="progress-bar bg-purple" style="width: ${impian.progress || 0}%"></div>
              </div>
            </div>
          ` : `
            <div class="mt-3">
              <span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i> Tercapai! ✨</span>
            </div>
          `}
        </div>
      </div>
    </div>
  `).join('');
}

window.openImpianModal = function(editId = null) {
  editImpianId = editId;
  
  const modalHtml = `
    <div class="modal fade" id="impianModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0 bg-purple text-white">
            <h5 class="fw-bold mb-0">${editId ? '✏️ Edit Impian' : '⭐ Tambah Impian Baru'}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body modal-form p-4">
            <div class="mb-3">
              <label class="fw-semibold">Judul Impian</label>
              <input type="text" id="impianJudul" class="form-control" placeholder="Contoh: Beli Rumah Impian">
            </div>
            <div class="mb-3">
              <label class="fw-semibold">Kategori</label>
              <select id="impianKategori" class="form-select">
                <option value="Rumah">🏠 Rumah</option>
                <option value="Kendaraan">🚗 Kendaraan</option>
                <option value="Travel">✈️ Travel</option>
                <option value="Pendidikan">📚 Pendidikan</option>
                <option value="Bisnis">💼 Bisnis</option>
                <option value="Investasi">📈 Investasi</option>
                <option value="Lainnya">✨ Lainnya</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="fw-semibold">Target Nominal (Opsional)</label>
              <input type="number" id="impianTarget" class="form-control" placeholder="Rp">
            </div>
            <div class="mb-3">
              <label class="fw-semibold">Progress (0-100%)</label>
              <div class="d-flex align-items-center gap-3">
                <input type="range" id="impianProgress" class="form-range flex-grow-1" min="0" max="100" value="0">
                <span id="progressValue" class="fw-bold text-purple" style="min-width: 45px;">0%</span>
              </div>
            </div>
            <div class="mb-3">
              <label class="fw-semibold">Deskripsi / Cerita</label>
              <textarea id="impianDeskripsi" class="form-control" rows="3" placeholder="Ceritakan impianmu..."></textarea>
            </div>
            <div class="form-check">
              <input type="checkbox" id="impianTercapai" class="form-check-input">
              <label class="form-check-label">✨ Impian ini sudah tercapai</label>
            </div>
          </div>
          <div class="modal-footer border-0 pb-4">
            <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-purple rounded-pill px-4" onclick="saveImpian()">Simpan</button>
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
  
  if (editId) {
    loadImpianData(editId);
  }
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

async function loadImpianData(id) {
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

window.saveImpian = async function() {
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
  
  const impianData = { 
    judul, kategori, target, progress, deskripsi, tercapai, updatedAt: Date.now()
  };
  
  if (editImpianId) {
    await update(ref(db, `data/impian/${currentUser}/${editImpianId}`), impianData);
    showNotif("Impian berhasil diupdate", false, 'success');
    editImpianId = null;
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
  await remove(ref(db, `data/impian/${currentUser}/${id}`));
  showNotif("Impian dihapus", false, 'warning');
};

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
