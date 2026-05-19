// js/dashboard.js - Dengan Layout Grid yang Rapi
import { masterData, formatNumberRp, showNotif } from './utils.js';
import { db, ref, get, set } from './firebase-config.js';

let weddingDate = null;
let currentUser = null;

export async function renderDashboard() {
  if (!masterData) return;
  
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  const moments = masterData.moments || {};
  const momentsArray = Object.values(moments);
  const totalMoments = momentsArray.length;
  const specialMoments = momentsArray.filter(m => m.isSpecial).length;
  
  // Load saved dates for this user
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
    if (daysToWedding < 0) daysToWedding = 0;
  }
  
  // Hitung countdown ulang tahun
  const birthdayCountdown = getBirthdayCountdown();
  
  // Render Ringkasan Hubungan dengan Grid yang Rapi
  const summaryContainer = document.getElementById('relationshipSummary');
  if (summaryContainer) {
    summaryContainer.innerHTML = `
      <div class="col-6 col-md-3 mb-3">
        <div class="card p-3 text-center h-100 hover-card">
          <div class="mb-2">
            <i class="bi bi-calendar-heart-fill fs-1 text-danger"></i>
          </div>
          <h2 class="fw-bold mb-0 fs-3">${daysTogether}</h2>
          <small class="text-muted">Hari Bersama</small>
        </div>
      </div>
      <div class="col-6 col-md-3 mb-3">
        <div class="card p-3 text-center h-100 hover-card" style="cursor: pointer;" onclick="openWeddingDateModal()">
          <div class="mb-2">
            <i class="bi bi-ring-fill fs-1 text-purple"></i>
          </div>
          <h2 class="fw-bold mb-0 fs-3">${daysToWedding !== null ? daysToWedding : '?'}</h2>
          <small class="text-muted">${daysToWedding !== null ? 'Menuju Pernikahan' : 'Klik atur'}</small>
        </div>
      </div>
      <div class="col-6 col-md-3 mb-3">
        <div class="card p-3 text-center h-100 hover-card" style="cursor: pointer;" onclick="openBirthdayModal()">
          <div class="mb-2">
            <i class="bi bi-gift-fill fs-1 text-pink"></i>
          </div>
          <h2 class="fw-bold mb-0 fs-3">${birthdayCountdown}</h2>
          <small class="text-muted">Menuju Ulang Tahun</small>
        </div>
      </div>
      <div class="col-6 col-md-3 mb-3">
        <div class="card p-3 text-center h-100 hover-card">
          <div class="mb-2">
            <i class="bi bi-star-fill fs-1 text-warning"></i>
          </div>
          <h2 class="fw-bold mb-0 fs-3">${totalMoments}</h2>
          <small class="text-muted">Total Momen (${specialMoments}⭐)</small>
        </div>
      </div>
    `;
  }
  
  // Render Recent Moments
  const recentContainer = document.getElementById('recentMomentsPreview');
  if (recentContainer) {
    const recentMoments = momentsArray.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 3);
    
    if (recentMoments.length === 0) {
      recentContainer.innerHTML = `<div class="col-12 text-center text-muted py-4">Belum ada momen. Yuk tambah momen spesial!</div>`;
    } else {
      recentContainer.innerHTML = recentMoments.map(moment => `
        <div class="col-4">
          <div class="moment-card h-100" onclick="window.selectMomentDate('${moment.date}')" style="cursor: pointer;">
            ${moment.photos && moment.photos[0] 
              ? `<img src="${moment.photos[0]}" class="moment-image" style="height: 100px; width: 100%; object-fit: cover;">` 
              : `<div class="moment-image-placeholder" style="height: 100px;"><i class="bi bi-camera-fill"></i></div>`}
            <div class="p-2 text-center">
              <small class="fw-bold d-block text-truncate">${escapeHtml(moment.title || 'Momen')}</small>
              <small class="text-muted">${moment.date || ''}</small>
            </div>
          </div>
        </div>
      `).join('');
    }
  }
}

async function loadSavedDates() {
  if (!currentUser) return;
  
  try {
    const snapshot = await get(ref(db, `data/settings/${currentUser}`));
    const settings = snapshot.val() || {};
    weddingDate = settings.weddingDate || null;
  } catch (err) {
    console.error("Error loading dates:", err);
  }
}

function getBirthdayCountdown() {
  const birthday = localStorage.getItem(`partnerBirthday_${currentUser}`);
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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
            <small class="text-muted">Masukkan tanggal pernikahan yang direncanakan</small>
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
  const currentUser = sessionStorage.getItem("progrowth_user");
  const currentBirthday = localStorage.getItem(`partnerBirthday_${currentUser}`) || '';
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
            <small class="text-muted">Masukkan tanggal ulang tahun pasangan Anda</small>
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
  const currentUser = sessionStorage.getItem("progrowth_user");
  if (date && currentUser) {
    localStorage.setItem(`partnerBirthday_${currentUser}`, date);
    showNotif("✅ Ulang tahun partner disimpan", false, 'success');
    const modal = bootstrap.Modal.getInstance(document.getElementById('birthdayModal'));
    if (modal) modal.hide();
    renderDashboard();
  }
};

window.renderDashboard = renderDashboard;
