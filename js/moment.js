// js/moment.js
import { db, ref, push, update, remove } from './firebase-config.js';
import { masterData, escapeHtml, showNotif, compressImage } from './utils.js';

let currentViewDate = new Date();
let currentDetailMomentId = null;
let currentMomentPhotos = [];

function renderPhotoGrid() {
  const grid = document.getElementById('photoUploadGrid');
  if (!grid) return;
  
  const existingPhotos = currentMomentPhotos.map((photo, idx) => `
    <div class="photo-preview-item">
      <img src="${photo}" alt="Preview">
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
  const remainingSlots = 5 - currentMomentPhotos.length;
  
  if (files.length > remainingSlots) {
    showNotif(`❌ Maksimal 5 foto, tersisa ${remainingSlots} slot`, true);
    input.value = '';
    return;
  }
  
  showNotif('📸 Memproses foto...');
  
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) {
      showNotif(`❌ Foto ${file.name} terlalu besar (max 5MB)`, true);
      continue;
    }
    
    try {
      const compressed = await compressImage(file, 2);
      currentMomentPhotos.push(compressed);
    } catch (err) {
      console.error('Compression error:', err);
    }
  }
  
  input.value = '';
  renderPhotoGrid();
  if (files.length > 0) {
    showNotif(`✅ ${files.length} foto berhasil ditambahkan`);
  }
}

export function removePhotoAtIndex(index) {
  currentMomentPhotos.splice(index, 1);
  renderPhotoGrid();
  showNotif('🗑️ Foto dihapus');
}

export function renderCalendar() {
  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  const monthYearEl = document.getElementById('currentMonthYear');
  if (monthYearEl) monthYearEl.innerHTML = `${monthNames[month]} ${year}`;
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const moments = masterData?.moments || {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  
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
  
  grid.innerHTML = calendarHtml;
}

export function renderMomentsList() {
  const data = masterData;
  if (!data) return;
  
  const moments = data.moments || {};
  const momentsListEl = document.getElementById('momentsList');
  const momentsCountEl = document.getElementById('momentsCount');
  if (!momentsListEl) return;
  
  const momentsArray = Object.entries(moments).map(([id, m]) => ({ id, ...m }));
  
  momentsArray.sort((a, b) => {
    if (a.isSpecial && !b.isSpecial) return -1;
    if (!a.isSpecial && b.isSpecial) return 1;
    return (b.date || '').localeCompare(a.date || '');
  });
  
  if (momentsCountEl) momentsCountEl.innerHTML = `${momentsArray.length} momen`;
  
  if (momentsArray.length === 0) {
    momentsListEl.innerHTML = `
      <div class="col-12">
        <div class="text-center py-5">
          <i class="bi bi-calendar-heart fs-1 text-muted"></i>
          <h6 class="mt-2">Belum ada momen</h6>
          <p class="text-muted small">Klik tanggal pada kalender untuk menambah momen</p>
        </div>
      </div>
    `;
    return;
  }
  
  momentsListEl.innerHTML = momentsArray.map((moment) => {
    const specialClass = moment.isSpecial ? 'special-card' : '';
    const firstPhoto = moment.photos && moment.photos[0] ? moment.photos[0] : null;
    const dateFormatted = moment.date ? moment.date.split('-').reverse().join('/') : '';
    
    return `
      <div class="col-6 col-lg-3 col-md-4 mb-3">
        <div class="moment-card ${specialClass} h-100" onclick="window.viewMomentDetail('${moment.id}')">
          ${firstPhoto ? `<img src="${firstPhoto}" class="moment-image" loading="lazy" style="height: 140px; width: 100%; object-fit: cover;">` : `<div class="moment-image-placeholder" style="height: 140px;"><i class="bi bi-camera-fill"></i></div>`}
          <div class="card-body p-2">
            <h6 class="fw-bold mb-0 small">${escapeHtml(moment.title || 'Momen Tak Terlupakan')}</h6>
            <small class="text-muted" style="font-size: 10px;">${dateFormatted}</small>
          </div>
        </div>
      </div>
    `;
  }).join('');
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
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('momentModal'));
    if (modal) modal.hide();
    
    renderCalendar();
    renderMomentsList();
  } catch (err) {
    console.error(err);
    showNotif('❌ Gagal menyimpan momen', true);
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
        <img src="${photo}" style="width:100%; max-height: 300px; object-fit: contain;">
      </div>
    `).join('');
    
    const carouselElement = document.getElementById('detailCarousel');
    if (carouselElement && typeof bootstrap !== 'undefined') {
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
  
  showConfirmDialog('Hapus Momen', 'Yakin ingin menghapus momen ini? Data yang dihapus tidak dapat dikembalikan.', async () => {
    try {
      await remove(ref(db, `data/moments/${currentDetailMomentId}`));
      showNotif('🗑️ Momen berhasil dihapus');
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('momentDetailModal'));
      if (modal) modal.hide();
      
      renderCalendar();
      renderMomentsList();
    } catch (err) {
      console.error(err);
      showNotif('❌ Gagal menghapus momen', true);
    }
  });
}

function showConfirmDialog(title, message, onConfirm) {
  let confirmModal = document.getElementById('customConfirmModal');
  
  if (!confirmModal) {
    const modalHtml = `
      <div class="modal fade" id="customConfirmModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content rounded-4">
            <div class="modal-header border-0 pt-4 pb-0">
              <h5 class="fw-bold mb-0">${title}</h5>
            </div>
            <div class="modal-body text-center py-3">
              <i class="bi bi-question-circle fs-1 text-warning mb-2 d-block"></i>
              <p class="mb-0">${message}</p>
            </div>
            <div class="modal-footer border-0 justify-content-center gap-3 pb-4">
              <button class="btn btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Batal</button>
              <button id="confirmDeleteActionBtn" class="btn btn-danger rounded-pill px-4">Hapus</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    confirmModal = document.getElementById('customConfirmModal');
  }
  
  confirmModal.querySelector('.modal-header .fw-bold').innerText = title;
  confirmModal.querySelector('.modal-body p').innerHTML = message;
  
  const modal = new bootstrap.Modal(confirmModal);
  
  const handleConfirm = () => {
    modal.hide();
    onConfirm();
  };
  
  const freshConfirmBtn = document.getElementById('confirmDeleteActionBtn');
  freshConfirmBtn.replaceWith(freshConfirmBtn.cloneNode(true));
  const newConfirmBtn = document.getElementById('confirmDeleteActionBtn');
  newConfirmBtn.addEventListener('click', handleConfirm, { once: true });
  
  modal.show();
}

export function changeMonth(delta) {
  currentViewDate = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + delta, 1);
  renderCalendar();
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
