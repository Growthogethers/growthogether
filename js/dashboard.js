// js/dashboard.js - Versi revisi: dengan fitur pencarian momen dan partner
import { masterData, formatNumberRp, showNotif, escapeHtml, currentPartner, filterMomentsByUser } from './utils.js';
import { db, ref, get } from './firebase-config.js';

let currentUser = null;
let searchTimeout = null;

export async function renderDashboard() {
  if (!masterData) return;
  
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  const moments = masterData.filteredMoments || masterData.moments || {};
  const momentsArray = Object.values(moments);
  
  const myKeuangan = await getKeuanganForUser(currentUser);
  const partnerName = currentPartner === "FACHMI" ? "Fachmi" : currentPartner === "AZIZAH" ? "Azizah" : currentPartner;
  
  const keuanganContainer = document.getElementById('keuanganSummary');
  if (keuanganContainer && myKeuangan) {
    keuanganContainer.innerHTML = `
      <div class="row g-3">
        <div class="col-12">
          <div class="card p-3" style="background: linear-gradient(135deg, #7009b4, #4000C6); color: white;">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <small class="opacity-75">Total Saldo Anda</small>
                <h4 class="fw-bold mb-0">${formatNumberRp(myKeuangan.saldo)}</h4>
                <small class="opacity-75">Pemasukan: ${formatNumberRp(myKeuangan.pemasukan)}</small>
                <br>
                <small class="opacity-75">Pengeluaran: ${formatNumberRp(myKeuangan.pengeluaran)}</small>
              </div>
              <i class="bi bi-person-circle fs-1 opacity-50"></i>
            </div>
          </div>
        </div>
        ${currentPartner ? `
        <div class="col-12">
          <div class="card p-3" style="background: linear-gradient(135deg, #ec4899, #f43f5e); color: white;">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <small class="opacity-75">Saldo ${partnerName || 'Partner'}</small>
                <h4 class="fw-bold mb-0">${formatNumberRp(myKeuangan.partnerSaldo || 0)}</h4>
                <small class="opacity-75">Pemasukan: ${formatNumberRp(myKeuangan.partnerPemasukan || 0)}</small>
              </div>
              <i class="bi bi-person-heart fs-1 opacity-50"></i>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
    `;
  }
  
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
          ${searchTerm ? 'Tidak ada momen yang cocok dengan pencarian.' : 'Belum ada momen. Yuk tambah momen spesial!'}
        </div>`;
      } else {
        momentsListDiv.innerHTML = `
          <div class="row g-2">
            ${recentMoments.map(moment => {
              const authorName = moment.author === "FACHMI" ? "Fachmi" : moment.author === "AZIZAH" ? "Azizah" : moment.author;
              return `
              <div class="col-4">
                <div class="moment-card h-100" onclick="window.selectMomentDate('${moment.date}')" style="cursor: pointer;">
                  ${moment.photos && moment.photos[0] 
                    ? `<img src="${moment.photos[0]}" class="moment-image" style="height: 100px; width: 100%; object-fit: cover;">` 
                    : `<div class="moment-image-placeholder" style="height: 100px;"><i class="bi bi-camera-fill"></i></div>`}
                  <div class="p-2 text-center">
                    <small class="fw-bold d-block text-truncate">${escapeHtml(moment.title || 'Momen')}</small>
                    <small class="text-muted">${moment.date || ''}</small>
                    <small class="text-muted d-block" style="font-size: 9px;">oleh: ${escapeHtml(authorName)}</small>
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

async function getKeuanganForUser(username) {
  try {
    const transSnap = await get(ref(db, `data/keuangan/${username}/transaksi`));
    const trans = transSnap.val() || {};
    const transList = Object.values(trans);
    
    const pemasukan = transList.filter(t => t.tipe === 'pemasukan').reduce((sum, t) => sum + (t.nominal || 0), 0);
    const pengeluaran = transList.filter(t => t.tipe === 'pengeluaran').reduce((sum, t) => sum + (t.nominal || 0), 0);
    const saldo = pemasukan - pengeluaran;
    
    let partnerSaldo = 0;
    let partnerPemasukan = 0;
    let partnerPengeluaran = 0;
    if (currentPartner) {
      const partnerTransSnap = await get(ref(db, `data/keuangan/${currentPartner}/transaksi`));
      const partnerTrans = partnerTransSnap.val() || {};
      const partnerList = Object.values(partnerTrans);
      partnerPemasukan = partnerList.filter(t => t.tipe === 'pemasukan').reduce((sum, t) => sum + (t.nominal || 0), 0);
      partnerPengeluaran = partnerList.filter(t => t.tipe === 'pengeluaran').reduce((sum, t) => sum + (t.nominal || 0), 0);
      partnerSaldo = partnerPemasukan - partnerPengeluaran;
    }
    
    return { saldo, pemasukan, pengeluaran, partnerSaldo, partnerPemasukan, partnerPengeluaran };
  } catch (err) {
    console.error("Error loading keuangan:", err);
    return { saldo: 0, pemasukan: 0, pengeluaran: 0, partnerSaldo: 0, partnerPemasukan: 0, partnerPengeluaran: 0 };
  }
}

window.renderDashboard = renderDashboard;
