// js/auth.js - Versi dengan Username Manual, Session Dinamis, Reset Password
import { db, ref, get, update, set } from './firebase-config.js';
import { showNotif, setCurrentUser, compressImage, escapeHtml } from './utils.js';
import { renderBirthdayInProfile } from './pengingat.js';

// ============ GLOBAL STATE PROFILE ============
let currentProfilePhoto = null;
let currentStatus = 'merencanakan';
let currentUserData = null;
let currentUsername = null;
let authListeners = [];

// ============ PASSWORD DEFAULT ============
const DEFAULT_PASSWORDS = {
    FACHMI: "12345",
    AZIZAH: "12345"
};

// ============ SIMPLE HASH FUNCTION ============
function simpleHash(password, username) {
    let hash = 0;
    const str = String(password) + "growthogether_salt_2024_" + String(username).toUpperCase();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

// ============ INITIALIZE DEFAULT AUTH DATA ============
export async function initializeDefaultAuth() {
    console.log("Initializing default auth data...");
    
    try {
        const fachmiAuth = await get(ref(db, 'data/auth/FACHMI'));
        const azizahAuth = await get(ref(db, 'data/auth/AZIZAH'));
        
        const updates = {};
        
        if (!fachmiAuth.exists()) {
            const hash = simpleHash(DEFAULT_PASSWORDS.FACHMI, "FACHMI");
            updates['data/auth/FACHMI'] = hash;
            console.log("Setting FACHMI default password");
        }
        
        if (!azizahAuth.exists()) {
            const hash = simpleHash(DEFAULT_PASSWORDS.AZIZAH, "AZIZAH");
            updates['data/auth/AZIZAH'] = hash;
            console.log("Setting AZIZAH default password");
        }
        
        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
            console.log("Default auth data initialized");
        }
        
        return true;
    } catch (err) {
        console.error("Error initializing default auth:", err);
        return false;
    }
}

// ============ RESET PASSWORD KE DEFAULT ============
export async function resetToDefaultPassword() {
    const resetBtn = document.querySelector(".btn-outline-secondary");
    const originalText = resetBtn ? resetBtn.innerHTML : 'Reset Password';
    
    if (resetBtn) {
        resetBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Meriset...';
        resetBtn.disabled = true;
    }
    
    try {
        // Reset Fachmi
        const fachmiHash = simpleHash(DEFAULT_PASSWORDS.FACHMI, "FACHMI");
        await set(ref(db, 'data/auth/FACHMI'), fachmiHash);
        
        // Reset Azizah
        const azizahHash = simpleHash(DEFAULT_PASSWORDS.AZIZAH, "AZIZAH");
        await set(ref(db, 'data/auth/AZIZAH'), azizahHash);
        
        console.log("Passwords reset to default");
        console.log("FACHMI hash:", fachmiHash);
        console.log("AZIZAH hash:", azizahHash);
        
        // Bersihkan form login
        const usernameInput = document.getElementById("loginUser");
        const passwordInput = document.getElementById("loginPass");
        if (usernameInput) usernameInput.value = "";
        if (passwordInput) passwordInput.value = "";
        
        // Tampilkan notifikasi sukses
        showNotif("✅ Password telah direset ke default (12345) untuk kedua akun!", false, 'success');
        
        // Tampilkan alert dengan informasi
        alert("✅ Password berhasil direset ke default!\n\nFACHMI = 12345\nAZIZAH = 12345\n\nSilakan login dengan username dan password tersebut.");
        
    } catch (err) {
        console.error("Error resetting passwords:", err);
        showNotif("❌ Gagal mereset password: " + err.message, true, 'error');
        alert("❌ Gagal mereset password.\n\nPastikan koneksi internet stabil dan coba lagi.\n\nError: " + err.message);
    } finally {
        if (resetBtn) {
            resetBtn.innerHTML = originalText;
            resetBtn.disabled = false;
        }
    }
}

// ============ VALIDASI USERNAME YANG DIIZINKAN ============
function isValidUsername(username) {
    const allowedUsernames = ["FACHMI", "AZIZAH"];
    return allowedUsernames.includes(username?.toUpperCase());
}

