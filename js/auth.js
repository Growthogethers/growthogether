import { db, ref, get, update } from './firebase-config.js';
import { showNotif, setCurrentUser, compressImage } from './utils.js';

// ============ GLOBAL STATE PROFILE ============
let currentProfilePhoto = null;
let currentStatus = 'merencanakan';
let currentUserData = null;
let currentUsername = null;

// ============ RESET PROFILE STATE ============
function resetProfileState() {
  console.log("Resetting profile state...");
  currentProfilePhoto = null;
  currentStatus = 'merencanakan';
  currentUserData = null;
  currentUsername = null;
}

// ============ HELPER FUNCTIONS ============
function getCurrentSessionUser() {
  const user = sessionStorage.getItem("progrowth_user");
  if (user !== currentUsername) {
    if (user) {
      loadProfileData(user);
    }
  }
  return user;
}

function getDisplayName(username) {
  return username === "FACHMI" ? "Fachmi" : "Azizah";
}

function getStatusText(status) {
  const statusMap = {
    merencanakan: "sedang merencanakan",
    online: "online",
    sibuk: "sedang sibuk",
    liburan: "sedang liburan"
  };
  return statusMap[status] || status;
}

function shakeElement(element) {
  if (!element) return;
  element.style.animation = 'shake 0.3s ease-in-out';
  setTimeout(() => {
    if (element) element.style.animation = '';
  }, 300);
}

// ============ LOAD PROFILE DATA ============
async function loadProfileData(username) {
  try {
    console.log("Loading profile data for:", username);
    const profileSnap = await get(ref(db, `data/profiles/${username}`));
    const profile = profileSnap.val() || {};
    currentProfilePhoto = profile.photo || null;
    currentStatus = profile.status || 'merencanakan';
    currentUserData = profile;
    currentUsername = username;
    
    console.log("Profile loaded:", { username, status: currentStatus, hasPhoto: !!currentProfilePhoto });
    updateProfileUI();
    return profile;
  } catch (err) {
    console.error("Error loading profile:", err);
    return {};
  }
}

// ============ FORCE REFRESH PROFILE ============
export async function forceRefreshProfile() {
  const currentUser = getCurrentSessionUser();
  if (currentUser) {
    await loadProfileData(currentUser);
  }
}

// ============ UPDATE PROFILE UI ============
export function updateProfileUI() {
  const currentUser = getCurrentSessionUser();
  if (!currentUser) {
    console.log("No user logged in, skipping UI update");
    return;
  }
  
  const displayName = getDisplayName(currentUser);
  const statusText = getStatusText(currentStatus);
  
  console.log("Updating profile UI for:", displayName, "Status:", currentStatus);
  
  // Update sidebar profile
  const profileAvatar = document.getElementById("profileAvatar");
  const profileName = document.getElementById("profileName");
  const profileStatusText = document.getElementById("profileStatusText");
  const profileStatusIndicator = document.getElementById("profileStatus");
  
  if (profileAvatar) {
    if (currentProfilePhoto) {
      profileAvatar.src = currentProfilePhoto;
    } else {
      profileAvatar.src = `https://ui-avatars.com/api/?background=6366f1&color=fff&bold=true&size=80&name=${encodeURIComponent(displayName)}`;
    }
  }
  
  if (profileName) profileName.innerText = displayName;
  
  if (profileStatusText) {
    profileStatusText.innerText = statusText;
    profileStatusText.className = `status-text ${currentStatus}`;
  }
  
  if (profileStatusIndicator) {
    profileStatusIndicator.className = `profile-status status-${currentStatus}`;
    let iconClass = 'bi-calendar-check-fill';
    if (currentStatus === 'online') iconClass = 'bi-check-circle-fill';
    else if (currentStatus === 'sibuk') iconClass = 'bi-clock-fill';
    else if (currentStatus === 'liburan') iconClass = 'bi-umbrella-fill';
    profileStatusIndicator.innerHTML = `<i class="${iconClass}"></i>`;
  }
  
  // Update modal profile
  const modalAvatar = document.getElementById("modalProfileAvatar");
  const modalName = document.getElementById("modalProfileName");
  const modalEmail = document.getElementById("modalProfileEmail");
  
  if (modalAvatar) {
    if (currentProfilePhoto) {
      modalAvatar.src = currentProfilePhoto;
    } else {
      modalAvatar.src = `https://ui-avatars.com/api/?background=fff&color=6366f1&bold=true&size=100&name=${encodeURIComponent(displayName)}`;
    }
  }
  
  if (modalName) modalName.innerText = displayName;
  if (modalEmail) {
    const email = currentUser === "FACHMI" ? "fachmi@growthogether.com" : "azizah@growthogether.com";
    modalEmail.innerText = email;
  }
  
  // Update active status badge in modal
  document.querySelectorAll('.status-badge').forEach(badge => {
    const status = badge.getAttribute('data-status');
    if (status === currentStatus) {
      badge.classList.add('active');
    } else {
      badge.classList.remove('active');
    }
  });
  
  // Update greeting in dashboard
  const userGreet = document.getElementById("userGreet");
  if (userGreet) userGreet.innerText = displayName;
  
  // Update active user badge in sidebar
  const activeUserBadge = document.getElementById("activeUserBadge");
  if (activeUserBadge) activeUserBadge.innerText = displayName;
}

