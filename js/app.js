// js/app.js - Main Application (Tanpa Toggle Sidebar)
import { db, ref, onValue, set } from './firebase-config.js';
import { 
  masterData, setMasterData, showNotif, togglePrivacy, setCurrentUser, 
  showLoading, hideLoading, getCache, setCache, clearCache, throttle,
  triggerConfetti, initClickAnimation
} from './utils.js';
import { 
  handleLogin, 
  updateCloudPassword, 
  confirmLogout, 
  handleLogout, 
  openProfileModal, 
  updateStatus, 
  handleProfilePhotoUpload, 
  openChangePasswordFromProfile,
  forceRefreshProfile,
  updateProfileUI,
  initProfile
} from './auth.js';
import { renderDashboard } from './dashboard.js';
import { 
  renderCalendar, 
  renderMomentsList, 
  saveMoment, 
  viewMomentDetail, 
  deleteMomentFromDetail, 
  changeMonth, 
  selectMomentDate, 
  openMomentModal, 
  handleMultiplePhotos, 
  removePhotoAtIndex, 
  editMomentFromDetail 
} from './moment.js';
import { initKeuangan } from './keuangan.js';
import { initCatatan } from './catatan.js';
import { initImpian } from './impian.js';

let firebaseListener = null;
let currentPage = 'dashboard';
let appInitialized = false;

