// js/auth.js - FULL VERSION with Animations
import { db, ref, get, update } from './firebase-config.js';
import { showNotif, setCurrentUser } from './utils.js';

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
    shakeElement(document.getElementById("loginPass"));
    showNotif("Password harus diisi", true); 
    return; 
  }
  
  // Loading animation
  const originalBtnText = loginBtn.innerHTML;
  loginBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Memeriksa...';
  loginBtn.disabled = true;
  
  try {
    const snap = await get(ref(db, `data/auth/${u}`));
    if (snap.val() === p) {
      setCurrentUser(u);
      sessionStorage.setItem("progrowth_user", u);
      
      // Success animation
      loginBtn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Berhasil!';
      loginBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
      
      setTimeout(() => {
        if (window.setupAppSession) {
          window.setupAppSession(u);
        }
      }, 500);
      
      showNotif(`Selamat datang, ${u} 🎉`);
    } else {
      loginBtn.innerHTML = originalBtnText;
      loginBtn.disabled = false;
      
      if (errorSpan) errorSpan.innerText = "⚠️ Password salah!";
      if (errorDiv) errorDiv.style.display = "block";
      shakeElement(document.getElementById("loginPass"));
      showNotif("Password salah! Coba lagi", true);
    }
  } catch (e) {
    loginBtn.innerHTML = originalBtnText;
    loginBtn.disabled = false;
    
    if (errorSpan) errorSpan.innerText = "⚠️ Gagal koneksi.";
    if (errorDiv) errorDiv.style.display = "block";
    showNotif("Koneksi gagal", true);
  }
}

// ============ CHANGE PASSWORD ============
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
    shakeElement(document.getElementById("newPass"));
    return;
  }
  
  if (p1 !== p2) {
    showNotif("❌ Password baru dan konfirmasi tidak sama", true);
    shakeElement(document.getElementById("confirmPass"));
    return;
  }
  
  const updateBtn = document.querySelector("#passModal .btn-primary");
  const originalText = updateBtn.innerHTML;
  updateBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Menyimpan...';
  updateBtn.disabled = true;
  
  try {
    await update(ref(db), { [`data/auth/${currentUser}`]: p1 });
    
    // Success animation
    updateBtn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Berhasil!';
    updateBtn.style.background = "#10b981";
    
    setTimeout(() => {
      showNotif("✅ Password berhasil diubah!");
      document.getElementById("newPass").value = "";
      document.getElementById("confirmPass").value = "";
      
      const modal = bootstrap.Modal.getInstance(document.getElementById("passModal"));
      if (modal) modal.hide();
      
      // Reset button
      updateBtn.innerHTML = originalText;
      updateBtn.style.background = "";
      updateBtn.disabled = false;
    }, 1000);
    
  } catch (err) {
    console.error(err);
    updateBtn.innerHTML = originalText;
    updateBtn.disabled = false;
    showNotif("❌ Gagal mengubah password", true);
  }
}

// ============ RESET PASSWORD (LUPA PASSWORD) ============
export async function resetPassword() {
  const user = document.getElementById("resetUserSelect")?.value;
  
  if (!user) {
    showNotif("❌ Pilih akun terlebih dahulu", true);
    return;
  }
  
  const defaultPass = user === "FACHMI" ? "gokil223" : "1234";
  const resetBtn = document.querySelector("#forgotPassModal .btn-reset-action");
  const originalText = resetBtn ? resetBtn.innerHTML : 'Reset Password';
  
  if (resetBtn) {
    resetBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Mereset...';
    resetBtn.disabled = true;
  }
  
  try {
    await update(ref(db), { [`data/auth/${user}`]: defaultPass });
    
    // Show success animation
    showSuccessAnimation();
    
    // Update hint display
    const successIcon = document.createElement('div');
    successIcon.className = 'reset-success-icon';
    successIcon.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
    document.querySelector("#forgotPassModal .modal-body")?.appendChild(successIcon);
    
    setTimeout(async () => {
      showNotif(`✅ Password ${user === "FACHMI" ? "Fachmi" : "Azizah"} berhasil direset!`, false);
      
      // Auto-fill password di login form
      const loginPass = document.getElementById("loginPass");
      if (loginPass) {
        loginPass.value = defaultPass;
        highlightSuccess(loginPass);
      }
      
      // Select user yang direset
      const loginUser = document.getElementById("loginUser");
      if (loginUser) loginUser.value = user;
      
      // Close modal with animation
      const modalElement = document.getElementById("forgotPassModal");
      if (modalElement) {
        modalElement.classList.add('modal-closing');
        setTimeout(() => {
          const modal = bootstrap.Modal.getInstance(modalElement);
          if (modal) modal.hide();
          modalElement.classList.remove('modal-closing');
        }, 300);
      }
      
      if (resetBtn) {
        resetBtn.innerHTML = originalText;
        resetBtn.disabled = false;
      }
    }, 1500);
    
  } catch (err) {
    console.error(err);
    if (resetBtn) {
      resetBtn.innerHTML = originalText;
      resetBtn.disabled = false;
    }
    showNotif("❌ Gagal reset password, cek koneksi", true);
  }
}