function getDisplayName(username) {
    const upperUsername = username?.toUpperCase();
    if (upperUsername === "FACHMI") return "Fachmi";
    if (upperUsername === "AZIZAH") return "Azizah";
    return username || "User";
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
    return sessionStorage.getItem("progrowth_user");
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
    const upperUsername = username?.toUpperCase();
    if (!upperUsername || !isValidUsername(upperUsername)) return {};
    
    try {
        console.log("Loading profile data for:", upperUsername);
        const profileSnap = await get(ref(db, `data/profiles/${upperUsername}`));
        const profile = profileSnap.val() || {};
        currentProfilePhoto = profile.photo || null;
        currentStatus = profile.status || 'merencanakan';
        currentUserData = profile;
        currentUsername = upperUsername;
        
        if (!profileSnap.exists()) {
            await set(ref(db, `data/profiles/${upperUsername}`), {
                status: 'merencanakan',
                createdAt: Date.now()
            });
        }
        
        console.log("Profile loaded:", { username: upperUsername, status: currentStatus });
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
    
    // Update keuangan page title
    const keuanganUserName = document.getElementById("keuanganUserName");
    if (keuanganUserName) {
        keuanganUserName.innerHTML = `Keuangan ${displayName}`;
    }
}

// ============ LOGIN HANDLER ============
export async function handleLogin() {
    let u = document.getElementById("loginUser")?.value;
    const p = document.getElementById("loginPass")?.value;
    const errorDiv = document.getElementById("loginErrorMsg");
    const errorSpan = document.getElementById("errorText");
    const loginBtn = document.querySelector(".login-btn-modern");
    
    // Convert username to uppercase for consistency
    u = u?.toUpperCase().trim();
    
    if (!u) {
        if (errorSpan) errorSpan.innerText = "❌ Username tidak boleh kosong!"; 
        if (errorDiv) errorDiv.style.display = "block"; 
        showNotif("Username harus diisi", true); 
        shakeElement(document.getElementById("loginUser"));
        return;
    }
    
    if (!p || !p.trim()) { 
        if (errorSpan) errorSpan.innerText = "❌ Password tidak boleh kosong!"; 
        if (errorDiv) errorDiv.style.display = "block"; 
        showNotif("Password harus diisi", true); 
        shakeElement(document.getElementById("loginPass"));
        return; 
    }
    
    // Validasi username yang diizinkan
    if (!isValidUsername(u)) {
        if (errorSpan) errorSpan.innerText = "❌ Username tidak valid! Gunakan FACHMI atau AZIZAH"; 
        if (errorDiv) errorDiv.style.display = "block"; 
        showNotif("Username tidak valid! Gunakan FACHMI atau AZIZAH", true);
        shakeElement(document.getElementById("loginUser"));
        return;
    }
    
    const originalBtnText = loginBtn ? loginBtn.innerHTML : 'Masuk';
    if (loginBtn) {
        loginBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Memeriksa...';
        loginBtn.disabled = true;
    }
    
    try {
        await initializeDefaultAuth();
        
        const snap = await get(ref(db, `data/auth/${u}`));
        let storedValue = snap.val();
        
        console.log("Login attempt for:", u);
        
        let isValid = false;
        const inputHash = simpleHash(p, u);
        
        if (storedValue) {
            if (storedValue === inputHash) {
                isValid = true;
                console.log("Hash match success");
            } else if (storedValue === p) {
                isValid = true;
                console.log("Plain text match, migrating to hash");
                await set(ref(db, `data/auth/${u}`), inputHash);
            }
        }
        
        // Cek default password
        if (!isValid && DEFAULT_PASSWORDS[u] === p) {
            isValid = true;
            console.log("Default password match");
            await set(ref(db, `data/auth/${u}`), inputHash);
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
            
            if (errorSpan) errorSpan.innerText = `⚠️ Password salah untuk username: ${u}`;
            if (errorDiv) errorDiv.style.display = "block";
            shakeElement(document.getElementById("loginPass"));
            showNotif(`Password salah!`, true);
        }
    } catch (e) {
        console.error("Login error:", e);
        if (loginBtn) {
            loginBtn.innerHTML = originalBtnText;
            loginBtn.disabled = false;
        }
        
        if (errorSpan) errorSpan.innerText = "⚠️ Gagal koneksi. " + (e.message || "");
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
        
        const loginUser = document.getElementById("loginUser");
        const loginPass = document.getElementById("loginPass");
        const loginErrorMsg = document.getElementById("loginErrorMsg");
        
        if (loginUser) loginUser.value = "";
        if (loginPass) loginPass.value = "";
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

// ============ INIT PROFILE ON LOAD ============
export async function initProfile() {
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
window.resetToDefaultPassword = resetToDefaultPassword;
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
