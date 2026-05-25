// js/auth.js - Versi Final dengan Password Baru (FACHMI: 170598, AZIZAH: 060897)
import { db, ref, get, update, set } from './firebase-config.js';
import { showNotif, setCurrentUser, compressImage, escapeHtml } from './utils.js';
import { renderBirthdayInProfile } from './pengingat.js';

// ============ GLOBAL STATE PROFILE ============
let currentProfilePhoto = null;
let currentStatus = 'merencanakan';
let currentUserData = null;
let currentUsername = null;
let authListeners = [];

// ============ PASSWORD BARU ============
const DEFAULT_PASSWORDS = {
    FACHMI: "170598",
    AZIZAH: "060897"
};

// ============ SIMPLE HASH FUNCTION (RELIABLE) ============
function simpleHash(password, username) {
    let hash = 0;
    const str = String(password) + "growthogether_salt_2024_" + String(username);
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

// ============ SHA-256 HASH (UNTUK KOMPATIBILITAS) ============
async function sha256Hash(password, username) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + "growthogether_salt_2024_" + username);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// ============ INITIALIZE DEFAULT AUTH DATA ============
export async function initializeDefaultAuth() {
    console.log("Initializing default auth data...");
    
    try {
        // Cek apakah data auth sudah ada
        const fachmiAuth = await get(ref(db, 'data/auth/FACHMI'));
        const azizahAuth = await get(ref(db, 'data/auth/AZIZAH'));
        
        let needUpdate = false;
        const updates = {};
        
        // Set default untuk FACHMI jika belum ada
        if (!fachmiAuth.exists()) {
            const hash = simpleHash(DEFAULT_PASSWORDS.FACHMI, "FACHMI");
            updates['data/auth/FACHMI'] = hash;
            console.log("Setting FACHMI default password");
            needUpdate = true;
        }
        
        // Set default untuk AZIZAH jika belum ada
        if (!azizahAuth.exists()) {
            const hash = simpleHash(DEFAULT_PASSWORDS.AZIZAH, "AZIZAH");
            updates['data/auth/AZIZAH'] = hash;
            console.log("Setting AZIZAH default password");
            needUpdate = true;
        }
        
        // Update jika perlu
        if (needUpdate) {
            await update(ref(db), updates);
            console.log("Default auth data initialized successfully");
        }
        
        return true;
    } catch (err) {
        console.error("Error initializing default auth:", err);
        return false;
    }
}

// ============ FORCE RESET PASSWORD ============
export async function forceResetPassword(username, newPassword) {
    if (!username || !newPassword) {
        console.error("Username and password required");
        return false;
    }
    
    try {
        const hash = simpleHash(newPassword, username);
        await set(ref(db, `data/auth/${username}`), hash);
        console.log(`Password reset for ${username} to: ${newPassword}`);
        showNotif(`✅ Password ${username} telah direset`, false, 'success');
        return true;
    } catch (err) {
        console.error("Error resetting password:", err);
        showNotif(`❌ Gagal reset password ${username}`, true, 'error');
        return false;
    }
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
        
        // Inisialisasi profile jika belum ada
        if (!profileSnap.exists()) {
            await set(ref(db, `data/profiles/${username}`), {
                status: 'merencanakan',
                createdAt: Date.now()
            });
        }
        
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
    
    const displayName = getDisplayName(currentUser);
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
    if (modalEmail) {
        const email = currentUser === "FACHMI" ? "fachmi@growthogether.com" : "azizah@growthogether.com";
        modalEmail.innerText = email;
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

// ============ LOGIN HANDLER DENGAN PASSWORD BARU ============
export async function handleLogin() {
    const u = document.getElementById("loginUser")?.value;
    const p = document.getElementById("loginPass")?.value;
    const errorDiv = document.getElementById("loginErrorMsg");
    const errorSpan = document.getElementById("errorText");
    const loginBtn = document.querySelector(".login-btn-modern");
    
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
        // Pastikan default auth data ada
        await initializeDefaultAuth();
        
        const snap = await get(ref(db, `data/auth/${u}`));
        let storedValue = snap.val();
        
        console.log("Login attempt for:", u);
        console.log("Stored password value:", storedValue ? storedValue.substring(0, 20) + "..." : "null");
        
        let isValid = false;
        
        // Hash input password menggunakan simpleHash
        const inputHash = simpleHash(p, u);
        
        // Bandingkan dengan stored value
        if (storedValue) {
            // Cek apakah stored value sama dengan hash input
            if (storedValue === inputHash) {
                isValid = true;
                console.log("Hash match success");
            }
            // Cek plain text (untuk backward compatibility)
            else if (storedValue === p) {
                isValid = true;
                console.log("Plain text match, will migrate to hash");
                // Migrasi ke hash
                await set(ref(db, `data/auth/${u}`), inputHash);
                console.log("Password migrated to hash for:", u);
            }
        }
        
        // Jika masih tidak valid, coba dengan password default
        if (!isValid && DEFAULT_PASSWORDS[u] === p) {
            isValid = true;
            console.log("Default password match");
            // Update ke hash
            await set(ref(db, `data/auth/${u}`), inputHash);
            console.log("Default password saved as hash for:", u);
        }
        
        if (isValid) {
            const timestamp = Date.now();
            const token = generateSessionToken(u, timestamp);
            
            sessionStorage.clear();
            sessionStorage.setItem("progrowth_user", u);
            sessionStorage.setItem("progrowth_token", token);
            sessionStorage.setItem("progrowth_timestamp", timestamp.toString());
            
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
            
            const expectedMsg = u === "FACHMI" ? "170598" : "060897";
            if (errorSpan) errorSpan.innerText = `⚠️ Password salah! Password untuk ${getDisplayName(u)} adalah: ${expectedMsg}`;
            if (errorDiv) errorDiv.style.display = "block";
            shakeElement(document.getElementById("loginPass"));
            showNotif(`Password salah! Gunakan: ${expectedMsg}`, true);
        }
    } catch (e) {
        console.error("Login error:", e);
        if (loginBtn) {
            loginBtn.innerHTML = originalBtnText;
            loginBtn.disabled = false;
        }
        
        if (errorSpan) errorSpan.innerText = "⚠️ Gagal koneksi. " + (e.message || "Cek koneksi internet");
        if (errorDiv) errorDiv.style.display = "block";
        showNotif("Koneksi gagal: " + (e.message || "Cek koneksi internet"), true);
    }
}

// ============ RESET PROFILE STATE ============
function resetProfileState() {
    console.log("Resetting profile state...");
    currentProfilePhoto = null;
    currentStatus = 'merencanakan';
    currentUserData = null;
    currentUsername = null;
}

// ============ UPDATE PROFILE PHOTO ============
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
        const hashedPassword = simpleHash(p1, currentUser);
        await set(ref(db, `data/auth/${currentUser}`), hashedPassword);
        
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

// ============ OPEN CHANGE PASSWORD ============
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
        console.log("Logout complete");
    }, 300);
}

// ============ INIT PROFILE ON LOAD ============
export async function initProfile() {
    // Inisialisasi default auth data
    await initializeDefaultAuth();
    
    const savedUser = sessionStorage.getItem("progrowth_user");
    if (savedUser && validateSession()) {
        console.log("Initializing profile for:", savedUser);
        await loadProfileData(savedUser);
    } else {
        resetProfileState();
    }
}

// Jalankan inisialisasi
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
window.validateSession = validateSession;
window.cleanupAuthListeners = cleanupAuthListeners;
window.initializeDefaultAuth = initializeDefaultAuth;
window.forceResetPassword = forceResetPassword;