// ============ LOGIN HANDLER ============
export async function handleLogin() {
  const u = document.getElementById("loginUser")?.value;
  const p = document.getElementById("loginPass")?.value;
  const errorDiv = document.getElementById("loginErrorMsg");
  const errorSpan = document.getElementById("errorText");
  const loginBtn = document.querySelector(".login-btn");
  
  if (!p || !p.trim()) { 
    if (errorSpan) errorSpan.innerText = "❌ Password tidak boleh kosong!"; 
    if (errorDiv) errorDiv.style.display = "block"; 
    showNotif("Password harus diisi", true); 
    shakeElement(document.getElementById("loginPass"));
    return; 
  }
  
  resetProfileState();
  
  const originalBtnText = loginBtn ? loginBtn.innerHTML : 'Masuk';
  if (loginBtn) {
    loginBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Memeriksa...';
    loginBtn.disabled = true;
  }
  
  try {
    const snap = await get(ref(db, `data/auth/${u}`));
    if (snap.val() === p) {
      sessionStorage.clear();
      sessionStorage.setItem("progrowth_user", u);
      setCurrentUser(u);
      currentUsername = u;
      
      await loadProfileData(u);
      
      if (loginBtn) {
        loginBtn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Berhasil!';
        loginBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
      }
      
      setTimeout(() => {
        if (window.setupAppSession) {
          window.setupAppSession(u);
        }
      }, 500);
      
      showNotif(`Selamat datang, ${getDisplayName(u)} 🎉`);
    } else {
      if (loginBtn) {
        loginBtn.innerHTML = originalBtnText;
        loginBtn.disabled = false;
      }
      
      if (errorSpan) errorSpan.innerText = "⚠️ Password salah!";
      if (errorDiv) errorDiv.style.display = "block";
      shakeElement(document.getElementById("loginPass"));
      showNotif("Password salah! Coba lagi", true);
    }
  } catch (e) {
    if (loginBtn) {
      loginBtn.innerHTML = originalBtnText;
      loginBtn.disabled = false;
    }
    
    if (errorSpan) errorSpan.innerText = "⚠️ Gagal koneksi.";
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Koneksi gagal", true);
    console.error("Login error:", e);
  }
}

// ============ UPDATE PROFILE PHOTO ============
export async function updateProfilePhoto(photoBase64) {
  const currentUser = getCurrentSessionUser();
  if (!currentUser) {
    showNotif("❌ Silakan login terlebih dahulu", true);
    return;
  }
  
  try {
    await update(ref(db), { [`data/profiles/${currentUser}/photo`]: photoBase64 });
    currentProfilePhoto = photoBase64;
    updateProfileUI();
    showNotif("✅ Foto profil berhasil diupdate!");
    
    const modal = bootstrap.Modal.getInstance(document.getElementById("profileModal"));
    if (modal) modal.hide();
  } catch (err) {
    console.error(err);
    showNotif("❌ Gagal update foto", true);
  }
}

