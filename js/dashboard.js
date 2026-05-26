// js/dashboard.js - Versi revisi: dengan fitur pencarian momen
import { masterData, formatNumberRp, showNotif, escapeHtml } from './utils.js';
import { db, ref, get } from './firebase-config.js';

let currentUser = null;
let searchTimeout = null;

export async function renderDashboard() {
  if (!masterData) return;
  
  currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  const moments = masterData.moments || {};
  const momentsArray = Object.values(moments);
  
  const keuanganData = await getKeuanganPerUser();
  
  // Render Ringkasan Keuangan Per User
  const keuanganContainer = document.getElementById('keuanganSummary');
  if (keuanganContainer && keuanganData) {
    keuanganContainer.innerHTML = `
      <div class="row g-3">
        <div class="col-6">
          <div class="card p-3 h-100" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <small class="opacity-75">Saldo Fachmi</small>
                <h4 class="fw-bold mb-0">${formatNumberRp(keuanganData.fachmi.saldo)}</h4>
                <small class="opacity-75">Pemasukan: ${formatNumberRp(keuanganData.fachmi.pemasukan)}</small>
              </div>
              <i class="bi bi-person-circle fs-1 opacity-50"></i>
            </div>
          </div>
        </div>
        <div class="col-6">
          <div class="card p-3 h-100" style="background: linear-gradient(135deg, #ec4899, #f43f5e); color: white;">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <small class="opacity-75">Saldo Azizah</small>
                <h4 class="fw-bold mb-0">${formatNumberRp(keuanganData.azizah.saldo)}</h4>
                <small class="opacity-75">Pemasukan: ${formatNumberRp(keuanganData.azizah.pemasukan)}</small>
              </div>
              <i class="bi bi-person-circle fs-1 opacity-50"></i>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Render Recent Moments dengan fitur pencarian
  const recentContainer = document.getElementById('recentMomentsPreview');
  if (recentContainer) {
    // Tambahkan input pencarian di dashboard
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
    
    // Fungsi render momen dengan filter
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
            ${recentMoments.map(moment => `
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
            `).join('')}
          </div>
        `;
      }
    };
    
    // Event listener untuk search dengan debounce
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

async function getKeuanganPerUser() {
  try {
    const [fachmiTransaksi, azizahTransaksi] = await Promise.all([
      get(ref(db, `data/keuangan/FACHMI/transaksi`)),
      get(ref(db, `data/keuangan/AZIZAH/transaksi`))
    ]);
    
    const fachmiData = fachmiTransaksi.val() || {};
    const azizahData = azizahTransaksi.val() || {};
    
    const fachmiList = Object.values(fachmiData);
    const azizahList = Object.values(azizahData);
    
    const fachmiPemasukan = fachmiList.filter(t => t.tipe === 'pemasukan').reduce((sum, t) => sum + (t.nominal || 0), 0);
    const fachmiPengeluaran = fachmiList.filter(t => t.tipe === 'pengeluaran').reduce((sum, t) => sum + (t.nominal || 0), 0);
    const azizahPemasukan = azizahList.filter(t => t.tipe === 'pemasukan').reduce((sum, t) => sum + (t.nominal || 0), 0);
    const azizahPengeluaran = azizahList.filter(t => t.tipe === 'pengeluaran').reduce((sum, t) => sum + (t.nominal || 0), 0);
    
    return {
      fachmi: { saldo: fachmiPemasukan - fachmiPengeluaran, pemasukan: fachmiPemasukan, pengeluaran: fachmiPengeluaran },
      azizah: { saldo: azizahPemasukan - azizahPengeluaran, pemasukan: azizahPemasukan, pengeluaran: azizahPengeluaran }
    };
  } catch (err) {
    console.error("Error loading keuangan:", err);
    return {
      fachmi: { saldo: 0, pemasukan: 0, pengeluaran: 0 },
      azizah: { saldo: 0, pemasukan: 0, pengeluaran: 0 }
    };
  }
}

window.renderDashboard = renderDashboard;
