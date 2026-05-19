// js/auth.js - Dengan Fitur Profile
import { db, ref, get, update } from './firebase-config.js';
import { showNotif, setCurrentUser, compressImage } from './utils.js';

// Profile data storage
let currentProfilePhoto = null;
let currentStatus = 'merencanakan';

export async function handleLogin() {
  const u = document.getElementById("loginUser")?.value;
  const p = document.getElementById("loginPass")?.value;
  const errorDiv = document.getElementById("loginErrorMsg");
  const errorSpan = document.getElementById("errorText");
  
  if (!p || !p.trim()) { 
    if (errorSpan) errorSpan.innerText = "❌ Password tidak boleh kosong!"; 
    if (errorDiv) errorDiv.style.display = "block"; 
    showNotif("Password harus diisi", true); 
    return; 
  }
  
  try {
    const snap = await get(ref(db, `data/auth/${u}`));
    if (snap.val() === p) {
      setCurrentUser(u);
      sessionStorage.setItem("progrowth_user", u);
      
      // Load saved profile data
      await loadProfileData(u);
      
      if (window.setupAppSession) {
        window.setupAppSession(u);
      }
      showNotif(`Selamat datang, ${u}`);
    } else {
      if (errorSpan) errorSpan.innerText = "⚠️ Password salah!";
      if (errorDiv) errorDiv.style.display = "block";
      showNotif("Password salah!", true);
    }
  } catch (e) {
    if (errorSpan) errorSpan.innerText = "⚠️ Gagal koneksi.";
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Koneksi gagal", true);
  }
}

async function loadProfileData(username) {
  try {
    const profileSnap = await get(ref(db, `data/profiles/${username}`));
    const profile = profileSnap.val() || {};
    currentProfilePhoto = profile.photo || null;
    currentStatus = profile.status || 'merencanakan';
    return profile;
  } catch (err) {
    console.error("Error loading profile:", err);
    return {};
  }
}

export async function updateCloudPassword() {
  const p1 = document.getElementById("newPass")?.value;
  const p2 = document.getElementById("confirmPass")?.value;
  const currentUser = sessionStorage.getItem("progrowth_user");
  
  if (!currentUser) {
    showNotif("❌ Silakan login terlebih dahulu", true);
    return;
  }
  
  if (!p1 || p1.length < 4) {
    showNotif("❌ Password minimal 4 karakter", true);
    return;
  }
  
  if (p1 !== p2) {
    showNotif("❌ Password baru dan konfirmasi tidak sama", true);
    return;
  }
  
  try {
    await update(ref(db), { [`data/auth/${currentUser}`]: p1 });
    showNotif("✅ Password berhasil diubah!");
    
    document.getElementById("newPass").value = "";
    document.getElementById("confirmPass").value = "";
    
    const modal = bootstrap.Modal.getInstance(document.getElementById("passModal"));
    if (modal) modal.hide();
  } catch (err) {
    console.error(err);
    showNotif("❌ Gagal mengubah password", true);
  }
}

export async function updateProfilePhoto(photoBase64) {
  const currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  try {
    await update(ref(db), { [`data/profiles/${currentUser}/photo`]: photoBase64 });
    currentProfilePhoto = photoBase64;
    updateProfileUI();
    showNotif("✅ Foto profil berhasil diupdate!");
  } catch (err) {
    console.error(err);
    showNotif("❌ Gagal update foto", true);
  }
}

export async function updateStatus(status) {
  const currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  currentStatus = status;
  
  try {
    await update(ref(db), { [`data/profiles/${currentUser}/status`]: status });
    updateProfileUI();
    showNotif(`✅ Status berubah: ${getStatusText(status)}`);
  } catch (err) {
    console.error(err);
    showNotif("❌ Gagal update status", true);
  }
}

function getStatusText(status) {
  const statusMap = {
    merencanakan: "Merencanakan",
    online: "Online",
    sibuk: "Sibuk",
    liburan: "Liburan"
  };
  return statusMap[status] || status;
}

