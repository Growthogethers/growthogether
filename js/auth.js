// js/auth.js - Versi Final Tanpa Duplikasi Export
import { db, ref, get, update, set, push } from './firebase-config.js';
import { showNotif, setCurrentUser as setCurrentUserUtil, compressImage, escapeHtml } from './utils.js';
import { renderBirthdayInProfile } from './pengingat.js';

// ============ GLOBAL STATE ============
let currentProfilePhoto = null;
let currentStatus = 'merencanakan';
let currentUserData = null;
let currentUsername = null;
let currentUserId = null;
let authListeners = [];

// ============ PASSWORD DEFAULT ============
const DEFAULT_PASSWORD = "12345";

// ============ HASH FUNCTION ============
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

// ============ VALIDASI & CHECK DUPLICATE ============
async function isUsernameExists(username) {
    const snapshot = await get(ref(db, 'data/users'));
    const users = snapshot.val() || {};
    return Object.values(users).some(user => user.username?.toUpperCase() === username?.toUpperCase());
}

async function isPhoneExists(phone) {
    if (!phone) return false;
    const snapshot = await get(ref(db, 'data/users'));
    const users = snapshot.val() || {};
    return Object.values(users).some(user => user.phone === phone);
}

async function isEmailExists(email) {
    if (!email) return false;
    const snapshot = await get(ref(db, 'data/users'));
    const users = snapshot.val() || {};
    return Object.values(users).some(user => user.email?.toLowerCase() === email?.toLowerCase());
}

async function findUserByIdentifier(identifier) {
    const snapshot = await get(ref(db, 'data/users'));
    const users = snapshot.val() || {};
    
    identifier = identifier?.toLowerCase().trim();
    
    for (const [userId, userData] of Object.entries(users)) {
        if (userData.username?.toLowerCase() === identifier) {
            return { userId, ...userData };
        }
        if (userData.phone === identifier) {
            return { userId, ...userData };
        }
        if (userData.email?.toLowerCase() === identifier) {
            return { userId, ...userData };
        }
    }
    return null;
}

