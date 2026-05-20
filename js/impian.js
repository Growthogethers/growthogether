// js/impian.js - Dengan Rekomendasi AI & Koneksi Keuangan
import { db, ref, push, onValue, remove, update, get } from './firebase-config.js';
import { showNotif, formatNumberRp, escapeHtml } from './utils.js';

let currentUser = null;
let editImpianId = null;
let impianList = [];
let aiImpianRecommendations = [];

// AI Recommendation untuk Impian
function generateImpianRecommendations() {
  const recommendations = [];
  const totalTarget = impianList.reduce((sum, i) => sum + (i.target || 0), 0);
  const totalProgress = impianList.reduce((sum, i) => sum + ((i.progress || 0) * (i.target || 0) / 100), 0);
  const belumTercapai = impianList.filter(i => !i.tercapai && (i.progress || 0) < 100);
  
  if (belumTercapai.length > 0 && totalTarget > 0) {
    const persenProgress = (totalProgress / totalTarget) * 100;
    const sisaDana = totalTarget - totalProgress;
    
    recommendations.push({
      id: `reco_finance_${Date.now()}`,
      title: `💰 Dana untuk Impian: ${Math.round(persenProgress)}% terkumpul`,
      description: `Masih perlu Rp ${sisaDana.toLocaleString('id-ID')} untuk mencapai semua impian.`,
      action: "Atur Keuangan",
      actionLink: "keuangan"
    });
  }
  
  // Rekomendasi impian prioritas
  const prioritized = belumTercapai
    .filter(i => (i.progress || 0) > 50 && (i.progress || 0) < 100)
    .sort((a, b) => (b.progress || 0) - (a.progress || 0));
  
  if (prioritized.length > 0) {
    recommendations.push({
      id: `reco_priority_${Date.now()}`,
      title: `🎯 Fokus: ${escapeHtml(prioritized[0].judul)}`,
      description: `Impian ini sudah mencapai ${prioritized[0].progress || 0}%. Segera selesaikan!`,
      action: "Lihat Impian",
      impianId: prioritized[0].id
    });
  }
  
  // Rekomendasi inspirasi
  recommendations.push({
    id: `reco_inspire_${Date.now()}`,
    title: "✨ Inspirasi Impian Baru",
    description: "Pertimbangkan untuk menambah impian liburan bulan madu atau investasi properti.",
    action: "Tambah Impian",
    actionLink: "add"
  });
  
  return recommendations.slice(0, 3);
}