function updateProfileUI() {
  const currentUser = sessionStorage.getItem("progrowth_user");
  const displayName = currentUser === "FACHMI" ? "Fachmi" : "Azizah";
  
  // Update sidebar profile
  const profileAvatar = document.getElementById("profileAvatar");
  const profileName = document.getElementById("profileName");
  const profileStatusText = document.getElementById("profileStatusText");
  const profileStatusIndicator = document.getElementById("profileStatus");
  
  if (profileAvatar) {
    if (currentProfilePhoto) {
      profileAvatar.src = currentProfilePhoto;
    } else {
      profileAvatar.src = `https://ui-avatars.com/api/?background=6366f1&color=fff&bold=true&name=${displayName}`;
    }
  }
  
  if (profileName) profileName.innerText = displayName;
  if (profileStatusText) {
    profileStatusText.innerText = getStatusText(currentStatus);
    profileStatusText.className = `status-text ${currentStatus}`;
  }
  
  if (profileStatusIndicator) {
    profileStatusIndicator.className = `profile-status status-${currentStatus}`;
    const icon = currentStatus === 'online' ? 'bi-check-circle-fill' : 
                  currentStatus === 'sibuk' ? 'bi-clock-fill' :
                  currentStatus === 'liburan' ? 'bi-umbrella-fill' : 'bi-calendar-check-fill';
    profileStatusIndicator.innerHTML = `<i class="${icon}"></i>`;
  }
  
  // Update modal profile
  const modalAvatar = document.getElementById("modalProfileAvatar");
  const modalName = document.getElementById("modalProfileName");
  
  if (modalAvatar) {
    if (currentProfilePhoto) {
      modalAvatar.src = currentProfilePhoto;
    } else {
      modalAvatar.src = `https://ui-avatars.com/api/?background=fff&color=6366f1&bold=true&size=100&name=${displayName}`;
    }
  }
  
  if (modalName) modalName.innerText = displayName;
  
  // Update active status badge in modal
  document.querySelectorAll('.status-badge').forEach(badge => {
    const status = badge.getAttribute('data-status');
    if (status === currentStatus) {
      badge.classList.add('active');
    } else {
      badge.classList.remove('active');
    }
  });
}

export function openProfileModal() {
  updateProfileUI();
  const modalElement = document.getElementById("profileModal");
  if (modalElement) {
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
  }
}

export function openChangePasswordFromProfile() {
  // Close profile modal first
  const profileModal = bootstrap.Modal.getInstance(document.getElementById("profileModal"));
  if (profileModal) profileModal.hide();
  
  // Open password modal after delay
  setTimeout(() => {
    const passModalElement = document.getElementById("passModal");
    if (passModalElement) {
      const passModal = new bootstrap.Modal(passModalElement);
      passModal.show();
    }
  }, 300);
}

export async function handleProfilePhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  
  if (file.size > 2 * 1024 * 1024) {
    showNotif("❌ Foto maksimal 2MB", true);
    return;
  }
  
  showNotif("📸 Memproses foto...");
  
  try {
    const compressed = await compressImage(file, 1);
    await updateProfilePhoto(compressed);
    input.value = '';
  } catch (err) {
    console.error(err);
    showNotif("❌ Gagal upload foto", true);
  }
}

export function confirmLogout() {
  const modalEl = document.getElementById("confirmLogoutModal");
  if (modalEl) new bootstrap.Modal(modalEl).show();
}

export function handleLogout() {
  sessionStorage.removeItem("progrowth_user");
  setCurrentUser(null);
  currentProfilePhoto = null;
  currentStatus = 'merencanakan';
  
  const loginScreen = document.getElementById("login-screen");
  const sidebar = document.getElementById("app-sidebar");
  const appContent = document.getElementById("app-content");
  
  if (loginScreen) loginScreen.style.display = "flex";
  if (sidebar) sidebar.style.display = "none";
  if (appContent) appContent.style.display = "none";
  
  const loginPass = document.getElementById("loginPass");
  const loginErrorMsg = document.getElementById("loginErrorMsg");
  if (loginPass) loginPass.value = "";
  if (loginErrorMsg) loginErrorMsg.style.display = "none";
  
  showNotif("Anda telah keluar");
  
  const modal = bootstrap.Modal.getInstance(document.getElementById("confirmLogoutModal"));
  if (modal) modal.hide();
}

// Exports
window.handleLogin = handleLogin;
window.updateCloudPassword = updateCloudPassword;
window.confirmLogout = confirmLogout;
window.handleLogout = handleLogout;
window.openProfileModal = openProfileModal;
window.openChangePasswordFromProfile = openChangePasswordFromProfile;
window.handleProfilePhotoUpload = handleProfilePhotoUpload;
window.updateStatus = updateStatus;