// ============ UPDATE STATUS ============
export async function updateStatus(status) {
  const currentUser = getCurrentSessionUser();
  if (!currentUser) {
    showNotif("❌ Silakan login terlebih dahulu", true);
    return;
  }
  
  currentStatus = status;
  
  try {
    await update(ref(db), { [`data/profiles/${currentUser}/status`]: status });
    updateProfileUI();
    showNotif(`✅ Status berubah: ${getStatusText(status)}`);
    
    document.querySelectorAll('.status-badge').forEach(badge => {
      const badgeStatus = badge.getAttribute('data-status');
      if (badgeStatus === status) {
        badge.classList.add('active');
      } else {
        badge.classList.remove('active');
      }
    });
  } catch (err) {
    console.error(err);
    showNotif("❌ Gagal update status", true);
  }
}

// ============ UPDATE PASSWORD ============
export async function updateCloudPassword() {
  const p1 = document.getElementById("newPass")?.value;
  const p2 = document.getElementById("confirmPass")?.value;
  const currentUser = getCurrentSessionUser();
  
  if (!currentUser) {
    showNotif("❌ Silakan login terlebih dahulu", true);
    return;
  }
  
  if (!p1 || p1.length < 4) {
    showNotif("❌ Password minimal 4 karakter", true);
    shakeElement(document.getElementById("newPass"));
    return;
  }
  
  if (p1 !== p2) {
    showNotif("❌ Password baru dan konfirmasi tidak sama", true);
    shakeElement(document.getElementById("confirmPass"));
    return;
  }
  
  const updateBtn = document.querySelector("#passModal .btn-primary");
  const originalText = updateBtn ? updateBtn.innerHTML : 'Update Password';
  
  if (updateBtn) {
    updateBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Menyimpan...';
    updateBtn.disabled = true;
  }
  
  try {
    await update(ref(db), { [`data/auth/${currentUser}`]: p1 });
    
    if (updateBtn) {
      updateBtn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Berhasil!';
      updateBtn.style.background = "#10b981";
    }
    
    showNotif("✅ Password berhasil diubah!");
    
    setTimeout(() => {
      const newPassInput = document.getElementById("newPass");
      const confirmPassInput = document.getElementById("confirmPass");
      if (newPassInput) newPassInput.value = "";
      if (confirmPassInput) confirmPassInput.value = "";
      
      const modal = bootstrap.Modal.getInstance(document.getElementById("passModal"));
      if (modal) modal.hide();
      
      if (updateBtn) {
        updateBtn.innerHTML = originalText;
        updateBtn.style.background = "";
        updateBtn.disabled = false;
      }
    }, 1000);
    
  } catch (err) {
    console.error(err);
    if (updateBtn) {
      updateBtn.innerHTML = originalText;
      updateBtn.disabled = false;
    }
    showNotif("❌ Gagal mengubah password", true);
  }
}

// ============ OPEN PROFILE MODAL ============
export function openProfileModal() {
  console.log("openProfileModal called");
  updateProfileUI();
  
  const modalElement = document.getElementById("profileModal");
  
  if (!modalElement) {
    console.error("profileModal element not found!");
    showNotif("❌ Modal profile tidak ditemukan", true);
    return;
  }
  
  if (typeof bootstrap === 'undefined') {
    console.error("Bootstrap not loaded!");
    showNotif("❌ Error: Bootstrap tidak terload", true);
    return;
  }
  
  try {
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
    console.log("Profile modal opened successfully");
  } catch (err) {
    console.error("Error opening modal:", err);
    showNotif("❌ Gagal membuka profile", true);
  }
}