// ============ OPEN MODAL WITH ANIMATION (PREMIUM) ============
export function openForgotPasswordModal() {
  const modalElement = document.getElementById("forgotPassModal");
  
  if (!modalElement) {
    console.error("Modal forgotPassModal tidak ditemukan");
    showNotif("❌ Terjadi kesalahan, coba lagi", true);
    return;
  }
  
  // Reset modal content animation
  const modalContent = modalElement.querySelector('.modal-content');
  const modalBody = modalElement.querySelector('.modal-body');
  
  // Add entering animation class
  modalElement.classList.add('modal-enter');
  
  // Create floating particles
  createParticles();
  
  const modal = new bootstrap.Modal(modalElement, {
    backdrop: 'static',
    keyboard: false
  });
  
  modal.show();
  
  // Trigger animations
  setTimeout(() => {
    if (modalContent) {
      modalContent.style.animation = 'slideInUp 0.4s cubic-bezier(0.34, 1.2, 0.64, 1)';
    }
    if (modalBody) {
      const icon = modalBody.querySelector('.floating-icon');
      if (icon) {
        icon.style.animation = 'float 3s ease-in-out infinite';
      }
    }
    modalElement.classList.remove('modal-enter');
  }, 10);
  
  // Cleanup on close
  modalElement.addEventListener('hidden.bs.modal', () => {
    modalElement.classList.remove('modal-enter');
    removeParticles();
  }, { once: true });
}

// ============ OPEN DIRECT CHANGE PASSWORD ============
export function openDirectChangePasswordModal() {
  const currentUser = sessionStorage.getItem("progrowth_user");
  
  if (currentUser) {
    const modalElement = document.getElementById("passModal");
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
      
      // Add animation to modal
      const modalContent = modalElement.querySelector('.modal-content');
      if (modalContent) {
        modalContent.style.animation = 'slideInUp 0.3s ease-out';
        setTimeout(() => {
          modalContent.style.animation = '';
        }, 300);
      }
    }
  } else {
    openForgotPasswordModal();
  }
}

// ============ UPDATE PASSWORD HINT ============
export function updatePasswordHint() {
  const userSelect = document.getElementById("resetUserSelect");
  const defaultPassHint = document.getElementById("defaultPassHint");
  const userAvatar = document.querySelector('.user-avatar-preview');
  
  if (userSelect && defaultPassHint) {
    const user = userSelect.value;
    const isFachmi = user === "FACHMI";
    
    defaultPassHint.innerText = isFachmi ? "gokil223" : "1234";
    
    // Add animation to hint
    defaultPassHint.style.animation = 'pulse 0.3s ease';
    setTimeout(() => {
      if (defaultPassHint) defaultPassHint.style.animation = '';
    }, 300);
    
    // Update avatar preview
    if (userAvatar) {
      userAvatar.innerHTML = isFachmi ? '✨' : '🌸';
      userAvatar.style.animation = 'rotate 0.5s ease';
      setTimeout(() => {
        if (userAvatar) userAvatar.style.animation = '';
      }, 500);
    }
  }
}

