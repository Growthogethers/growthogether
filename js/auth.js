// js/auth.js - Versi lengkap dengan Register Multi-User
import { db, ref, get, update, query, orderByChild, equalTo } from './firebase-config.js';
import { showNotif, setCurrentUser, compressImage, escapeHtml } from './utils.js';
import { renderBirthdayInProfile } from './pengingat.js';

// ============ GLOBAL STATE PROFILE ============
let currentProfilePhoto = null;
let currentStatus = 'merencanakan';
let currentUserData = null;
let currentUsername = null;
let authListeners = [];

// ============ RESET PROFILE STATE ============
function resetProfileState() {
  console.log("Resetting profile state...");
  currentProfilePhoto = null;
  currentStatus = 'merencanakan';
  currentUserData = null;
  currentUsername = null;
}

// ============ PASSWORD HASH FUNCTION ============
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "growthogether_salt_2024");
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function simpleHash(str) {
  if (!str) return "";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ============ SESSION TOKEN FUNCTIONS ============
function generateSessionToken(username, timestamp) {
  const salt = "growthogether_secret_2024";
  return btoa(`${username}|${timestamp}|${salt}`).substring(0, 32);
}

export function validateSession() {
  const savedUser = sessionStorage.getItem("progrowth_user");
  const savedToken = sessionStorage.getItem("progrowth_token");
  const savedTimestamp = sessionStorage.getItem("progrowth_timestamp");
  
  if (!savedUser || !savedToken || !savedTimestamp) {
    return false;
  }
  
  const now = Date.now();
  const sessionAge = now - parseInt(savedTimestamp);
  if (sessionAge > 24 * 60 * 60 * 1000) {
    console.log("Session expired");
    return false;
  }
  
  const expectedToken = generateSessionToken(savedUser, savedTimestamp);
  if (savedToken !== expectedToken) {
    console.log("Invalid session token");
    return false;
  }
  
  return true;
}

export function cleanupAuthListeners() {
  console.log("Cleaning up auth listeners...");
  authListeners.forEach(listener => {
    if (typeof listener === 'function') listener();
  });
  authListeners = [];
}

// ============ HELPER FUNCTIONS ============
function getCurrentSessionUser() {
  const user = sessionStorage.getItem("progrowth_user");
  if (user !== currentUsername) {
    if (user && validateSession()) {
      loadProfileData(user);
    }
  }
  return user;
}

function getDisplayName(username) {
  if (currentUserData && currentUserData.displayName) {
    return currentUserData.displayName;
  }
  return username;
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

// ============ REGISTER VALIDATION FUNCTIONS ============
export async function isUsernameTaken(username) {
  try {
    const snapshot = await get(ref(db, `data/auth/${username.toUpperCase()}`));
    return snapshot.exists();
  } catch (err) {
    console.error("Error checking username:", err);
    return false;
  }
}

export async function isEmailTaken(email) {
  if (!email) return false;
  try {
    const usersSnapshot = await get(ref(db, `data/users`));
    const users = usersSnapshot.val() || {};
    for (const [userId, userData] of Object.entries(users)) {
      if (userData.email && userData.email.toLowerCase() === email.toLowerCase()) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error("Error checking email:", err);
    return false;
  }
}

export async function isPhoneTaken(phone) {
  if (!phone) return false;
  try {
    const usersSnapshot = await get(ref(db, `data/users`));
    const users = usersSnapshot.val() || {};
    for (const [userId, userData] of Object.entries(users)) {
      if (userData.phone && userData.phone === phone) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error("Error checking phone:", err);
    return false;
  }
}

export async function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  
  const identifierLower = identifier.toLowerCase().trim();
  
  try {
    // Cek sebagai username di data/auth
    const authSnapshot = await get(ref(db, `data/auth/${identifier.toUpperCase()}`));
    if (authSnapshot.exists()) {
      return { username: identifier.toUpperCase(), type: 'username' };
    }
    
    // Cek di data/users berdasarkan email atau phone
    const usersSnapshot = await get(ref(db, `data/users`));
    const users = usersSnapshot.val() || {};
    
    for (const [userId, userData] of Object.entries(users)) {
      if (userData.email && userData.email.toLowerCase() === identifierLower) {
        return { username: userId, type: 'email' };
      }
      if (userData.phone && userData.phone === identifier) {
        return { username: userId, type: 'phone' };
      }
    }
    
    return null;
  } catch (err) {
    console.error("Error finding user:", err);
    return null;
  }
}

// ============ LOAD PROFILE DATA ============
async function loadProfileData(username) {
  try {
    console.log("Loading profile data for:", username);
    
    const userSnap = await get(ref(db, `data/users/${username}`));
    const userData = userSnap.val() || {};
    
    const profileSnap = await get(ref(db, `data/profiles/${username}`));
    const profile = profileSnap.val() || {};
    
    currentProfilePhoto = profile.photo || null;
    currentStatus = profile.status || 'merencanakan';
    currentUserData = {
      ...profile,
      ...userData,
      displayName: userData.displayName || username
    };
    currentUsername = username;
    
    console.log("Profile loaded:", { username, status: currentStatus, displayName: currentUserData.displayName });
    updateProfileUI();
    return currentUserData;
  } catch (err) {
    console.error("Error loading profile:", err);
    return {};
  }
}

export async function forceRefreshProfile() {
  const currentUser = getCurrentSessionUser();
  if (currentUser && validateSession()) {
    await loadProfileData(currentUser);
  }
}

// ============ UPDATE PROFILE UI ============
export function updateProfileUI() {
  const currentUser = getCurrentSessionUser();
  if (!currentUser || !validateSession()) {
    console.log("No valid user logged in, skipping UI update");
    return;
  }
  
  const displayName = currentUserData?.displayName || currentUser;
  const statusText = getStatusText(currentStatus);
  
  console.log("Updating profile UI for:", displayName, "Status:", currentStatus);
  
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
  
  if (profileName) profileName.innerText = escapeHtml(displayName);
  
  if (profileStatusText) {
    profileStatusText.innerText = escapeHtml(statusText);
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
  
  if (modalName) modalName.innerText = escapeHtml(displayName);
  if (modalEmail && currentUserData?.email) {
    modalEmail.innerText = currentUserData.email;
  } else if (modalEmail) {
    modalEmail.innerText = `${currentUser}@growthogether.com`;
  }
  
  document.querySelectorAll('.status-badge').forEach(badge => {
    const status = badge.getAttribute('data-status');
    if (status === currentStatus) {
      badge.classList.add('active');
    } else {
      badge.classList.remove('active');
    }
  });
  
  const userGreet = document.getElementById("userGreet");
  if (userGreet) userGreet.innerText = escapeHtml(displayName);
}

// ============ REGISTER HANDLER ============
export async function handleRegister() {
  const username = document.getElementById("regUsername")?.value.trim().toUpperCase();
  const email = document.getElementById("regEmail")?.value.trim();
  const phone = document.getElementById("regPhone")?.value.trim();
  const password = document.getElementById("regPass")?.value;
  const confirmPass = document.getElementById("regConfirmPass")?.value;
  const errorDiv = document.getElementById("loginErrorMsg");
  const errorSpan = document.getElementById("errorText");
  const registerBtn = document.querySelector("#registerForm .login-btn-modern");
  
  // Validasi input
  if (!username) {
    if (errorSpan) errorSpan.innerText = "❌ Username harus diisi!";
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Username harus diisi", true);
    return;
  }
  
  if (!email) {
    if (errorSpan) errorSpan.innerText = "❌ Email harus diisi!";
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Email harus diisi", true);
    return;
  }
  
  if (!password || password.length < 4) {
    if (errorSpan) errorSpan.innerText = "❌ Password minimal 4 karakter!";
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Password minimal 4 karakter", true);
    return;
  }
  
  if (password !== confirmPass) {
    if (errorSpan) errorSpan.innerText = "❌ Password dan konfirmasi tidak sama!";
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Password tidak cocok", true);
    return;
  }
  
  // Validasi format username
  if (!/^[A-Z0-9_]+$/.test(username)) {
    if (errorSpan) errorSpan.innerText = "❌ Username hanya boleh huruf besar, angka, dan underscore!";
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Format username tidak valid", true);
    return;
  }
  
  // Validasi format email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errorSpan) errorSpan.innerText = "❌ Format email tidak valid!";
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Format email tidak valid", true);
    return;
  }
  
  // Validasi format phone (opsional)
  if (phone && !/^[0-9+\-\s]{8,15}$/.test(phone)) {
    if (errorSpan) errorSpan.innerText = "❌ Format no HP tidak valid! (8-15 digit)";
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Format no HP tidak valid", true);
    return;
  }
  
  const originalBtnText = registerBtn ? registerBtn.innerHTML : 'Daftar';
  
  if (registerBtn) {
    registerBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Memeriksa...';
    registerBtn.disabled = true;
  }
  
  try {
    // Cek username sudah terdaftar
    const usernameTaken = await isUsernameTaken(username);
    if (usernameTaken) {
      if (errorSpan) errorSpan.innerText = "❌ Username sudah terdaftar!";
      if (errorDiv) errorDiv.style.display = "block";
      showNotif("Username sudah digunakan", true);
      if (registerBtn) {
        registerBtn.innerHTML = originalBtnText;
        registerBtn.disabled = false;
      }
      return;
    }
    
    // Cek email sudah terdaftar
    const emailTaken = await isEmailTaken(email);
    if (emailTaken) {
      if (errorSpan) errorSpan.innerText = "❌ Email sudah terdaftar!";
      if (errorDiv) errorDiv.style.display = "block";
      showNotif("Email sudah digunakan", true);
      if (registerBtn) {
        registerBtn.innerHTML = originalBtnText;
        registerBtn.disabled = false;
      }
      return;
    }
    
    // Cek no HP sudah terdaftar (jika diisi)
    if (phone) {
      const phoneTaken = await isPhoneTaken(phone);
      if (phoneTaken) {
        if (errorSpan) errorSpan.innerText = "❌ No HP sudah terdaftar!";
        if (errorDiv) errorDiv.style.display = "block";
        showNotif("No HP sudah digunakan", true);
        if (registerBtn) {
          registerBtn.innerHTML = originalBtnText;
          registerBtn.disabled = false;
        }
        return;
      }
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Simpan ke Firebase
    await update(ref(db), { [`data/auth/${username}`]: hashedPassword });
    
    // Simpan data user
    await update(ref(db), { 
      [`data/users/${username}`]: {
        username: username,
        email: email,
        phone: phone || null,
        displayName: username,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        role: "user"
      }
    });
    
    // Inisialisasi data kosong untuk user baru
    await update(ref(db), {
      [`data/profiles/${username}`]: {
        status: "merencanakan",
        photo: null,
        createdAt: Date.now()
      },
      [`data/keuangan/${username}`]: {
        transaksi: {}
      },
      [`data/impian/${username}`]: {}
    });
    
    if (registerBtn) {
      registerBtn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Berhasil!';
      registerBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
    }
    
    showNotif(`✅ Akun ${username} berhasil dibuat! Silakan login.`, false, 'success');
    
    // Reset form register
    document.getElementById("regUsername").value = "";
    document.getElementById("regEmail").value = "";
    document.getElementById("regPhone").value = "";
    document.getElementById("regPass").value = "";
    document.getElementById("regConfirmPass").value = "";
    
    // Switch ke tab login setelah 1.5 detik
    setTimeout(() => {
      if (registerBtn) {
        registerBtn.innerHTML = originalBtnText;
        registerBtn.style.background = "";
        registerBtn.disabled = false;
      }
      if (typeof window.switchAuthTab === 'function') {
        window.switchAuthTab('login');
      }
      
      const loginIdentifier = document.getElementById("loginIdentifier");
      if (loginIdentifier) loginIdentifier.value = username;
      
    }, 1500);
    
  } catch (err) {
    console.error("Register error:", err);
    if (registerBtn) {
      registerBtn.innerHTML = originalBtnText;
      registerBtn.disabled = false;
    }
    if (errorSpan) errorSpan.innerText = "⚠️ Gagal membuat akun: " + (err.message || "Unknown error");
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Gagal membuat akun", true);
  }
}

// ============ LOGIN HANDLER ============
export async function handleLogin() {
  const identifier = document.getElementById("loginIdentifier")?.value.trim();
  const password = document.getElementById("loginPass")?.value;
  const errorDiv = document.getElementById("loginErrorMsg");
  const errorSpan = document.getElementById("errorText");
  const loginBtn = document.querySelector("#loginForm .login-btn-modern");
  
  if (!identifier) {
    if (errorSpan) errorSpan.innerText = "❌ Username/Email/No HP harus diisi!";
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Username/Email/No HP harus diisi", true);
    return;
  }
  
  if (!password || !password.trim()) { 
    if (errorSpan) errorSpan.innerText = "❌ Password tidak boleh kosong!"; 
    if (errorDiv) errorDiv.style.display = "block"; 
    showNotif("Password harus diisi", true); 
    return; 
  }
  
  resetProfileState();
  
  const originalBtnText = loginBtn ? loginBtn.innerHTML : 'Masuk';
  if (loginBtn) {
    loginBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Memeriksa...';
    loginBtn.disabled = true;
  }
  
  try {
    const userInfo = await findUserByIdentifier(identifier);
    
    if (!userInfo) {
      if (loginBtn) {
        loginBtn.innerHTML = originalBtnText;
        loginBtn.disabled = false;
      }
      if (errorSpan) errorSpan.innerText = "⚠️ Akun tidak ditemukan!";
      if (errorDiv) errorDiv.style.display = "block";
      showNotif("Akun tidak ditemukan", true);
      return;
    }
    
    const username = userInfo.username;
    
    const snap = await get(ref(db, `data/auth/${username}`));
    let storedValue = snap.val();
    
    let isValid = false;
    
    if (storedValue && /^[a-f0-9]{64}$/.test(storedValue)) {
      const hashedInput = await hashPassword(password);
      isValid = (hashedInput === storedValue);
    } else if (storedValue && /^[a-f0-9]+$/.test(storedValue) && storedValue.length < 64) {
      const hashedInput = simpleHash(password);
      isValid = (hashedInput === storedValue);
    } else {
      isValid = (storedValue === password);
      if (isValid) {
        const newHash = await hashPassword(password);
        await update(ref(db), { [`data/auth/${username}`]: newHash });
      }
    }
    
    if (isValid) {
      const timestamp = Date.now();
      const token = generateSessionToken(username, timestamp);
      
      sessionStorage.clear();
      sessionStorage.setItem("progrowth_user", username);
      sessionStorage.setItem("progrowth_token", token);
      sessionStorage.setItem("progrowth_timestamp", timestamp.toString());
      
      setCurrentUser(username);
      currentUsername = username;
      
      await loadProfileData(username);
      
      if (loginBtn) {
        loginBtn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Berhasil!';
        loginBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
      }
      
      setTimeout(() => {
        if (window.setupAppSession) {
          window.setupAppSession(username);
        }
      }, 500);
      
      const displayName = currentUserData?.displayName || username;
      showNotif(`Selamat datang, ${displayName} 🎉`);
    } else {
      if (loginBtn) {
        loginBtn.innerHTML = originalBtnText;
        loginBtn.disabled = false;
      }
      if (errorSpan) errorSpan.innerText = "⚠️ Password salah!";
      if (errorDiv) errorDiv.style.display = "block";
      showNotif("Password salah! Coba lagi", true);
    }
  } catch (e) {
    console.error("Login error:", e);
    if (loginBtn) {
      loginBtn.innerHTML = originalBtnText;
      loginBtn.disabled = false;
    }
    if (errorSpan) errorSpan.innerText = "⚠️ Gagal koneksi.";
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Koneksi gagal", true);
  }
}

// ============ PROFILE PHOTO ============
export async function updateProfilePhoto(photoBase64) {
  const currentUser = getCurrentSessionUser();
  if (!currentUser || !validateSession()) {
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
  if (!currentUser || !validateSession()) {
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
  
  if (!currentUser || !validateSession()) {
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
    const hashedPassword = await hashPassword(p1);
    await update(ref(db), { [`data/auth/${currentUser}`]: hashedPassword });
    
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
  
  if (typeof renderBirthdayInProfile === 'function') {
    renderBirthdayInProfile();
  }
  
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
  console.log("confirmLogout called");
  const modalEl = document.getElementById("confirmLogoutModal");
  
  if (!modalEl) {
    console.error("confirmLogoutModal not found!");
    handleLogout();
    return;
  }
  
  const confirmBtn = document.getElementById("confirmLogoutBtn");
  if (confirmBtn) {
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("Confirm logout button clicked");
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
      handleLogout();
    });
  }
  
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

export function handleLogout() {
  console.log("Executing logout...");
  
  const modals = ['profileModal', 'passModal', 'confirmLogoutModal', 'momentModal', 'momentDetailModal', 'transaksiModal', 'impianModal', 'kategoriModal', 'itemModal'];
  modals.forEach(modalId => {
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  });
  
  const appContent = document.getElementById("app-content");
  if (appContent) {
    appContent.style.transition = 'all 0.3s';
    appContent.style.opacity = '0';
    appContent.style.transform = 'translateY(20px)';
  }
  
  setTimeout(() => {
    sessionStorage.removeItem("progrowth_user");
    sessionStorage.removeItem("progrowth_token");
    sessionStorage.removeItem("progrowth_timestamp");
    setCurrentUser(null);
    resetProfileState();
    
    const loginPass = document.getElementById("loginPass");
    const loginIdentifier = document.getElementById("loginIdentifier");
    const loginErrorMsg = document.getElementById("loginErrorMsg");
    if (loginPass) loginPass.value = "";
    if (loginIdentifier) loginIdentifier.value = "";
    if (loginErrorMsg) loginErrorMsg.style.display = "none";
    
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
    console.log("Logout complete");
  }, 300);
}

export async function initProfile() {
  const savedUser = sessionStorage.getItem("progrowth_user");
  if (savedUser && validateSession()) {
    console.log("Initializing profile for:", savedUser);
    await loadProfileData(savedUser);
  } else {
    resetProfileState();
  }
}

// ============ EXPORTS ============
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.updateCloudPassword = updateCloudPassword;
window.confirmLogout = confirmLogout;
window.handleLogout = handleLogout;
window.openProfileModal = openProfileModal;
window.openChangePasswordFromProfile = openChangePasswordFromProfile;
window.handleProfilePhotoUpload = handleProfilePhotoUpload;
window.updateStatus = updateStatus;
window.updateProfileUI = updateProfileUI;
window.forceRefreshProfile = forceRefreshProfile;
window.validateSession = validateSession;
window.cleanupAuthListeners = cleanupAuthListeners;
window.isUsernameTaken = isUsernameTaken;
window.isEmailTaken = isEmailTaken;
window.isPhoneTaken = isPhoneTaken;
window.findUserByIdentifier = findUserByIdentifier;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfile);
} else {
  initProfile();
}
