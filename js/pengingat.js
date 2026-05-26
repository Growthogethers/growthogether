// js/pengingat.js - Versi revisi: dengan notifikasi ulang tahun
import { db, ref, get, set } from './firebase-config.js';
import { showNotif } from './utils.js';

let currentUser = null;
let birthdayCheckInterval = null;

// Inisialisasi
export function initPengingat() {
  console.log("Pengingat module loaded (birthday with notifications)");
  startBirthdayChecker();
}

// Start periodic birthday check
function startBirthdayChecker() {
  if (birthdayCheckInterval) clearInterval(birthdayCheckInterval);
  
  // Cek setiap 1 jam
  birthdayCheckInterval = setInterval(() => {
    checkUpcomingBirthdays();
  }, 60 * 60 * 1000);
  
  // Cek saat inisialisasi
  setTimeout(() => checkUpcomingBirthdays(), 2000);
}

// Stop birthday checker
export function stopBirthdayChecker() {
  if (birthdayCheckInterval) {
    clearInterval(birthdayCheckInterval);
    birthdayCheckInterval = null;
  }
}

// Simpan birthday ke database
export async function saveBirthday(userId, birthdayDate) {
  if (!userId || !birthdayDate) return;
  
  try {
    await set(ref(db, `data/birthdays/${userId}`), {
      date: birthdayDate,
      updatedAt: Date.now()
    });
    
    localStorage.setItem(`partnerBirthday_${userId}`, birthdayDate);
    
    showNotif("✅ Tanggal ulang tahun disimpan", false, 'success');
    return true;
  } catch (err) {
    console.error("Error saving birthday:", err);
    showNotif("❌ Gagal menyimpan tanggal ulang tahun", true, 'error');
    return false;
  }
}

// Ambil birthday dari database
export async function getBirthday(userId) {
  try {
    const snapshot = await get(ref(db, `data/birthdays/${userId}`));
    const data = snapshot.val();
    if (data && data.date) return data.date;
    
    return localStorage.getItem(`partnerBirthday_${userId}`) || null;
  } catch (err) {
    console.error("Error getting birthday:", err);
    return localStorage.getItem(`partnerBirthday_${userId}`) || null;
  }
}

