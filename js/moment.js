// js/moment.js - Optimasi dengan Lazy Loading + Calendar Cache + Filter Tanggal
import { db, ref, push, update, remove } from './firebase-config.js';
import { 
  masterData, escapeHtml, showNotif, compressImage, showCustomConfirm, 
  throttle, showLoading, hideLoading, validateAndCompressPhotos
} from './utils.js';

let currentViewDate = new Date();
let currentDetailMomentId = null;
let currentMomentPhotos = [];
let isRenderingCalendar = false;
let currentMonthFilter = null;
let currentYearFilter = null;

// Calendar cache
let cachedCalendarHtml = null;
let cachedMonthYear = null;
let cachedMomentsHash = null;

function getMomentsHash(moments) {
  const momentKeys = Object.keys(moments).sort();
  return JSON.stringify(momentKeys.map(key => moments[key].date));
}

function renderPhotoGrid() {
  const grid = document.getElementById('photoUploadGrid');
  if (!grid) return;
  
  const existingPhotos = currentMomentPhotos.map((photo, idx) => `
    <div class="photo-preview-item">
      <img src="${photo}" alt="Preview" loading="lazy">
      <button class="remove-photo-btn" onclick="window.removePhotoAtIndex(${idx})">✕</button>
    </div>
  `).join('');
  
  const addButton = currentMomentPhotos.length < 5 ? `
    <div class="photo-upload-item" onclick="document.getElementById('momentPhotoInput').click()">
      <i class="bi bi-plus-circle-fill"></i>
      <span>Tambah Foto</span>
    </div>
  ` : '';
  
  grid.innerHTML = existingPhotos + addButton;
}

export async function handleMultiplePhotos(input) {
  const files = Array.from(input.files);
  
  if (files.length === 0) return;
  
  // Gunakan validasi dari utils
  const compressedPhotos = await validateAndCompressPhotos(files, 2, 5 - currentMomentPhotos.length);
  
  if (compressedPhotos) {
    currentMomentPhotos.push(...compressedPhotos);
    renderPhotoGrid();
    showNotif(`✅ ${compressedPhotos.length} foto berhasil ditambahkan`);
  }
  
  input.value = '';
}

export function removePhotoAtIndex(index) {
  currentMomentPhotos.splice(index, 1);
  renderPhotoGrid();
  showNotif('🗑️ Foto dihapus');
}