// ============ ANIMATION HELPER FUNCTIONS ============
function shakeElement(element) {
  if (!element) return;
  element.style.animation = 'shake 0.3s ease-in-out';
  setTimeout(() => {
    if (element) element.style.animation = '';
  }, 300);
}

function highlightSuccess(element) {
  if (!element) return;
  element.style.transition = 'all 0.3s';
  element.style.backgroundColor = '#d1fae5';
  element.style.borderColor = '#10b981';
  element.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.2)';
  setTimeout(() => {
    if (element) {
      element.style.backgroundColor = '';
      element.style.borderColor = '';
      element.style.boxShadow = '';
    }
  }, 1500);
}

function showSuccessAnimation() {
  // Create confetti effect
  for (let i = 0; i < 30; i++) {
    createConfettiPiece();
  }
}

function createConfettiPiece() {
  const confetti = document.createElement('div');
  confetti.className = 'confetti';
  confetti.style.left = Math.random() * 100 + '%';
  confetti.style.animationDelay = Math.random() * 0.5 + 's';
  confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
  document.body.appendChild(confetti);
  
  setTimeout(() => {
    confetti.remove();
  }, 2000);
}

function createParticles() {
  const particlesContainer = document.createElement('div');
  particlesContainer.className = 'particles-container';
  particlesContainer.id = 'modalParticles';
  
  for (let i = 0; i < 15; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 2 + 's';
    particle.style.animationDuration = 2 + Math.random() * 2 + 's';
    particlesContainer.appendChild(particle);
  }
  
  document.body.appendChild(particlesContainer);
}

function removeParticles() {
  const particles = document.getElementById('modalParticles');
  if (particles) particles.remove();
}

// ============ LOGOUT ============
export function confirmLogout() {
  const modalEl = document.getElementById("confirmLogoutModal");
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    
    // Add animation
    const modalContent = modalEl.querySelector('.modal-content');
    if (modalContent) {
      modalContent.style.animation = 'slideInUp 0.3s ease-out';
    }
  }
}

export function handleLogout() {
  // Logout animation
  const appContent = document.getElementById("app-content");
  if (appContent) {
    appContent.style.opacity = '0';
    appContent.style.transform = 'translateY(20px)';
  }
  
  setTimeout(() => {
    sessionStorage.removeItem("progrowth_user");
    setCurrentUser(null);
    
    const loginScreen = document.getElementById("login-screen");
    const sidebar = document.getElementById("app-sidebar");
    const appContentEl = document.getElementById("app-content");
    
    if (loginScreen) {
      loginScreen.style.display = "flex";
      loginScreen.style.opacity = '0';
      loginScreen.style.transform = 'scale(0.95)';
      setTimeout(() => {
        loginScreen.style.opacity = '1';
        loginScreen.style.transform = 'scale(1)';
      }, 50);
    }
    if (sidebar) sidebar.style.display = "none";
    if (appContentEl) {
      appContentEl.style.display = "none";
      appContentEl.style.opacity = '';
      appContentEl.style.transform = '';
    }
    
    const loginPass = document.getElementById("loginPass");
    const loginErrorMsg = document.getElementById("loginErrorMsg");
    if (loginPass) loginPass.value = "";
    if (loginErrorMsg) loginErrorMsg.style.display = "none";
    
    showNotif("👋 Anda telah keluar");
    
    const modal = bootstrap.Modal.getInstance(document.getElementById("confirmLogoutModal"));
    if (modal) modal.hide();
  }, 300);
}

// ============ EXPORTS ============
window.handleLogin = handleLogin;
window.updateCloudPassword = updateCloudPassword;
window.resetPassword = resetPassword;
window.confirmLogout = confirmLogout;
window.handleLogout = handleLogout;
window.openForgotPasswordModal = openForgotPasswordModal;
window.openDirectChangePasswordModal = openDirectChangePasswordModal;
window.updatePasswordHint = updatePasswordHint;
