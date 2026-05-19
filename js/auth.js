// js/auth.js - Tanpa Fitur Lupa Password
import { db, ref, get, update } from './firebase-config.js';
import { showNotif, setCurrentUser } from './utils.js';

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
    
    // Reset form
    document.getElementById("newPass").value = "";
    document.getElementById("confirmPass").value = "";
    
    const modal = bootstrap.Modal.getInstance(document.getElementById("passModal"));
    if (modal) modal.hide();
  } catch (err) {
    console.error(err);
    showNotif("❌ Gagal mengubah password", true);
  }
}

export function confirmLogout() {
  const modalEl = document.getElementById("confirmLogoutModal");
  if (modalEl) new bootstrap.Modal(modalEl).show();
}

export function handleLogout() {
  sessionStorage.removeItem("progrowth_user");
  setCurrentUser(null);
  
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

// Export ke window
window.handleLogin = handleLogin;
window.updateCloudPassword = updateCloudPassword;
window.confirmLogout = confirmLogout;
window.handleLogout = handleLogout;
