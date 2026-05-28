// js/dashboard.js - Dengan shared data per pasangan
import { formatNumberRp, showNotif, escapeHtml, currentPartner, currentPairId,
  getSharedMoments, getSharedKeuangan } from './utils.js';
import { db, ref, get } from './firebase-config.js';

let currentUser = null;
let searchTimeout = null;

export async function renderDashboard() {
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  // Get shared moments
  const moments = await getSharedMoments();
  const momentsArray = Object.values(moments);
  
  // Get shared keuangan
  const keuangan = await getSharedKeuangan();
  const transaksiList = Object.values(keuangan.transaksi || {});
  
  const pemasukan = transaksiList.filter(t => t.tipe === 'pemasukan').reduce((sum, t) => sum + (t.nominal || 0), 0);
  const pengeluaran = transaksiList.filter(t => t.tipe === 'pengeluaran').reduce((sum, t) => sum + (t.nominal || 0), 0);
  const saldo = pemasukan - pengeluaran;
  
  const partnerName = currentPartner === "FACHMI" ? "Fachmi" : currentPartner === "AZIZAH" ? "Azizah" : currentPartner;
  
  // Render Ringkasan Keuangan Pasangan
  const keuanganContainer = document.getElementById('keuanganSummary');
  if (keuanganContainer) {
    keuanganContainer.innerHTML = `
      <div class="row g-3">
        <div class="col-12">
          <div class="card p-3" style="background: linear-gradient(135deg, #7009b4, #4000C6); color: white;">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <small class="opacity-75">Total Saldo Pasangan</small>
                <h4 class="fw-bold mb-0">${formatNumberRp(saldo)}</h4>
                <small class="opacity-75">Total Pemasukan: ${formatNumberRp(pemasukan)}</small>
                <br>
                <small class="opacity-75">Total Pengeluaran: ${formatNumberRp(pengeluaran)}</small>
              </div>
              <i class="bi bi-people-fill fs-1 opacity-50"></i>
            </div>
          </div>
        </div>
        <div class="col-12">
          <div class="card p-3" style="background: linear-gradient(135deg, #ec4899, #f43f5e); color: white;">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <small class="opacity-75">ID Pasangan</small>
                <h6 class="fw-bold mb-0">${currentPairId || '-'}</h6>
                <small class="opacity-75">${partnerName ? `Pasangan: ${partnerName}` : 'Belum memiliki pasangan'}</small>
              </div>
              <i class="bi bi-heart-fill fs-1 opacity-50"></i>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Render Recent Moments dengan fitur pencarian
  const recentContainer = document.getElementById('recentMomentsPreview');
  if (recentContainer) {
    const searchHtml = `
      <div class="mb-3">
        <div class="input-group">
          <span class="input-group-text bg-transparent border-end-0 rounded-pill">
            <i class="bi bi-search"></i>
          </span>
          <input type="text" id="dashboardSearchMoment" class="form-control border-start-0 rounded-pill" 
                 placeholder="Cari momen berdasarkan judul atau cerita..." style="border-left: none;">
        </div>
      </div>
      <div id="dashboardMomentsList"></div>
    `;
    
    recentContainer.innerHTML = searchHtml;
    
    const searchInput = document.getElementById('dashboardSearchMoment');
    const momentsListDiv = document.getElementById('dashboardMomentsList');
    
    const renderFilteredMoments = (searchTerm = '') => {
      let filteredMoments = [...momentsArray];
      
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filteredMoments = filteredMoments.filter(m => 
          (m.title && m.title.toLowerCase().includes(term)) ||
          (m.story && m.story.toLowerCase().includes(term))
        );
      }
      
      const recentMoments = filteredMoments
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 6);
      
      if (recentMoments.length === 0) {
        momentsListDiv.innerHTML = `<div class="col-12 text-center text-muted py-4">
          ${searchTerm ? 'Tidak ada momen yang cocok dengan pencarian.' : 'Belum ada momen. Yuk tambah momen spesial bersama pasangan!'}
        </div>`;
      } else {
        momentsListDiv.innerHTML = `
          <div class="row g-2">
            ${recentMoments.map(moment => {
              const authorName = moment.createdBy === "FACHMI" ? "Fachmi" : moment.createdBy === "AZIZAH" ? "Azizah" : moment.createdBy;
              return `
              <div class="col-4">
                <div class="moment-card h-100" onclick="window.selectMomentDate('${moment.date}')" style="cursor: pointer;">
                  ${moment.photos && moment.photos[0] 
                    ? `<img src="${moment.photos[0]}" class="moment-image" style="height: 100px; width: 100%; object-fit: cover;">` 
                    : `<div class="moment-image-placeholder" style="height: 100px;"><i class="bi bi-camera-fill"></i></div>`}
                  <div class="p-2 text-center">
                    <small class="fw-bold d-block text-truncate">${escapeHtml(moment.title || 'Momen')}</small>
                    <small class="text-muted">${moment.date || ''}</small>
                    <small class="text-muted d-block" style="font-size: 9px;">dibuat oleh: ${escapeHtml(authorName)}</small>
                  </div>
                </div>
              </div>
            `}).join('')}
          </div>
        `;
      }
    };
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          renderFilteredMoments(e.target.value);
        }, 300);
      });
    }
    
    renderFilteredMoments();
  }
}

window.renderDashboard = renderDashboard;