// ============ REGISTER NEW USER ============
export async function handleRegister() {
    const fullname = document.getElementById('regFullname')?.value.trim();
    const username = document.getElementById('regUsername')?.value.trim().toUpperCase();
    const phone = document.getElementById('regPhone')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;
    
    const errorDiv = document.getElementById('loginErrorMsg');
    const errorSpan = document.getElementById('errorText');
    const successDiv = document.getElementById('loginSuccessMsg');
    const successSpan = document.getElementById('successText');
    const registerBtn = document.getElementById('registerBtn');
    
    if (errorDiv) errorDiv.style.display = 'none';
    if (successDiv) successDiv.style.display = 'none';
    
    if (!fullname) {
        errorSpan.innerText = '❌ Nama lengkap harus diisi!';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!username) {
        errorSpan.innerText = '❌ Username harus diisi!';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (username.length < 3) {
        errorSpan.innerText = '❌ Username minimal 3 karakter!';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!phone) {
        errorSpan.innerText = '❌ Nomor HP harus diisi!';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!/^[0-9]{10,13}$/.test(phone.replace(/\D/g, ''))) {
        errorSpan.innerText = '❌ Nomor HP tidak valid! Masukkan 10-13 digit angka';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!email) {
        errorSpan.innerText = '❌ Email harus diisi!';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorSpan.innerText = '❌ Email tidak valid!';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!password || password.length < 4) {
        errorSpan.innerText = '❌ Password minimal 4 karakter!';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (password !== confirmPassword) {
        errorSpan.innerText = '❌ Password dan konfirmasi tidak sama!';
        errorDiv.style.display = 'block';
        return;
    }
    
    const [usernameExists, phoneExists, emailExists] = await Promise.all([
        isUsernameExists(username),
        isPhoneExists(phone),
        isEmailExists(email)
    ]);
    
    if (usernameExists) {
        errorSpan.innerText = '❌ Username sudah terdaftar! Gunakan username lain.';
        errorDiv.style.display = 'block';
        document.getElementById('regUsername')?.focus();
        return;
    }
    
    if (phoneExists) {
        errorSpan.innerText = '❌ Nomor HP sudah terdaftar! Gunakan nomor lain.';
        errorDiv.style.display = 'block';
        document.getElementById('regPhone')?.focus();
        return;
    }
    
    if (emailExists) {
        errorSpan.innerText = '❌ Email sudah terdaftar! Gunakan email lain.';
        errorDiv.style.display = 'block';
        document.getElementById('regEmail')?.focus();
        return;
    }
    
    if (registerBtn) {
        registerBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Mendaftarkan...';
        registerBtn.disabled = true;
    }
    
    try {
        const userId = push(ref(db, 'data/users')).key;
        const passwordHash = simpleHash(password, username);
        
        const userData = {
            userId,
            fullname: escapeHtml(fullname),
            username: username.toUpperCase(),
            phone: phone,
            email: email.toLowerCase(),
            passwordHash: passwordHash,
            status: 'merencanakan',
            createdAt: Date.now()
        };
        
        await set(ref(db, `data/users/${userId}`), userData);
        await set(ref(db, `data/auth/${username}`), passwordHash);
        await set(ref(db, `data/profiles/${username}`), {
            fullname: escapeHtml(fullname),
            status: 'merencanakan',
            createdAt: Date.now()
        });
        
        successSpan.innerText = `✅ Pendaftaran berhasil! Silakan login dengan username/HP/email dan password Anda.`;
        successDiv.style.display = 'block';
        
        document.getElementById('regFullname').value = '';
        document.getElementById('regUsername').value = '';
        document.getElementById('regPhone').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regConfirmPassword').value = '';
        
        setTimeout(() => {
            if (typeof window.switchTab === 'function') {
                window.switchTab('login');
            }
            const loginIdentifier = document.getElementById('loginIdentifier');
            if (loginIdentifier) loginIdentifier.value = username;
            document.getElementById('loginPassword')?.focus();
            if (successDiv) successDiv.style.display = 'none';
        }, 2000);
        
        showNotif(`✅ Selamat datang ${fullname}! Silakan login.`, false, 'success');
        
    } catch (err) {
        console.error('Register error:', err);
        errorSpan.innerText = '❌ Gagal mendaftar: ' + err.message;
        errorDiv.style.display = 'block';
        showNotif('Gagal mendaftar', true);
    } finally {
        if (registerBtn) {
            registerBtn.innerHTML = '<i class="bi bi-person-plus-fill me-2"></i> Daftar Akun Baru';
            registerBtn.disabled = false;
        }
    }
}

// ============ VALIDASI INPUT REGISTER (REAL TIME) ============
export async function validateRegisterField(field, value) {
    const statusSpan = document.getElementById(`${field}Status`);
    if (!statusSpan) return;
    
    if (!value) {
        statusSpan.innerHTML = '';
        statusSpan.className = 'text-muted';
        return;
    }
    
    if (field === 'username') {
        const exists = await isUsernameExists(value);
        if (exists) {
            statusSpan.innerHTML = '❌ Username sudah digunakan';
            statusSpan.className = 'text-muted text-danger';
        } else if (value.length < 3) {
            statusSpan.innerHTML = '⚠️ Minimal 3 karakter';
            statusSpan.className = 'text-muted text-warning';
        } else {
            statusSpan.innerHTML = '✅ Username tersedia';
            statusSpan.className = 'text-muted text-success';
        }
    }
    
    if (field === 'phone') {
        const cleanPhone = value.replace(/\D/g, '');
        const exists = await isPhoneExists(value);
        if (exists) {
            statusSpan.innerHTML = '❌ Nomor HP sudah terdaftar';
            statusSpan.className = 'text-muted text-danger';
        } else if (!/^[0-9]{10,13}$/.test(cleanPhone)) {
            statusSpan.innerHTML = '⚠️ Masukkan 10-13 digit angka';
            statusSpan.className = 'text-muted text-warning';
        } else {
            statusSpan.innerHTML = '✅ Nomor HP valid';
            statusSpan.className = 'text-muted text-success';
        }
    }
    
    if (field === 'email') {
        const exists = await isEmailExists(value);
        if (exists) {
            statusSpan.innerHTML = '❌ Email sudah terdaftar';
            statusSpan.className = 'text-muted text-danger';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            statusSpan.innerHTML = '⚠️ Format email tidak valid';
            statusSpan.className = 'text-muted text-warning';
        } else {
            statusSpan.innerHTML = '✅ Email valid';
            statusSpan.className = 'text-muted text-success';
        }
    }
}

// ============ LOGIN HANDLER ============
export async function handleLogin() {
    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    const errorDiv = document.getElementById('loginErrorMsg');
    const errorSpan = document.getElementById('errorText');
    const loginBtn = document.querySelector('.login-btn-modern');
    const successDiv = document.getElementById('loginSuccessMsg');
    
    if (successDiv) successDiv.style.display = 'none';
    if (errorDiv) errorDiv.style.display = 'none';
    
    if (!identifier) {
        errorSpan.innerText = '❌ Masukkan username / no HP / email!';
        errorDiv.style.display = 'block';
        showNotif('Masukkan identifier login', true);
        return;
    }
    
    if (!password) {
        errorSpan.innerText = '❌ Password tidak boleh kosong!';
        errorDiv.style.display = 'block';
        showNotif('Password harus diisi', true);
        return;
    }
    
    const originalBtnText = loginBtn?.innerHTML;
    if (loginBtn) {
        loginBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Memeriksa...';
        loginBtn.disabled = true;
    }
    
    try {
        const user = await findUserByIdentifier(identifier);
        
        if (!user) {
            errorSpan.innerText = '❌ Username/No HP/Email tidak ditemukan!';
            errorDiv.style.display = 'block';
            showNotif('Akun tidak ditemukan', true);
            return;
        }
        
        const username = user.username;
        const storedHash = user.passwordHash;
        const inputHash = simpleHash(password, username);
        
        let isValid = false;
        
        if (storedHash === inputHash) {
            isValid = true;
        } else if (storedHash === password) {
            isValid = true;
            await set(ref(db, `data/users/${user.userId}/passwordHash`), inputHash);
            await set(ref(db, `data/auth/${username}`), inputHash);
        }
        
        if (!isValid && DEFAULT_PASSWORD === password) {
            isValid = true;
            const newHash = simpleHash(DEFAULT_PASSWORD, username);
            await set(ref(db, `data/users/${user.userId}/passwordHash`), newHash);
            await set(ref(db, `data/auth/${username}`), newHash);
        }
        
        if (isValid) {
            const timestamp = Date.now();
            const token = generateSessionToken(username, timestamp);
            
            sessionStorage.clear();
            sessionStorage.setItem("progrowth_user", username);
            sessionStorage.setItem("progrowth_userId", user.userId);
            sessionStorage.setItem("progrowth_token", token);
            sessionStorage.setItem("progrowth_timestamp", timestamp.toString());
            
            setCurrentUserUtil(username);
            currentUsername = username;
            currentUserId = user.userId;
            
            await loadProfileData(username, user);
            
            if (loginBtn) {
                loginBtn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Berhasil!';
                loginBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
            }
            
            setTimeout(() => {
                if (window.setupAppSession) {
                    window.setupAppSession(username);
                }
            }, 500);
            
            showNotif(`Selamat datang kembali, ${user.fullname || getDisplayName(username)} 🎉`);
        } else {
            errorSpan.innerText = '❌ Password salah!';
            errorDiv.style.display = 'block';
            showNotif('Password salah!', true);
        }
        
    } catch (err) {
        console.error('Login error:', err);
        errorSpan.innerText = '⚠️ Gagal login: ' + (err.message || 'Cek koneksi');
        errorDiv.style.display = 'block';
        showNotif('Gagal login', true);
    } finally {
        if (loginBtn) {
            loginBtn.innerHTML = originalBtnText;
            loginBtn.disabled = false;
        }
    }
}

// ============ RESET PASSWORD PER AKUN ============
export async function resetToDefaultPassword() {
    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const errorDiv = document.getElementById('loginErrorMsg');
    const errorSpan = document.getElementById('errorText');
    const successDiv = document.getElementById('loginSuccessMsg');
    const successSpan = document.getElementById('successText');
    const resetBtn = document.getElementById('resetPasswordBtn');
    
    if (errorDiv) errorDiv.style.display = 'none';
    if (successDiv) successDiv.style.display = 'none';
    
    if (!identifier) {
        errorSpan.innerText = '❌ Masukkan username / no HP / email untuk reset password!';
        errorDiv.style.display = 'block';
        return;
    }
    
    const user = await findUserByIdentifier(identifier);
    
    if (!user) {
        errorSpan.innerText = '❌ Akun tidak ditemukan!';
        errorDiv.style.display = 'block';
        return;
    }
    
    const confirmReset = confirm(`Yakin ingin mereset password untuk akun "${user.fullname || user.username}" ke default (${DEFAULT_PASSWORD})?`);
    
    if (!confirmReset) return;
    
    const originalText = resetBtn?.innerHTML;
    if (resetBtn) {
        resetBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Mereset...';
        resetBtn.disabled = true;
    }
    
    try {
        const newHash = simpleHash(DEFAULT_PASSWORD, user.username);
        
        await set(ref(db, `data/users/${user.userId}/passwordHash`), newHash);
        await set(ref(db, `data/auth/${user.username}`), newHash);
        
        successSpan.innerHTML = `✅ Password untuk akun ${user.fullname || user.username} berhasil direset ke: ${DEFAULT_PASSWORD}`;
        successDiv.style.display = 'block';
        
        document.getElementById('loginPassword').value = '';
        showNotif(`✅ Password ${user.fullname || user.username} direset ke ${DEFAULT_PASSWORD}`, false, 'success');
        
        setTimeout(() => {
            if (successDiv) successDiv.style.display = 'none';
        }, 5000);
        
    } catch (err) {
        errorSpan.innerText = '❌ Gagal reset password: ' + err.message;
        errorDiv.style.display = 'block';
        showNotif('Gagal reset password', true);
    } finally {
        if (resetBtn) {
            resetBtn.innerHTML = originalText;
            resetBtn.disabled = false;
        }
    }
}

// ============ SESSION TOKEN ============
function generateSessionToken(username, timestamp) {
    const salt = "growthogether_secret_2024";
    return btoa(`${username}|${timestamp}|${salt}`).substring(0, 32);
}

export function validateSession() {
    const savedUser = sessionStorage.getItem("progrowth_user");
    const savedToken = sessionStorage.getItem("progrowth_token");
    const savedTimestamp = sessionStorage.getItem("progrowth_timestamp");
    
    if (!savedUser || !savedToken || !savedTimestamp) return false;
    
    const sessionAge = Date.now() - parseInt(savedTimestamp);
    if (sessionAge > 24 * 60 * 60 * 1000) return false;
    
    const expectedToken = generateSessionToken(savedUser, savedTimestamp);
    return savedToken === expectedToken;
}

// ============ CLEANUP AUTH LISTENERS ============
export function cleanupAuthListeners() {
    console.log("Cleaning up auth listeners...");
    authListeners.forEach(listener => {
        if (typeof listener === 'function') listener();
    });
    authListeners = [];
}

// ============ FORCE REFRESH PROFILE ============
export async function forceRefreshProfile() {
    const currentUser = sessionStorage.getItem("progrowth_user");
    if (currentUser && validateSession()) {
        const user = await findUserByIdentifier(currentUser);
        if (user) await loadProfileData(currentUser, user);
    }
}

// ============ GET DISPLAY NAME ============
function getDisplayName(username) {
    const upperUsername = username?.toUpperCase();
    if (upperUsername === "FACHMI") return "Fachmi";
    if (upperUsername === "AZIZAH") return "Azizah";
    return currentUserData?.fullname || username || "User";
}

// ============ LOAD PROFILE DATA ============
async function loadProfileData(username, userData = null) {
    try {
        if (!userData) {
            const user = await findUserByIdentifier(username);
            if (user) userData = user;
        }
        
        if (userData) {
            currentUserData = userData;
            currentUsername = userData.username;
            currentUserId = userData.userId;
            currentStatus = userData.status || 'merencanakan';
            currentProfilePhoto = userData.photo || null;
        }
        
        const profileSnap = await get(ref(db, `data/profiles/${username}`));
        const profile = profileSnap.val() || {};
        
        if (!profileSnap.exists()) {
            await set(ref(db, `data/profiles/${username}`), {
                fullname: userData?.fullname || getDisplayName(username),
                status: currentStatus,
                createdAt: Date.now()
            });
        }
        
        updateProfileUI();
        return profile;
    } catch (err) {
        console.error("Error loading profile:", err);
        return {};
    }
}

// ============ UPDATE PROFILE UI ============
export function updateProfileUI() {
    const currentUser = sessionStorage.getItem("progrowth_user");
    if (!currentUser || !validateSession()) return;
    
    const displayName = getDisplayName(currentUser);
    const statusText = getStatusText(currentStatus);
    
    const elements = {
        profileAvatar: document.getElementById("profileAvatar"),
        profileName: document.getElementById("profileName"),
        profileStatusText: document.getElementById("profileStatusText"),
        profileStatusIndicator: document.getElementById("profileStatus"),
        modalProfileAvatar: document.getElementById("modalProfileAvatar"),
        modalProfileName: document.getElementById("modalProfileName"),
        modalProfileEmail: document.getElementById("modalProfileEmail"),
        userGreet: document.getElementById("userGreet"),
        keuanganUserName: document.getElementById("keuanganUserName")
    };
    
    if (elements.profileAvatar) {
        elements.profileAvatar.src = currentProfilePhoto || `https://ui-avatars.com/api/?background=6366f1&color=fff&bold=true&size=80&name=${encodeURIComponent(displayName)}`;
    }
    
    if (elements.profileName) elements.profileName.innerText = escapeHtml(displayName);
    
    if (elements.profileStatusText) {
        elements.profileStatusText.innerText = escapeHtml(statusText);
    }
    
    if (elements.profileStatusIndicator) {
        let iconClass = 'bi-calendar-check-fill';
        if (currentStatus === 'online') iconClass = 'bi-check-circle-fill';
        else if (currentStatus === 'sibuk') iconClass = 'bi-clock-fill';
        else if (currentStatus === 'liburan') iconClass = 'bi-umbrella-fill';
        elements.profileStatusIndicator.innerHTML = `<i class="${iconClass}"></i>`;
    }
    
    if (elements.modalProfileAvatar) {
        elements.modalProfileAvatar.src = currentProfilePhoto || `https://ui-avatars.com/api/?background=fff&color=6366f1&bold=true&size=100&name=${encodeURIComponent(displayName)}`;
    }
    
    if (elements.modalProfileName) elements.modalProfileName.innerText = escapeHtml(displayName);
    if (elements.modalProfileEmail && currentUserData?.email) {
        elements.modalProfileEmail.innerText = currentUserData.email;
    }
    
    if (elements.userGreet) elements.userGreet.innerText = escapeHtml(displayName);
    if (elements.keuanganUserName) elements.keuanganUserName.innerHTML = `Keuangan ${displayName}`;
    
    document.querySelectorAll('.status-badge').forEach(badge => {
        const status = badge.getAttribute('data-status');
        if (status === currentStatus) badge.classList.add('active');
        else badge.classList.remove('active');
    });
}

function getStatusText(status) {
    const map = { merencanakan: "sedang merencanakan", online: "online", sibuk: "sedang sibuk", liburan: "sedang liburan" };
    return map[status] || status;
}

// ============ UPDATE STATUS ============
export async function updateStatus(status) {
    const currentUser = sessionStorage.getItem("progrowth_user");
    if (!currentUser || !validateSession()) { showNotif("❌ Silakan login", true); return; }
    
    currentStatus = status;
    try {
        if (currentUserId) {
            await update(ref(db), { [`data/users/${currentUserId}/status`]: status });
        }
        await update(ref(db), { [`data/profiles/${currentUser}/status`]: status });
        updateProfileUI();
        showNotif(`✅ Status berubah: ${getStatusText(status)}`);
    } catch (err) { console.error(err); showNotif("❌ Gagal update status", true); }
}

// ============ UPDATE PASSWORD ============
export async function updateCloudPassword() {
    const p1 = document.getElementById("newPass")?.value;
    const p2 = document.getElementById("confirmPass")?.value;
    const currentUser = sessionStorage.getItem("progrowth_user");
    
    if (!currentUser || !validateSession()) { showNotif("❌ Silakan login", true); return; }
    if (!p1 || p1.length < 4) { showNotif("❌ Password minimal 4 karakter", true); return; }
    if (p1 !== p2) { showNotif("❌ Password tidak sama", true); return; }
    
    try {
        const newHash = simpleHash(p1, currentUser);
        if (currentUserId) {
            await set(ref(db, `data/users/${currentUserId}/passwordHash`), newHash);
        }
        await set(ref(db, `data/auth/${currentUser}`), newHash);
        showNotif("✅ Password berhasil diubah!");
        const modal = bootstrap.Modal.getInstance(document.getElementById("passModal"));
        if (modal) modal.hide();
    } catch (err) { showNotif("❌ Gagal mengubah password", true); }
}

// ============ UPDATE PROFILE PHOTO ============
export async function updateProfilePhoto(photoBase64) {
    const currentUser = sessionStorage.getItem("progrowth_user");
    if (!currentUser || !validateSession()) { showNotif("❌ Silakan login", true); return; }
    try {
        if (currentUserId) {
            await update(ref(db), { [`data/users/${currentUserId}/photo`]: photoBase64 });
        }
        await update(ref(db), { [`data/profiles/${currentUser}/photo`]: photoBase64 });
        currentProfilePhoto = photoBase64;
        updateProfileUI();
        showNotif("✅ Foto profil berhasil diupdate!");
        const modal = bootstrap.Modal.getInstance(document.getElementById("profileModal"));
        if (modal) modal.hide();
    } catch (err) { showNotif("❌ Gagal update foto", true); }
}

// ============ HANDLE PROFILE PHOTO UPLOAD ============
export async function handleProfilePhotoUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showNotif("❌ Foto maksimal 2MB", true); return; }
    const { compressImage: compress } = await import('./utils.js');
    const compressed = await compress(file, 1);
    await updateProfilePhoto(compressed);
    input.value = '';
}