// Show initial loading screen
function showInitialLoading() {
  const loader = document.createElement('div');
  loader.id = 'initialLoader';
  loader.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    transition: opacity 0.5s;
  `;
  loader.innerHTML = `
    <div class="text-center text-white">
      <i class="bi bi-arrow-through-heart-fill fs-1 mb-3 floating-icon"></i>
      <h3 class="fw-bold">growthogether</h3>
      <p class="mb-3">jalan bareng, mimpi nyata</p>
      <div class="spinner-border text-white" role="status" style="width: 44px; height: 44px;">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3 small opacity-75">Mempersiapkan aplikasi...</p>
    </div>
  `;
  document.body.appendChild(loader);
}

function hideInitialLoading() {
  const loader = document.getElementById('initialLoader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 500);
  }
}

async function loadComponents() {
  try {
    console.log("Loading components...");
    
    const [sidebarHtml, bottomNavHtml, modalsHtml, contentHtml, loginHtml] = await Promise.all([
      fetch('components/sidebar.html').then(r => r.text()),
      fetch('components/navbar.html').then(r => r.text()),
      fetch('components/modals.html').then(r => r.text()),
      fetch('components/content.html').then(r => r.text()),
      fetch('components/login.html').then(r => r.text())
    ]);
    
    document.getElementById('sidebar-container').innerHTML = sidebarHtml;
    document.getElementById('bottom-nav-container').innerHTML = bottomNavHtml;
    document.getElementById('modals-container').innerHTML = modalsHtml;
    document.getElementById('app-content').innerHTML = contentHtml;
    document.getElementById('login-screen').innerHTML = loginHtml;
    
    console.log("Components loaded successfully");
    attachEventListeners();
    initDarkMode();
    handleResize();
    
  } catch (error) {
    console.error('Error loading components:', error);
    showNotif("❌ Gagal memuat aplikasi", true, 'error');
  }
}

function initDarkMode() {
  const darkFab = document.getElementById("darkModeFab");
  if (darkFab) {
    const saved = localStorage.getItem("darkMode");
    if (saved === "enabled") document.body.classList.add("dark");
    
    // Update icon sesuai mode
    if (document.body.classList.contains("dark")) {
      darkFab.innerHTML = '<i class="bi bi-brightness-high-fill fs-5"></i>';
    } else {
      darkFab.innerHTML = '<i class="bi bi-moon-stars fs-5"></i>';
    }
    
    darkFab.onclick = () => {
      document.body.classList.toggle("dark");
      const isDark = document.body.classList.contains("dark");
      localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
      darkFab.innerHTML = isDark ? '<i class="bi bi-brightness-high-fill fs-5"></i>' : '<i class="bi bi-moon-stars fs-5"></i>';
      showNotif(isDark ? "🌙 Mode Gelap Aktif" : "☀️ Mode Terang Aktif", false, 'info');
    };
  }
}

function handleResize() {
  const appContent = document.getElementById("app-content");
  const sidebar = document.getElementById("app-sidebar");
  
  if (window.innerWidth > 768) {
    if (appContent) appContent.style.marginLeft = "280px";
    if (sidebar) sidebar.style.display = "flex";
  } else {
    if (appContent) appContent.style.marginLeft = "0";
    if (sidebar) sidebar.style.display = "none";
  }
}

function attachEventListeners() {
  console.log("Attaching event listeners...");
  
  // Profile trigger dari sidebar (desktop)
  document.body.addEventListener('click', (e) => {
    const profileTrigger = e.target.closest('#profileTrigger');
    if (profileTrigger) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof openProfileModal === 'function') {
        openProfileModal();
      }
    }
  });
  
  // Profile menu dari bottom nav (mobile)
  const profileMenuBtn = document.getElementById('profileMenuBtn');
  if (profileMenuBtn) {
    profileMenuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof openProfileModal === 'function') {
        openProfileModal();
      }
    });
  }
  
  // Logout dari bottom nav (mobile)
  const logoutMenuBtn = document.getElementById('logoutMenuBtn');
  if (logoutMenuBtn) {
    logoutMenuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      confirmLogout();
    });
  }
  
  // Logout dari sidebar (desktop)
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      confirmLogout();
    });
  }
  
  // Privacy toggle
  document.querySelectorAll("#privacyToggleDash").forEach(btn => {
    if (btn) {
      btn.removeEventListener('click', btn._privacyListener);
      btn._privacyListener = () => {
        togglePrivacy();
        if (window.renderDashboard) window.renderDashboard();
      };
      btn.addEventListener('click', btn._privacyListener);
    }
  });
  
  // Navigation
  const throttledShowPage = throttle((page) => {
    showPage(page);
  }, 300);
  
  document.querySelectorAll(".nav-link, .bottom-nav-item").forEach(el => {
    // Skip khusus untuk profile dan logout
    if (el.id === 'profileMenuBtn' || el.id === 'logoutMenuBtn') return;
    
    el.removeEventListener('click', el._navListener);
    el._navListener = (e) => {
      const page = el.getAttribute("data-page");
      if (page) {
        throttledShowPage(page);
      }
    };
    el.addEventListener('click', el._navListener);
  });
  
  // Online/Offline detection
  window.addEventListener('online', () => { 
    showNotif("📡 Koneksi kembali online", false, 'success');
    clearCache();
  });
  window.addEventListener('offline', () => { showNotif("⚠️ Koneksi terputus", true, 'error'); });
  window.addEventListener('resize', () => { handleResize(); });
}

function showPage(pageId) {
  console.log("Showing page:", pageId);
  currentPage = pageId;
  
  document.querySelectorAll("section").forEach(s => {
    s.style.display = "none";
  });
  
  const pageElement = document.getElementById(`${pageId}-page`);
  if (pageElement) {
    pageElement.style.display = "block";
  }
  
  document.querySelectorAll(".nav-link, .bottom-nav-item").forEach(el => {
    el.classList.remove("active");
  });
  document.querySelectorAll(`[data-page="${pageId}"]`).forEach(el => {
    el.classList.add("active");
  });
  
  setTimeout(() => {
    if (pageId === "moment") {
      if (typeof renderCalendar === 'function') renderCalendar();
      if (typeof renderMomentsList === 'function') renderMomentsList();
    } else if (pageId === "dashboard") {
      if (typeof renderDashboard === 'function') renderDashboard();
    } else if (pageId === "keuangan") {
      if (typeof initKeuangan === 'function') initKeuangan();
    } else if (pageId === "catatan") {
      if (typeof initCatatan === 'function') initCatatan();
    } else if (pageId === "impian") {
      if (typeof initImpian === 'function') initImpian();
    }
  }, 50);
}

function setupAppSession(u) {
  console.log("Setting up session for user:", u);
  
  const loginScreen = document.getElementById("login-screen");
  const sidebar = document.getElementById("app-sidebar");
  const appContent = document.getElementById("app-content");
  
  if (loginScreen) {
    loginScreen.style.transition = 'all 0.3s ease-out';
    loginScreen.style.opacity = '0';
    loginScreen.style.transform = 'scale(0.95)';
    setTimeout(() => { loginScreen.style.display = "none"; }, 300);
  }
  
  if (sidebar) {
    if (window.innerWidth > 768) {
      sidebar.style.display = "flex";
    } else {
      sidebar.style.display = "none";
    }
  }
  
  if (appContent) {
    appContent.style.display = "block";
    appContent.style.opacity = '0';
    setTimeout(() => { if (appContent) appContent.style.opacity = '1'; }, 100);
  }
  
  const displayName = u === "FACHMI" ? "Fachmi" : "Azizah";
  
  const userGreet = document.getElementById("userGreet");
  if (userGreet) userGreet.innerText = displayName;
  
  setTimeout(() => {
    if (typeof forceRefreshProfile === 'function') forceRefreshProfile();
    if (typeof updateProfileUI === 'function') updateProfileUI();
    handleResize();
  }, 200);
  
  renderDashboard();
  showPage('dashboard');
  
  setTimeout(() => {
    if (typeof triggerConfetti === 'function') {
      triggerConfetti();
      showNotif(`🎉 Selamat datang, ${displayName}!`, false, 'success');
    }
  }, 500);
}

function checkAuth() {
  const savedUser = sessionStorage.getItem("progrowth_user");
  if (savedUser) {
    setCurrentUser(savedUser);
    setupAppSession(savedUser);
  }
}

function initFirebaseListener() {
  if (!firebaseListener && !appInitialized) {
    console.log("Initializing Firebase listener...");
    firebaseListener = onValue(ref(db, "data/"), (snapshot) => {
      const data = snapshot.val() || { 
        dreams: {}, plans: {}, finances: {}, settings: {}, 
        moments: {}, vendors: {}, profiles: {}, keuangan: {},
        catatan: {}, impian: {}
      };
      setMasterData(data);
      
      if (!data.auth) {
        set(ref(db, "data/auth"), { FACHMI: "gokil223", AZIZAH: "1234" })
          .catch(err => console.error("Error creating default auth:", err));
      }
      
      const loggedUser = sessionStorage.getItem("progrowth_user");
      if (loggedUser && appInitialized) {
        if (currentPage === "dashboard" && typeof renderDashboard === 'function') renderDashboard();
        else if (currentPage === "moment" && typeof renderCalendar === 'function') { 
          renderCalendar(); 
          if (typeof renderMomentsList === 'function') renderMomentsList(); 
        }
        else if (currentPage === "keuangan" && typeof initKeuangan === 'function') initKeuangan();
        else if (currentPage === "catatan" && typeof initCatatan === 'function') initCatatan();
      }
      
      console.log("Firebase data synced");
    }, (error) => {
      console.error("Firebase listener error:", error);
      showNotif("⚠️ Gagal terhubung ke server", true, 'error');
    });
  }
}

function injectToastContainer() {
  if (!document.getElementById('customToastContainer')) {
    const toastContainer = document.createElement('div');
    toastContainer.id = 'customToastContainer';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }
}

async function init() {
  console.log("🚀 Initializing Growthogether App...");
  showInitialLoading();
  
  injectToastContainer();
  await loadComponents();
  checkAuth();
  initFirebaseListener();
  
  if (typeof initClickAnimation === 'function') {
    initClickAnimation();
  }
  
  appInitialized = true;
  
  setTimeout(() => {
    hideInitialLoading();
  }, 1000);
  
  console.log("✅ App initialized successfully");
}

// Exports
window.setupAppSession = setupAppSession;
window.showPage = showPage;
window.renderDashboard = renderDashboard;
window.togglePrivacy = togglePrivacy;
window.updateCloudPassword = updateCloudPassword;
window.openProfileModal = openProfileModal;
window.openChangePasswordFromProfile = openChangePasswordFromProfile;
window.handleProfilePhotoUpload = handleProfilePhotoUpload;
window.updateStatus = updateStatus;
window.forceRefreshProfile = forceRefreshProfile;
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
window.triggerConfetti = triggerConfetti;

document.addEventListener("DOMContentLoaded", init);
