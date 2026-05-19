// js/dashboard.js
import { masterData, formatNumberRp, showNotif } from './utils.js';
import { db, ref, get, set } from './firebase-config.js';

let weddingDate = null;
let anniversaryDate = null;

export async function renderDashboard() {
  if (!masterData) return;
  
  const moments = masterData.moments || {};
  const momentsArray = Object.values(moments);
  const totalMoments = momentsArray.length;
  const specialMoments = momentsArray.filter(m => m.isSpecial).length;
  
  // Load saved dates
  await loadSavedDates();
  
  // Hitung hari bersama (dari momen pertama atau default)
  let daysTogether = 0;
  if (momentsArray.length > 0) {
    const sortedMoments = momentsArray.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const firstMomentDate = sortedMoments[0]?.date;
    if (firstMomentDate) {
      const firstDate = new Date(firstMomentDate);
      const today = new Date();
      daysTogether = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));
    }
  }
  
  // Hitung menuju pernikahan
  let daysToWedding = null;
  if (weddingDate) {
    const today = new Date();
    const wedding = new Date(weddingDate);
    daysToWedding = Math.ceil((wedding - today) / (1000 * 60 * 60 * 24));
  }
  
  // Render Ringkasan Hubungan
  const summaryContainer = document.getElementById('relationshipSummary');
  if (summaryContainer) {
    summaryContainer.innerHTML = `
      <div class="col-md-3 col-6">
        <div class="card p-3 text-center hover-card">
          <i class="bi bi-calendar-heart-fill fs-2 text-danger mb-2"></i>
          <h2 class="fw-bold mb-0">${daysTogether}</h2>
          <small class="text-muted">Hari Bersama</small>
        </div>
      </div>
      <div class="col-md-3 col-6">
        <div class="card p-3 text-center hover-card" onclick="openWeddingDateModal()">
          <i class="bi bi-ring-fill fs-2 text-purple mb-2"></i>
          <h2 class="fw-bold mb-0">${daysToWedding !== null ? daysToWedding : '?'}</h2>
          <small class="text-muted">${daysToWedding !== null ? 'Menuju Pernikahan' : 'Klik atur tanggal'}</small>
        </div>
      </div>
      <div class="col-md-3 col-6">
        <div class="card p-3 text-center hover-card" onclick="openBirthdayModal()">
          <i class="bi bi-gift-fill fs-2 text-pink mb-2"></i>
          <h2 class="fw-bold mb-0">${getBirthdayCountdown()}</h2>
          <small class="text-muted">Menuju Ulang Tahun</small>
        </div>
      </div>
      <div class="col-md-3 col-6">
        <div class="card p-3 text-center hover-card">
          <i class="bi bi-star-fill fs-2 text-warning mb-2"></i>
          <h2 class="fw-bold mb-0">${totalMoments}</h2>
          <small class="text-muted">Total Momen (${specialMoments} spesial)</small>
        </div>
      </div>
    `;
  }
  
  // Render Recent Moments
  const recentContainer = document.getElementById('recentMomentsPreview');
  if (recentContainer) {
    const recentMoments = momentsArray.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 3);
    
    if (recentMoments.length === 0) {
      recentContainer.innerHTML = `<div class="col-12 text-center text-muted py-3">Belum ada momen. Yuk tambah momen spesial!</div>`;
    } else {
      recentContainer.innerHTML = recentMoments.map(moment => `
        <div class="col-md-4 col-6">
          <div class="moment-card h-100" onclick="window.selectMomentDate('${moment.date}')">
            ${moment.photos && moment.photos[0] 
              ? `<img src="${moment.photos[0]}" class="moment-image" style="height: 120px;">` 
              : `<div class="moment-image-placeholder" style="height: 120px;"><i class="bi bi-camera-fill"></i></div>`}
            <div class="p-2">
              <h6 class="fw-bold mb-0 small">${escapeHtml(moment.title || 'Momen')}</h6>
              <small class="text-muted">${moment.date || ''}</small>
            </div>
          </div>
        </div>
      `).join('');
    }
  }
}

async function loadSavedDates() {
  const currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  try {
    const snapshot = await get(ref(db, `data/settings/${currentUser}`));
    const settings = snapshot.val() || {};
    weddingDate = settings.weddingDate || null;
    anniversaryDate = settings.anniversaryDate || null;
  } catch (err) {
    console.error("Error loading dates:", err);
  }
}

function getBirthdayCountdown() {
  const birthday = localStorage.getItem('partnerBirthday');
  if (!birthday) return '?';
  
  const today = new Date();
  const birthdayDate = new Date(birthday);
  birthdayDate.setFullYear(today.getFullYear());
  
  if (birthdayDate < today) {
    birthdayDate.setFullYear(today.getFullYear() + 1);
  }
  
  const diffTime = Math.abs(birthdayDate - today);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Modal functions
window.openWeddingDateModal = function() {
  const modalHtml = `
    <div class="modal fade" id="weddingDateModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0">
            <h5 class="fw-bold">Tanggal Pernikahan</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <input type="date" id="weddingDateInput" class="form-control rounded-3" value="${weddingDate || ''}">
          </div>
          <div class="modal-footer border-0">
            <button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-primary rounded-pill" onclick="saveWeddingDate()">Simpan</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  let modal = document.getElementById('weddingDateModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('weddingDateModal');
  }
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

window.saveWeddingDate = async function() {
  const date = document.getElementById('weddingDateInput').value;
  const currentUser = sessionStorage.getItem("progrowth_user");
  
  if (date && currentUser) {
    await set(ref(db, `data/settings/${currentUser}/weddingDate`), date);
    weddingDate = date;
    showNotif("✅ Tanggal pernikahan disimpan", false, 'success');
    const modal = bootstrap.Modal.getInstance(document.getElementById('weddingDateModal'));
    if (modal) modal.hide();
    renderDashboard();
  }
};

window.openBirthdayModal = function() {
  const currentBirthday = localStorage.getItem('partnerBirthday') || '';
  const modalHtml = `
    <div class="modal fade" id="birthdayModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0">
            <h5 class="fw-bold">Ulang Tahun Partner</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <input type="date" id="birthdayModalInput" class="form-control rounded-3" value="${currentBirthday}">
          </div>
          <div class="modal-footer border-0">
            <button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-primary rounded-pill" onclick="saveBirthdayFromModal()">Simpan</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  let modal = document.getElementById('birthdayModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('birthdayModal');
  }
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

window.saveBirthdayFromModal = function() {
  const date = document.getElementById('birthdayModalInput').value;
  if (date) {
    localStorage.setItem('partnerBirthday', date);
    showNotif("✅ Ulang tahun partner disimpan", false, 'success');
    const modal = bootstrap.Modal.getInstance(document.getElementById('birthdayModal'));
    if (modal) modal.hide();
    renderDashboard();
  }
};

window.renderDashboard = renderDashboard;