// Hitung countdown ulang tahun
export function getBirthdayCountdown(birthdayDate) {
  if (!birthdayDate) return null;
  
  const today = new Date();
  const birthday = new Date(birthdayDate);
  birthday.setFullYear(today.getFullYear());
  
  if (birthday < today) {
    birthday.setFullYear(today.getFullYear() + 1);
  }
  
  const diffTime = Math.abs(birthday - today);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Format tanggal
function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${parts[2]} ${bulan[parseInt(parts[1]) - 1]} ${parts[0]}`;
  }
  return dateStr;
}

// CEK DAN TAMPILKAN NOTIFIKASI ULANG TAHUN
export async function checkUpcomingBirthdays() {
  const currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  const partnerUser = currentUser === "FACHMI" ? "AZIZAH" : "FACHMI";
  const partnerBirthday = await getBirthday(partnerUser);
  const partnerName = partnerUser === "FACHMI" ? "Fachmi" : "Azizah";
  const currentUserName = currentUser === "FACHMI" ? "Fachmi" : "Azizah";
  
  if (partnerBirthday) {
    const countdown = getBirthdayCountdown(partnerBirthday);
    const formattedDate = formatDate(partnerBirthday);
    
    // Notifikasi H-7, H-3, H-1, dan hari H
    if (countdown !== null) {
      const lastNotified = localStorage.getItem(`birthday_notified_${partnerUser}_${countdown}`);
      const today = new Date().toDateString();
      
      if (countdown === 0 && lastNotified !== today) {
        // Hari ini ulang tahun!
        showNotif(`🎂🎉 SELAMAT ULANG TAHUN ${partnerName}! 🎉🎂\nJangan lupa beri kejutan spesial! ❤️`, false, 'success');
        localStorage.setItem(`birthday_notified_${partnerUser}_${countdown}`, today);
        
        // Trigger confetti untuk suasana meriah
        if (typeof window.triggerConfetti === 'function') {
          setTimeout(() => window.triggerConfetti(), 500);
        }
      } 
      else if (countdown === 1 && lastNotified !== today) {
        showNotif(`🎂 H-1 ulang tahun ${partnerName}! Besok adalah hari spesial! Siapkan kejutan! 🎁`, false, 'warning');
        localStorage.setItem(`birthday_notified_${partnerUser}_${countdown}`, today);
      }
      else if (countdown === 3 && lastNotified !== today) {
        showNotif(`🎂 H-3 ulang tahun ${partnerName}! Waktunya mempersiapkan hadiah spesial! 🎁`, false, 'info');
        localStorage.setItem(`birthday_notified_${partnerUser}_${countdown}`, today);
      }
      else if (countdown === 7 && lastNotified !== today) {
        showNotif(`🎂 H-7 ulang tahun ${partnerName}! Mulai rencanakan kejutan untuk pasanganmu! 💝`, false, 'info');
        localStorage.setItem(`birthday_notified_${partnerUser}_${countdown}`, today);
      }
    }
  }
  
  // Cek juga birthday user sendiri untuk ditampilkan di profile
  const myBirthday = await getBirthday(currentUser);
  if (myBirthday) {
    const myCountdown = getBirthdayCountdown(myBirthday);
    if (myCountdown === 0) {
      showNotif(`🎂 Selamat ulang tahun ${currentUserName}! Semoga hari ini menyenangkan! 🎉`, false, 'success');
    }
  }
}

// Tampilkan birthday di profile modal
export async function renderBirthdayInProfile() {
  const currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  const partnerUser = currentUser === "FACHMI" ? "AZIZAH" : "FACHMI";
  const partnerBirthday = await getBirthday(partnerUser);
  const partnerName = partnerUser === "FACHMI" ? "Fachmi" : "Azizah";
  
  const birthdayContainer = document.getElementById('profileBirthdaySection');
  if (!birthdayContainer) return;
  
  if (partnerBirthday) {
    const countdown = getBirthdayCountdown(partnerBirthday);
    const formattedDate = formatDate(partnerBirthday);
    let countdownText = '';
    let countdownClass = '';
    
    if (countdown !== null) {
      if (countdown === 0) {
        countdownText = 'Hari ini! 🎉🎂';
        countdownClass = 'text-danger fw-bold';
      } else if (countdown <= 7) {
        countdownText = `${countdown} hari lagi 🎂`;
        countdownClass = 'text-warning fw-bold';
      } else {
        countdownText = `${countdown} hari lagi 🎂`;
        countdownClass = 'text-primary';
      }
    }
    
    birthdayContainer.innerHTML = `
      <div class="mb-3">
        <label class="form-label fw-semibold small text-muted">
          <i class="bi bi-gift me-1"></i> Ulang Tahun Partner
        </label>
        <div class="d-flex align-items-center justify-content-between bg-light p-2 rounded-3">
          <div>
            <span class="fw-medium">${partnerName}</span>
            <small class="text-muted d-block">${formattedDate}</small>
            ${countdown !== null ? `<small class="${countdownClass}">${countdownText}</small>` : ''}
          </div>
          <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="openBirthdayEditModal()">
            <i class="bi bi-pencil"></i>
          </button>
        </div>
      </div>
    `;
  } else {
    birthdayContainer.innerHTML = `
      <div class="mb-3">
        <label class="form-label fw-semibold small text-muted">
          <i class="bi bi-gift me-1"></i> Ulang Tahun Partner
        </label>
        <div class="d-flex align-items-center justify-content-between bg-light p-2 rounded-3">
          <span class="text-muted">Belum diatur</span>
          <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="openBirthdayEditModal()">
            <i class="bi bi-plus"></i> Atur
          </button>
        </div>
      </div>
    `;
  }
}

// Modal edit birthday (dipanggil dari profile)
window.openBirthdayEditModal = async function() {
  const currentUser = sessionStorage.getItem("progrowth_user");
  const partnerUser = currentUser === "FACHMI" ? "AZIZAH" : "FACHMI";
  const partnerName = partnerUser === "FACHMI" ? "Fachmi" : "Azizah";
  const currentBirthday = await getBirthday(partnerUser) || '';
  
  const modalHtml = `
    <div class="modal fade" id="birthdayEditModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content rounded-4">
          <div class="modal-header border-0">
            <h5 class="fw-bold">Ulang Tahun ${partnerName}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <input type="date" id="birthdayEditInput" class="form-control rounded-3" value="${currentBirthday}">
            <small class="text-muted">Masukkan tanggal ulang tahun pasangan Anda</small>
          </div>
          <div class="modal-footer border-0">
            <button class="btn btn-secondary rounded-pill" data-bs-dismiss="modal">Batal</button>
            <button class="btn btn-primary rounded-pill" onclick="saveBirthdayFromProfile()">Simpan</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  let modal = document.getElementById('birthdayEditModal');
  if (!modal) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('birthdayEditModal');
  }
  
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
};

window.saveBirthdayFromProfile = async function() {
  const date = document.getElementById('birthdayEditInput').value;
  const currentUser = sessionStorage.getItem("progrowth_user");
  const partnerUser = currentUser === "FACHMI" ? "AZIZAH" : "FACHMI";
  
  if (date && partnerUser) {
    await saveBirthday(partnerUser, date);
    await renderBirthdayInProfile();
    
    // Cek ulang tahun setelah simpan
    setTimeout(() => checkUpcomingBirthdays(), 1000);
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('birthdayEditModal'));
    if (modal) modal.hide();
  }
};

window.initPengingat = initPengingat;
window.renderBirthdayInProfile = renderBirthdayInProfile;
window.checkUpcomingBirthdays = checkUpcomingBirthdays;
window.stopBirthdayChecker = stopBirthdayChecker;