// ============ OPEN CHANGE PASSWORD FROM PROFILE ============
export function openChangePasswordFromProfile() {
  console.log("openChangePasswordFromProfile called");
  
  const profileModal = bootstrap.Modal.getInstance(document.getElementById("profileModal"));
  if (profileModal) profileModal.hide();
  
  setTimeout(() => {
    const passModalElement = document.getElementById("passModal");
    if (passModalElement) {
      const passModal = new bootstrap.Modal(passModalElement);
      passModal.show();
    } else {
      console.error("passModal element not found!");
      showNotif("❌ Modal password tidak ditemukan", true);
    }
  }, 300);
}

// ============ HANDLE PROFILE PHOTO UPLOAD ============
export async function handleProfilePhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  
  if (file.size > 2 * 1024 * 1024) {
    showNotif("❌ Foto maksimal 2MB", true);
    input.value = '';
    return;
  }
  
  if (!file.type.startsWith('image/')) {
    showNotif("❌ Hanya file gambar yang diperbolehkan", true);
    input.value = '';
    return;
  }
  
  showNotif("📸 Memproses foto...");
  
  try {
    const compressed = await compressImage(file, 1);
    await updateProfilePhoto(compressed);
    input.value = '';
  } catch (err) {
    console.error("Upload error:", err);
    showNotif("❌ Gagal upload foto", true);
    input.value = '';
  }
}

// ============ LOGOUT FUNCTIONS ============
export function confirmLogout() {
  const modalEl = document.getElementById("confirmLogoutModal");
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

export function handleLogout() {
  console.log("Logging out...");
  
  const appContent = document.getElementById("app-content");
  if (appContent) {
    appContent.style.transition = 'all 0.3s';
    appContent.style.opacity = '0';
    appContent.style.transform = 'translateY(20px)';
  }
  
  setTimeout(() => {
    sessionStorage.removeItem("progrowth_user");
    setCurrentUser(null);
    resetProfileState();
    
    const loginPass = document.getElementById("loginPass");
    const loginErrorMsg = document.getElementById("loginErrorMsg");
    if (loginPass) loginPass.value = "";
    if (loginErrorMsg) loginErrorMsg.style.display = "none";
    
    const loginUserSelect = document.getElementById("loginUser");
    if (loginUserSelect) loginUserSelect.value = "FACHMI";
    
    const loginScreen = document.getElementById("login-screen");
    const sidebar = document.getElementById("app-sidebar");
    const appContentEl = document.getElementById("app-content");
    
    if (loginScreen) {
      loginScreen.style.display = "flex";
      loginScreen.style.opacity = '0';
      loginScreen.style.transform = 'scale(0.95)';
      setTimeout(() => {
        if (loginScreen) {
          loginScreen.style.opacity = '1';
          loginScreen.style.transform = 'scale(1)';
        }
      }, 50);
    }
    
    if (sidebar) sidebar.style.display = "none";
    if (appContentEl) {
      appContentEl.style.display = "none";
      appContentEl.style.opacity = '';
      appContentEl.style.transform = '';
    }
    
    showNotif("👋 Anda telah keluar");
    
    const modal = bootstrap.Modal.getInstance(document.getElementById("confirmLogoutModal"));
    if (modal) modal.hide();
    
    console.log("Logout complete, state reset");
  }, 300);
}

// ============ INIT PROFILE ON LOAD ============
export async function initProfile() {
  const savedUser = sessionStorage.getItem("progrowth_user");
  if (savedUser) {
    console.log("Initializing profile for:", savedUser);
    await loadProfileData(savedUser);
  } else {
    resetProfileState();
  }
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfile);
} else {
  initProfile();
}

// ============ EXPORTS ============
window.handleLogin = handleLogin;
window.updateCloudPassword = updateCloudPassword;
window.confirmLogout = confirmLogout;
window.handleLogout = handleLogout;
window.openProfileModal = openProfileModal;
window.openChangePasswordFromProfile = openChangePasswordFromProfile;
window.handleProfilePhotoUpload = handleProfilePhotoUpload;
window.updateStatus = updateStatus;
window.updateProfileUI = updateProfileUI;
window.forceRefreshProfile = forceRefreshProfile;