function renderAIImpianRecommendations() {
  const container = document.getElementById('aiImpianRecommendations');
  if (!container) return;
  
  aiImpianRecommendations = generateImpianRecommendations();
  
  if (aiImpianRecommendations.length === 0 || impianList.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted py-3">
        <i class="bi bi-robot fs-4"></i>
        <p class="small mb-0">Tambahkan impian untuk mendapatkan rekomendasi AI</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <div class="d-flex align-items-center gap-2 mb-2">
      <i class="bi bi-robot fs-5 text-purple"></i>
      <span class="fw-bold small">Rekomendasi AI untuk Impian Anda</span>
    </div>
    <div class="row g-2">
      ${aiImpianRecommendations.map(rec => `
        <div class="col-12 col-md-4">
          <div class="card border-0 bg-light p-2 h-100">
            <div class="d-flex flex-column">
              <div class="fw-semibold small">${rec.title}</div>
              <small class="text-muted">${rec.description}</small>
              <button class="btn btn-sm btn-outline-primary rounded-pill mt-2" 
                      onclick="applyImpianRecommendation('${rec.id}')">
                ${rec.action} <i class="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

window.applyImpianRecommendation = function(recommendationId) {
  const rec = aiImpianRecommendations.find(r => r.id === recommendationId);
  if (!rec) return;
  
  if (rec.actionLink === 'keuangan') {
    window.location.href = '#keuangan-page';
    showPage('keuangan');
  } else if (rec.actionLink === 'add') {
    openImpianModal();
  } else if (rec.impianId) {
    const impianElement = document.querySelector(`[data-impian-id="${rec.impianId}"]`);
    if (impianElement) {
      impianElement.scrollIntoView({ behavior: 'smooth' });
      impianElement.classList.add('border-purple', 'border-2');
      setTimeout(() => {
        impianElement.classList.remove('border-purple', 'border-2');
      }, 2000);
    }
  }
};

export function initImpian() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  injectAIImpianContainer();
  loadImpian();
}

function injectAIImpianContainer() {
  const impianPage = document.getElementById('impian-page');
  if (impianPage && !document.getElementById('aiImpianRecommendations')) {
    const aiContainer = document.createElement('div');
    aiContainer.id = 'aiImpianRecommendations';
    aiContainer.className = 'card p-3 mb-4';
    aiContainer.style.background = 'linear-gradient(135deg, #8b5cf615, #7c3aed15)';
    aiContainer.style.borderRadius = '16px';
    
    const header = impianPage.querySelector('.d-flex.justify-content-between');
    if (header && header.nextSibling) {
      impianPage.insertBefore(aiContainer, header.nextSibling);
    } else {
      impianPage.insertBefore(aiContainer, impianPage.firstChild);
    }
  }
}

function loadImpian() {
  onValue(ref(db, `data/impian/${currentUser}`), (snapshot) => {
    const data = snapshot.val() || {};
    impianList = Object.entries(data).map(([id, val]) => ({ id, ...val }));
    renderImpian(impianList);
    renderAIImpianRecommendations();
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
    <div class="col-md-6 col-12 mb-3" data-impian-id="${impian.id}">
      <div class="card impian-card h-100 ${impian.tercapai ? 'achieved' : ''}" style="border-left: 4px solid ${impian.tercapai ? '#10b981' : '#8b5cf6'}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <span class="badge bg-purple mb-2">${escapeHtml(impian.kategori || 'Impian')}</span>
              <h6 class="fw-bold mb-1">${escapeHtml(impian.judul)}</h6>
              ${impian.target ? `<small class="text-muted">Target: ${formatNumberRp(impian.target)}</small>` : ''}
              ${impian.terhubungKeuangan ? '<span class="badge bg-success ms-2"><i class="bi bi-wallet2 me-1"></i>Terhubung</span>' : ''}
            </div>
            <div class="dropdown">
              <button class="btn-icon" data-bs-toggle="dropdown">
                <i class="bi bi-three-dots-vertical"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><a class="dropdown-item" onclick="editImpian('${impian.id}')"><i class="bi bi-pencil me-2"></i>Edit</a></li>
                ${!impian.tercapai ? `<li><a class="dropdown-item" onclick="addImpianToKeuangan('${impian.id}')"><i class="bi bi-wallet2 me-2"></i>Tambahkan ke Keuangan</a></li>` : ''}
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
              ${impian.target ? `
                <div class="d-flex justify-content-between small mt-2">
                  <span>Terkumpul: ${formatNumberRp(((impian.progress || 0) * impian.target) / 100)}</span>
                  <span>Sisa: ${formatNumberRp(impian.target - (((impian.progress || 0) * impian.target) / 100))}</span>
                </div>
              ` : ''}
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

// Fungsi untuk menambah impian ke keuangan
window.addImpianToKeuangan = async function(impianId) {
  const impian = impianList.find(i => i.id === impianId);
  if (!impian || !impian.target) {
    showNotif("Impian ini tidak memiliki target nominal", true, 'error');
    return;
  }
  
  const sisaTarget = impian.target - (((impian.progress || 0) * impian.target) / 100);
  const nominal = prompt(`Masukkan nominal untuk "${impian.judul}"\nSisa target: Rp ${sisaTarget.toLocaleString('id-ID')}`, Math.min(sisaTarget, 1000000));
  
  if (nominal && !isNaN(nominal) && parseInt(nominal) > 0) {
    if (confirm(`Tambahkan keuangan untuk "${impian.judul}" sebesar Rp ${parseInt(nominal).toLocaleString('id-ID')}?`)) {
      await window.addTransaksiFromExternal(currentUser, {
        tipe: 'pengeluaran',
        kategori: impian.kategori || 'Impian',
        nominal: parseInt(nominal),
        catatan: `Dana untuk impian: ${impian.judul}`,
        fromImpian: true,
        sumber: impian.judul
      });
      
      // Update progress impian
      const progressTambahan = (parseInt(nominal) / impian.target) * 100;
      const newProgress = Math.min(100, (impian.progress || 0) + progressTambahan);
      const tercapai = newProgress >= 100;
      
      await update(ref(db, `data/impian/${currentUser}/${impianId}`), { 
        progress: Math.round(newProgress),
        tercapai: tercapai,
        terhubungKeuangan: true
      });
      
      showNotif(`✅ Dana untuk "${impian.judul}" ditambahkan! Progress: ${Math.round(newProgress)}%`, false, 'success');
    }
  }
};

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
                <option value="Travel">✈️ Travel / Bulan Madu</option>
                <option value="Pendidikan">📚 Pendidikan</option>
                <option value="Bisnis">💼 Bisnis</option>
                <option value="Investasi">📈 Investasi</option>
                <option value="Pernikahan">💍 Pernikahan</option>
                <option value="Lainnya">✨ Lainnya</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="fw-semibold">Target Nominal (Rp)</label>
              <input type="number" id="impianTarget" class="form-control" placeholder="Masukkan target nominal">
              <small class="text-muted">Target ini akan terhubung dengan menu Keuangan</small>
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
            <div class="form-check mt-2">
              <input type="checkbox" id="impianHubungkanKeuangan" class="form-check-input">
              <label class="form-check-label">🔗 Hubungkan dengan menu Keuangan (otomatis menambah transaksi)</label>
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
  const hubungkanKeuangan = document.getElementById('impianHubungkanKeuangan')?.checked || false;
  
  if (!judul) {
    showNotif("Judul impian harus diisi", true, 'error');
    return;
  }
  
  const impianData = { 
    judul, kategori, target, progress, deskripsi, tercapai, 
    terhubungKeuangan: false,
    updatedAt: Date.now()
  };
  
  if (editImpianId) {
    await update(ref(db, `data/impian/${currentUser}/${editImpianId}`), impianData);
    showNotif("Impian berhasil diupdate", false, 'success');
    editImpianId = null;
  } else {
    impianData.createdAt = Date.now();
    const newRef = await push(ref(db, `data/impian/${currentUser}`), impianData);
    
    // Jika hubungkan keuangan dan ada target, tambahkan ke transaksi
    if (hubungkanKeuangan && target > 0) {
      await window.addTransaksiFromExternal(currentUser, {
        tipe: 'pengeluaran',
        kategori: kategori,
        nominal: Math.round(target * (progress / 100)) || target,
        catatan: `Dana untuk impian: ${judul}`,
        fromImpian: true,
        sumber: judul
      });
      
      await update(ref(db, `data/impian/${currentUser}/${newRef.key}`), { terhubungKeuangan: true });
      showNotif(`🔗 Impian "${judul}" terhubung dengan Keuangan!`, false, 'success');
    } else {
      showNotif("Impian baru ditambahkan! 🎯", false, 'success');
    }
  }
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('impianModal'));
  if (modal) modal.hide();
};

window.editImpian = function(id) {
  openImpianModal(id);
};

window.deleteImpian = async function(id) {
  if (confirm("Yakin ingin menghapus impian ini?")) {
    await remove(ref(db, `data/impian/${currentUser}/${id}`));
    showNotif("Impian dihapus", false, 'warning');
  }
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