// ============ LOGOUT ============
export function confirmLogout() {
    const modalEl = document.getElementById("confirmLogoutModal");
    if (!modalEl) { handleLogout(); return; }
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    const confirmBtn = document.getElementById("confirmLogoutBtn");
    if (confirmBtn) {
        confirmBtn.onclick = () => { modal.hide(); handleLogout(); };
    }
}

export function handleLogout() {
    sessionStorage.clear();
    setCurrentUserUtil(null);
    currentUsername = null;
    currentUserId = null;
    currentUserData = null;
    
    const loginScreen = document.getElementById("login-screen");
    const sidebar = document.getElementById("app-sidebar");
    const appContent = document.getElementById("app-content");
    
    if (loginScreen) {
        loginScreen.style.display = "flex";
        loginScreen.style.opacity = "1";
    }
    if (sidebar) sidebar.style.display = "none";
    if (appContent) appContent.style.display = "none";
    
    showNotif("👋 Anda telah keluar");
}

// ============ OPEN PROFILE MODAL ============
export function openProfileModal() {
    updateProfileUI();
    if (typeof renderBirthdayInProfile === 'function') renderBirthdayInProfile();
    const modalEl = document.getElementById("profileModal");
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

export function openChangePasswordFromProfile() {
    const profileModal = bootstrap.Modal.getInstance(document.getElementById("profileModal"));
    if (profileModal) profileModal.hide();
    setTimeout(() => {
        const passModalEl = document.getElementById("passModal");
        if (passModalEl) {
            const passModal = new bootstrap.Modal(passModalEl);
            passModal.show();
        }
    }, 300);
}

// ============ INITIALIZE DEFAULT USERS ============
async function initializeDefaultUsers() {
    const defaultUsers = [
        { username: "FACHMI", fullname: "Fachmi", phone: "081234567890", email: "fachmi@growthogether.com", password: "12345" },
        { username: "AZIZAH", fullname: "Azizah", phone: "081234567891", email: "azizah@growthogether.com", password: "12345" }
    ];
    
    for (const user of defaultUsers) {
        const exists = await findUserByIdentifier(user.username);
        if (!exists) {
            const userId = push(ref(db, 'data/users')).key;
            const passwordHash = simpleHash(user.password, user.username);
            await set(ref(db, `data/users/${userId}`), {
                userId, ...user, passwordHash, status: 'merencanakan', createdAt: Date.now()
            });
            await set(ref(db, `data/auth/${user.username}`), passwordHash);
            await set(ref(db, `data/profiles/${user.username}`), {
                fullname: user.fullname, status: 'merencanakan', createdAt: Date.now()
            });
            console.log(`Default user created: ${user.username}`);
        }
    }
}

// ============ INITIALIZE DEFAULT AUTH ============
export async function initializeDefaultAuth() {
    await initializeDefaultUsers();
}

// ============ INIT PROFILE ON LOAD ============
export async function initProfile() {
    await initializeDefaultUsers();
    const savedUser = sessionStorage.getItem("progrowth_user");
    if (savedUser && validateSession()) {
        const user = await findUserByIdentifier(savedUser);
        if (user) await loadProfileData(savedUser, user);
    }
}

// ============ EXPORT SEMUA FUNGSI (HANYA SEKALI) ============
export {
    cleanupAuthListeners,
    forceRefreshProfile,
    updateProfileUI,
    validateSession,
    handleLogin,
    handleRegister,
    resetToDefaultPassword,
    updateCloudPassword,
    confirmLogout,
    handleLogout,
    openProfileModal,
    openChangePasswordFromProfile,
    handleProfilePhotoUpload,
    updateStatus,
    initProfile,
    initializeDefaultAuth
};

// ============ WINDOW EXPORTS (UNTUK AKSES GLOBAL) ============
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
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

window.switchTab = (tab) => {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => btn.classList.remove('active'));
    if (tab === 'login') {
        if (loginTab) loginTab.style.display = 'block';
        if (registerTab) registerTab.style.display = 'none';
        document.querySelector('.tab-btn[data-tab="login"]')?.classList.add('active');
    } else {
        if (loginTab) loginTab.style.display = 'none';
        if (registerTab) registerTab.style.display = 'block';
        document.querySelector('.tab-btn[data-tab="register"]')?.classList.add('active');
    }
    const errorDiv = document.getElementById('loginErrorMsg');
    const successDiv = document.getElementById('loginSuccessMsg');
    if (errorDiv) errorDiv.style.display = 'none';
    if (successDiv) successDiv.style.display = 'none';
};

// ============ INITIALIZE ============
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initProfile(); });
} else {
    initProfile();
}

// ============ REAL-TIME VALIDATION ============
setTimeout(() => {
    const usernameInput = document.getElementById('regUsername');
    const phoneInput = document.getElementById('regPhone');
    const emailInput = document.getElementById('regEmail');
    
    if (usernameInput) usernameInput.addEventListener('input', (e) => validateRegisterField('username', e.target.value));
    if (phoneInput) phoneInput.addEventListener('input', (e) => validateRegisterField('phone', e.target.value));
    if (emailInput) emailInput.addEventListener('input', (e) => validateRegisterField('email', e.target.value));
}, 500);