export function renderCalendar() {
  if (isRenderingCalendar) return;
  
  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();
  const moments = masterData?.moments || {};
  const cacheKey = `${year}-${month}`;
  const currentMomentsHash = getMomentsHash(moments);
  
  if (cachedCalendarHtml && cachedMonthYear === cacheKey && cachedMomentsHash === currentMomentsHash) {
    console.log("Using cached calendar for", cacheKey);
    const grid = document.getElementById('calendarGrid');
    if (grid) {
      grid.innerHTML = cachedCalendarHtml;
    }
    isRenderingCalendar = false;
    
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthYearEl = document.getElementById('currentMonthYear');
    if (monthYearEl) monthYearEl.innerHTML = `${monthNames[month]} ${year}`;
    return;
  }
  
  isRenderingCalendar = true;
  
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  const monthYearEl = document.getElementById('currentMonthYear');
  if (monthYearEl) monthYearEl.innerHTML = `${monthNames[month]} ${year}`;
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const grid = document.getElementById('calendarGrid');
  if (!grid) {
    isRenderingCalendar = false;
    return;
  }
  
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  let calendarHtml = dayNames.map(day => `<div class="calendar-day-name">${day}</div>`).join('');
  
  let date = 1;
  let nextMonthDate = 1;
  
  for (let i = 0; i < 42; i++) {
    let cellDate = null;
    let isCurrentMonth = true;
    let cellYear = year;
    let cellMonth = month;
    
    if (i < firstDay) {
      cellDate = prevMonthDays - (firstDay - i) + 1;
      isCurrentMonth = false;
      cellYear = month === 0 ? year - 1 : year;
      cellMonth = month === 0 ? 11 : month - 1;
    } else if (date <= daysInMonth) {
      cellDate = date;
      isCurrentMonth = true;
      date++;
    } else {
      cellDate = nextMonthDate;
      isCurrentMonth = false;
      cellYear = month === 11 ? year + 1 : year;
      cellMonth = month === 11 ? 0 : month + 1;
      nextMonthDate++;
    }
    
    const dateKey = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(cellDate).padStart(2, '0')}`;
    const momentOnDate = Object.values(moments).find(m => m.date === dateKey);
    const hasMoment = !!momentOnDate;
    const isSpecial = momentOnDate?.isSpecial || false;
    const isToday = cellYear === today.getFullYear() && cellMonth === today.getMonth() && cellDate === today.getDate();
    
    let cellClass = `calendar-day ${!isCurrentMonth ? 'other-month' : ''}`;
    if (isToday && isCurrentMonth) cellClass += ' today';
    if (hasMoment && isCurrentMonth) cellClass += ' has-moment';
    if (isSpecial && isCurrentMonth) cellClass += ' special-moment';
    
    const momentIndicator = hasMoment ? `<span class="moment-love">❤️</span>` : '';
    
    calendarHtml += `
      <div class="${cellClass}" onclick="window.selectMomentDate('${dateKey}')">
        <span class="day-number">${cellDate}</span>
        ${momentIndicator}
      </div>
    `;
  }
  
  cachedCalendarHtml = calendarHtml;
  cachedMonthYear = cacheKey;
  cachedMomentsHash = currentMomentsHash;
  
  grid.innerHTML = calendarHtml;
  isRenderingCalendar = false;
}

export function clearCalendarCache() {
  cachedCalendarHtml = null;
  cachedMonthYear = null;
  cachedMomentsHash = null;
  console.log("Calendar cache cleared");
}

// FITUR FILTER TANGGAL DI MOMEN
function initMomentFilters() {
  const filterContainer = document.getElementById('momentFilters');
  if (!filterContainer) return;
  
  filterContainer.innerHTML = `
    <div class="row g-2 mb-3">
      <div class="col-6">
        <select id="momentMonthFilter" class="form-select form-select-sm rounded-pill">
          <option value="">Semua Bulan</option>
          <option value="1">Januari</option>
          <option value="2">Februari</option>
          <option value="3">Maret</option>
          <option value="4">April</option>
          <option value="5">Mei</option>
          <option value="6">Juni</option>
          <option value="7">Juli</option>
          <option value="8">Agustus</option>
          <option value="9">September</option>
          <option value="10">Oktober</option>
          <option value="11">November</option>
          <option value="12">Desember</option>
        </select>
      </div>
      <div class="col-6">
        <select id="momentYearFilter" class="form-select form-select-sm rounded-pill">
          <option value="">Semua Tahun</option>
        </select>
      </div>
    </div>
  `;
  
  // Populate tahun
  const yearSelect = document.getElementById('momentYearFilter');
  if (yearSelect) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
      yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
    }
  }
  
  // Event listeners
  const monthFilter = document.getElementById('momentMonthFilter');
  const yearFilter = document.getElementById('momentYearFilter');
  
  if (monthFilter) monthFilter.addEventListener('change', () => applyMomentFilters());
  if (yearFilter) yearFilter.addEventListener('change', () => applyMomentFilters());
}

function applyMomentFilters() {
  const monthFilter = document.getElementById('momentMonthFilter')?.value;
  const yearFilter = document.getElementById('momentYearFilter')?.value;
  
  currentMonthFilter = monthFilter ? parseInt(monthFilter) : null;
  currentYearFilter = yearFilter ? parseInt(yearFilter) : null;
  
  renderMomentsList();
}

const throttledRenderMoments = throttle(() => {
  renderMomentsList();
}, 500);

export function renderMomentsList() {
  const data = masterData;
  if (!data) return;
  
  const moments = data.moments || {};
  const momentsListEl = document.getElementById('momentsList');
  const momentsCountEl = document.getElementById('momentsCount');
  if (!momentsListEl) return;
  
  let momentsArray = Object.entries(moments).map(([id, m]) => ({ id, ...m }));
  
  // Filter berdasarkan bulan dan tahun
  if (currentMonthFilter || currentYearFilter) {
    momentsArray = momentsArray.filter(m => {
      if (!m.date) return false;
      const [year, month] = m.date.split('-');
      if (currentYearFilter && parseInt(year) !== currentYearFilter) return false;
      if (currentMonthFilter && parseInt(month) !== currentMonthFilter) return false;
      return true;
    });
  }
  
  momentsArray.sort((a, b) => {
    if (a.isSpecial && !b.isSpecial) return -1;
    if (!a.isSpecial && b.isSpecial) return 1;
    return (b.date || '').localeCompare(a.date || '');
  });
  
  if (momentsCountEl) {
    const filterText = (currentMonthFilter || currentYearFilter) ? ' (terfilter)' : '';
    momentsCountEl.innerHTML = `${momentsArray.length} momen${filterText}`;
  }
  
  if (momentsArray.length === 0) {
    momentsListEl.innerHTML = `
      <div class="col-12">
        <div class="text-center py-5">
          <i class="bi bi-calendar-heart fs-1 text-muted"></i>
          <h6 class="mt-2">${(currentMonthFilter || currentYearFilter) ? 'Tidak ada momen untuk filter ini' : 'Belum ada momen'}</h6>
          <p class="text-muted small">${(currentMonthFilter || currentYearFilter) ? 'Coba pilih filter lain' : 'Klik tanggal pada kalender untuk menambah momen'}</p>
        </div>
      </div>
    `;
    return;
  }
  
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  
  momentsArray.forEach((moment) => {
    const specialClass = moment.isSpecial ? 'special-card' : '';
    const firstPhoto = moment.photos && moment.photos[0] ? moment.photos[0] : null;
    const dateFormatted = moment.date ? moment.date.split('-').reverse().join('/') : '';
    
    tempDiv.innerHTML = `
      <div class="col-6 col-lg-3 col-md-4 mb-3">
        <div class="moment-card ${specialClass} h-100" onclick="window.viewMomentDetail('${moment.id}')">
          ${firstPhoto ? `<img src="${firstPhoto}" class="moment-image" loading="lazy" style="height: 120px; width: 100%; object-fit: cover;" onerror="this.src='https://placehold.co/400x300?text=No+Image'">` : `<div class="moment-image-placeholder" style="height: 120px;"><i class="bi bi-camera-fill"></i></div>`}
          <div class="card-body p-2">
            <h6 class="fw-bold mb-0 small">${escapeHtml(moment.title || 'Momen')}</h6>
            <small class="text-muted" style="font-size: 10px;">${dateFormatted}</small>
          </div>
        </div>
      </div>
    `;
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }
  });
  
  momentsListEl.innerHTML = '';
  momentsListEl.appendChild(fragment);
}

export function selectMomentDate(dateKey) {
  const data = masterData;
  const moments = data?.moments || {};
  const existingEntry = Object.entries(moments).find(([id, m]) => m.date === dateKey);
  
  if (existingEntry) {
    viewMomentDetail(existingEntry[0]);
  } else {
    document.getElementById('momentEditId').value = '';
    document.getElementById('momentDate').value = dateKey;
    document.getElementById('momentTitle').value = '';
    document.getElementById('momentStory').value = '';
    document.getElementById('momentIsSpecial').checked = false;
    currentMomentPhotos = [];
    renderPhotoGrid();
    document.getElementById('momentModalTitle').innerText = 'Tambah Momen Baru';
    const modal = new bootstrap.Modal(document.getElementById('momentModal'));
    modal.show();
  }
}

export function openMomentModal(momentId) {
  if (!momentId) {
    document.getElementById('momentModalTitle').innerText = 'Tambah Momen Baru';
    document.getElementById('momentEditId').value = '';
    if (!document.getElementById('momentDate').value) {
      document.getElementById('momentDate').value = new Date().toISOString().split('T')[0];
    }
    document.getElementById('momentTitle').value = '';
    document.getElementById('momentStory').value = '';
    document.getElementById('momentIsSpecial').checked = false;
    currentMomentPhotos = [];
    renderPhotoGrid();
  } else {
    document.getElementById('momentModalTitle').innerText = 'Edit Momen';
    const data = masterData;
    const moment = data?.moments?.[momentId];
    if (moment) {
      document.getElementById('momentEditId').value = momentId;
      document.getElementById('momentDate').value = moment.date || '';
      document.getElementById('momentTitle').value = moment.title || '';
      document.getElementById('momentStory').value = moment.story || '';
      document.getElementById('momentIsSpecial').checked = moment.isSpecial || false;
      currentMomentPhotos = moment.photos ? [...moment.photos] : [];
      renderPhotoGrid();
    }
  }
  
  const modal = new bootstrap.Modal(document.getElementById('momentModal'));
  modal.show();
}

export async function saveMoment() {
  const editId = document.getElementById('momentEditId').value;
  const date = document.getElementById('momentDate').value;
  const title = document.getElementById('momentTitle').value;
  const story = document.getElementById('momentStory').value;
  const isSpecial = document.getElementById('momentIsSpecial').checked;
  const currentUser = sessionStorage.getItem('progrowth_user');
  
  if (!date) {
    showNotif('❌ Tanggal harus diisi', true);
    return;
  }
  
  if (currentMomentPhotos.length === 0) {
    showNotif('❌ Minimal upload 1 foto', true);
    return;
  }
  
  showLoading("Menyimpan momen...");
  
  const momentData = {
    date: date,
    title: title || `Momen di ${date}`,
    story: story || '',
    isSpecial: isSpecial,
    photos: currentMomentPhotos,
    author: currentUser,
    updatedAt: Date.now()
  };
  
  try {
    if (!editId) {
      momentData.createdAt = Date.now();
      await push(ref(db, 'data/moments'), momentData);
      showNotif('✅ Momen berhasil ditambahkan! 🎉');
    } else {
      const existing = masterData?.moments?.[editId];
      momentData.createdAt = existing?.createdAt || Date.now();
      await update(ref(db, `data/moments/${editId}`), momentData);
      showNotif('✏️ Momen berhasil diperbarui! ✨');
    }
    
    clearCalendarCache();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('momentModal'));
    if (modal) modal.hide();
    
    renderCalendar();
    renderMomentsList();
  } catch (err) {
    console.error(err);
    showNotif('❌ Gagal menyimpan momen', true);
  } finally {
    hideLoading();
  }
}

export async function viewMomentDetail(momentId) {
  currentDetailMomentId = momentId;
  const data = masterData;
  const moment = data?.moments?.[momentId];
  
  if (!moment) return;
  
  document.getElementById('detailTitle').innerHTML = escapeHtml(moment.title || 'Momen Spesial');
  document.getElementById('detailDate').innerHTML = moment.date || '';
  document.getElementById('detailStory').innerHTML = escapeHtml(moment.story || 'Tidak ada cerita.').replace(/\n/g, '<br>');
  document.getElementById('detailAuthor').innerHTML = moment.author || '';
  document.getElementById('detailMood').innerHTML = moment.isSpecial ? '⭐ Momen Spesial' : '❤️ Momen Berkesan';
  
  const carouselInner = document.getElementById('detailCarouselInner');
  const photos = moment.photos || [];
  
  if (photos.length === 0) {
    carouselInner.innerHTML = `
      <div class="carousel-item active">
        <div class="d-flex align-items-center justify-content-center" style="height: 250px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <i class="bi bi-camera-fill text-white" style="font-size: 48px;"></i>
        </div>
      </div>
    `;
  } else {
    carouselInner.innerHTML = photos.map((photo, idx) => `
      <div class="carousel-item ${idx === 0 ? 'active' : ''}">
        <img src="${photo}" style="width:100%; max-height: 300px; object-fit: contain;" loading="lazy">
      </div>
    `).join('');
    
    const carouselElement = document.getElementById('detailCarousel');
    if (carouselElement && typeof bootstrap !== 'undefined') {
      const existingCarousel = bootstrap.Carousel.getInstance(carouselElement);
      if (existingCarousel) existingCarousel.dispose();
      new bootstrap.Carousel(carouselElement, { interval: false });
    }
  }
  
  const modal = new bootstrap.Modal(document.getElementById('momentDetailModal'));
  modal.show();
}

export function editMomentFromDetail() {
  const detailModal = bootstrap.Modal.getInstance(document.getElementById('momentDetailModal'));
  if (detailModal) detailModal.hide();
  
  setTimeout(() => {
    openMomentModal(currentDetailMomentId);
  }, 300);
}

export async function deleteMomentFromDetail() {
  if (!currentDetailMomentId) return;
  
  const confirmed = await showCustomConfirm("Hapus Momen", "Yakin ingin menghapus momen ini? Data yang dihapus tidak dapat dikembalikan.");
  if (confirmed) {
    showLoading("Menghapus momen...");
    try {
      await remove(ref(db, `data/moments/${currentDetailMomentId}`));
      showNotif('🗑️ Momen berhasil dihapus');
      
      clearCalendarCache();
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('momentDetailModal'));
      if (modal) modal.hide();
      
      renderCalendar();
      renderMomentsList();
    } catch (err) {
      console.error(err);
      showNotif('❌ Gagal menghapus momen', true);
    } finally {
      hideLoading();
    }
  }
}

export function changeMonth(delta) {
  currentViewDate = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + delta, 1);
  renderCalendar();
}

// Tambahkan filter container ke content.html moment page
export function addFilterToMomentPage() {
  const momentContainer = document.getElementById('moment-page');
  if (!momentContainer) return;
  
  const filterSection = document.createElement('div');
  filterSection.id = 'momentFilters';
  filterSection.className = 'mb-3';
  
  const calendarCard = momentContainer.querySelector('.card.border-0.shadow-sm.mb-4');
  if (calendarCard) {
    calendarCard.insertAdjacentElement('afterend', filterSection);
    initMomentFilters();
  }
}

// Exports
window.renderCalendar = renderCalendar;
window.renderMomentsList = renderMomentsList;
window.selectMomentDate = selectMomentDate;
window.openMomentModal = openMomentModal;
window.handleMultiplePhotos = handleMultiplePhotos;
window.removePhotoAtIndex = removePhotoAtIndex;
window.saveMoment = saveMoment;
window.viewMomentDetail = viewMomentDetail;
window.editMomentFromDetail = editMomentFromDetail;
window.deleteMomentFromDetail = deleteMomentFromDetail;
window.changeMonth = changeMonth;
window.clearCalendarCache = clearCalendarCache;
window.addFilterToMomentPage = addFilterToMomentPage;
