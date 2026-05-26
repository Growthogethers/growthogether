// js/app.js - Main Application (Tanpa Bottom Nav)
import { db, ref, onValue, set } from './firebase-config.js';
import { 
  masterData, setMasterData, showNotif, togglePrivacy, setCurrentUser, 
  showLoading, hideLoading, getCache, setCache, clearCache, throttle,
  triggerConfetti, initClickAnimation, escapeHtml
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
  initProfile,
  validateSession,
  cleanupAuthListeners
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
  editMomentFromDetail,
  clearCalendarCache
} from './moment.js';
import { initKeuangan } from './keuangan.js';
import { initCatatan } from './catatan.js';
import { initImpian } from './impian.js';

let firebaseListener = null;
let currentPage = 'dashboard';
let appInitialized = false;
let offlineIndicator = null;
let activeListeners = [];

// ============ CLEANUP SEMUA LISTENER ============
export function cleanupAllListeners() {
  console.log("Cleaning up all Firebase listeners...");
  
  if (firebaseListener) {
    firebaseListener();
    firebaseListener = null;
  }
  
  if (activeListeners.length > 0) {
    activeListeners.forEach(listener => {
      if (typeof listener === 'function') {
        listener();
      }
    });
    activeListeners = [];
  }
  
  if (typeof cleanupAuthListeners === 'function') {
    cleanupAuthListeners();
  }
  
  if (typeof clearCalendarCache === 'function') {
    clearCalendarCache();
  }
  
  clearCache();
  
  console.log("All listeners cleaned up");
}

export function registerListener(listener) {
  if (typeof listener === 'function') {
    activeListeners.push(listener);
  }
}

// ============ LOADING SCREEN ============
function showInitialLoading() {
  const loader = document.createElement('div');
  loader.id = 'initialLoader';
  loader.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #7009b4 0%, #4000C6 100%);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    transition: opacity 0.5s;
  `;
  loader.innerHTML = `
    <div class="text-center text-white">
      <i class="bi bi-arrow-through-heart-fill fs-1 mb-3 floating-icon" style="animation: pulse 2s ease-in-out infinite; display: inline-block;"></i>
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

// ============ LOAD COMPONENTS ============
async function loadComponents() {
  try {
    console.log("Loading components...");
    
    const [sidebarHtml, modalsHtml, contentHtml, loginHtml] = await Promise.all([
      fetch('components/sidebar.html').then(r => r.text()),
      fetch('components/modals.html').then(r => r.text()),
      fetch('components/content.html').then(r => r.text()),
      fetch('components/login.html').then(r => r.text())
    ]);
    
    document.getElementById('sidebar-container').innerHTML = sidebarHtml;
    document.getElementById('modals-container').innerHTML = modalsHtml;
    document.getElementById('app-content').innerHTML = contentHtml;
    document.getElementById('login-screen').innerHTML = loginHtml;
    
    console.log("Components loaded successfully");
    attachEventListeners();
    initDarkMode();
    initHamburgerMenu();
    handleResize();
    
  } catch (error) {
    console.error('Error loading components:', error);
    showNotif("❌ Gagal memuat aplikasi", true, 'error');
  }
}

// ============ HAMBURGER MENU FUNCTIONS ============
function initHamburgerMenu() {
  const hamburgerBtn = document.getElementById('hamburgerMenuBtn');
  const sidebar = document.getElementById('app-sidebar');
  const closeBtn = document.getElementById('sidebarCloseBtn');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (!hamburgerBtn || !sidebar) {
    console.log("Hamburger menu elements not found, will retry later");
    setTimeout(() => {
      const retryBtn = document.getElementById('hamburgerMenuBtn');
      const retrySidebar = document.getElementById('app-sidebar');
      if (retryBtn && retrySidebar) {
        initHamburgerMenu();
      }
    }, 500);
    return;
  }
  
  function openSidebar() {
    sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    console.log("Sidebar opened");
  }
  
  function closeSidebar() {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
    console.log("Sidebar closed");
  }
  
  hamburgerBtn.removeEventListener('click', openSidebar);
  hamburgerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSidebar();
  });
  
  if (closeBtn) {
    closeBtn.removeEventListener('click', closeSidebar);
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeSidebar();
    });
  }
  
  if (overlay) {
    overlay.removeEventListener('click', closeSidebar);
    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      closeSidebar();
    });
  }
  
  const navLinks = document.querySelectorAll('.sidebar .nav-link, #app-sidebar .nav-link');
  navLinks.forEach(link => {
    link.removeEventListener('click', closeSidebar);
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });
  
  window.removeEventListener('resize', closeSidebar);
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeSidebar();
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
  
  console.log("Hamburger menu initialized");
}

// ============ DARK MODE ============
function initDarkMode() {
  console.log("Initializing dark mode...");
  
  let darkFab = document.getElementById("darkModeFab");
  if (!darkFab) {
    darkFab = document.createElement('button');
    darkFab.id = 'darkModeFab';
    darkFab.className = 'dark-mode-fab';
    darkFab.setAttribute('aria-label', 'Mode gelap/terang');
    document.body.appendChild(darkFab);
  }
  
  const savedMode = localStorage.getItem("darkMode");
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  let isDark = false;
  if (savedMode === "enabled") {
    isDark = true;
  } else if (savedMode === "disabled") {
    isDark = false;
  } else {
    isDark = systemDark;
  }
  
  applyDarkMode(isDark, darkFab);
  
  darkFab.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isCurrentlyDark = document.body.classList.contains("dark");
    const newDarkState = !isCurrentlyDark;
    
    applyDarkMode(newDarkState, darkFab);
    localStorage.setItem("darkMode", newDarkState ? "enabled" : "disabled");
    
    showNotif(newDarkState ? "🌙 Mode Gelap Aktif" : "☀️ Mode Terang Aktif", false, 'info');
  };
  
  console.log("Dark mode initialized, isDark:", isDark);
}

function applyDarkMode(isDark, darkFab) {
  if (isDark) {
    document.body.classList.add("dark");
    if (darkFab) darkFab.innerHTML = '<i class="bi bi-brightness-high-fill fs-5"></i>';
  } else {
    document.body.classList.remove("dark");
    if (darkFab) darkFab.innerHTML = '<i class="bi bi-moon-stars fs-5"></i>';
  }
  
  document.documentElement.style.setProperty('--bg-body', isDark ? '#1a1025' : '#faf5ff');
  document.documentElement.style.setProperty('--card-bg', isDark ? '#2d1a3a' : '#ffffff');
  document.documentElement.style.setProperty('--text-primary', isDark ? '#e9d5ff' : '#4c1d95');
  document.documentElement.style.setProperty('--text-muted', isDark ? '#d8b4fe' : '#6b21a5');
  document.documentElement.style.setProperty('--border-light', isDark ? '#4c1d6e' : '#e9d5ff');
}

// ============ HANDLE RESIZE ============
function handleResize() {
  const appContent = document.getElementById("app-content");
  const sidebar = document.getElementById("app-sidebar");
  const hamburgerBtn = document.getElementById("hamburgerMenuBtn");
  
  if (window.innerWidth > 768) {
    // DESKTOP MODE
    if (appContent) appContent.style.marginLeft = "280px";
    if (sidebar) {
      sidebar.style.display = "flex";
      sidebar.classList.remove('open');
    }
    if (hamburgerBtn) hamburgerBtn.style.display = "none";
    
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  } else {
    // MOBILE MODE
    if (appContent) appContent.style.marginLeft = "0";
    if (sidebar) {
      sidebar.style.display = "flex";
    }
    if (hamburgerBtn) hamburgerBtn.style.display = "flex";
  }
}

// ============ OFFLINE INDICATOR ============
function initOfflineIndicator() {
  if (offlineIndicator) return;
  
  offlineIndicator = document.createElement('div');
  offlineIndicator.id = 'offlineIndicator';
  offlineIndicator.innerHTML = `
    <i class="bi bi-wifi-off me-2"></i>
    Offline - Perubahan tidak akan tersimpan sampai koneksi kembali
  `;
  document.body.appendChild(offlineIndicator);
  
  window.addEventListener('online', () => {
    if (offlineIndicator) {
      offlineIndicator.style.transform = 'translateY(-100%)';
    }
    showNotif('📡 Koneksi kembali online!', false, 'success');
    clearCache();
  });
  
  window.addEventListener('offline', () => {
    if (offlineIndicator) {
      offlineIndicator.style.transform = 'translateY(0)';
    }
    showNotif('⚠️ Koneksi terputus. Perubahan tidak akan tersimpan.', true, 'error');
  });
}

// ============ ATTACH EVENT LISTENERS ============
function attachEventListeners() {
  console.log("Attaching event listeners...");
  
  const profileTrigger = document.getElementById('profileTrigger');
  if (profileTrigger) {
    profileTrigger.removeEventListener('click', profileTrigger._profileListener);
    profileTrigger._profileListener = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof openProfileModal === 'function') {
        openProfileModal();
      }
    };
    profileTrigger.addEventListener('click', profileTrigger._profileListener);
  }
  
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.removeEventListener('click', sidebarLogoutBtn._sidebarLogoutListener);
    sidebarLogoutBtn._sidebarLogoutListener = (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirmLogout();
    };
    sidebarLogoutBtn.addEventListener('click', sidebarLogoutBtn._sidebarLogoutListener);
  }
  
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
  
  const throttledShowPage = throttle((page) => {
    showPage(page);
  }, 300);
  
  document.querySelectorAll(".nav-link").forEach(el => {
    el.removeEventListener('click', el._navListener);
    el._navListener = (e) => {
      const page = el.getAttribute("data-page");
      if (page) {
        throttledShowPage(page);
      }
    };
    el.addEventListener('click', el._navListener);
  });
  
  window.addEventListener('online', () => { 
    showNotif("📡 Koneksi kembali online", false, 'success');
    clearCache();
  });
  window.addEventListener('offline', () => { showNotif("⚠️ Koneksi terputus", true, 'error'); });
  window.addEventListener('resize', () => { handleResize(); });
}

// ============ SHOW PAGE ============
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
  
  document.querySelectorAll(".nav-link").forEach(el => {
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

// ============ SETUP APP SESSION ============
function setupAppSession(u) {
  console.log("Setting up session for user:", u);
  
  const loginScreen = document.getElementById("login-screen");
  const sidebar = document.getElementById("app-sidebar");
  const appContent = document.getElementById("app-content");
  const hamburgerBtn = document.getElementById("hamburgerMenuBtn");
  
  if (loginScreen) {
    loginScreen.style.transition = 'all 0.3s ease-out';
    loginScreen.style.opacity = '0';
    loginScreen.style.transform = 'scale(0.95)';
    setTimeout(() => { loginScreen.style.display = "none"; }, 300);
  }
  
  handleResize();
  
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

// ============ CHECK AUTH ============
function checkAuth() {
  const savedUser = sessionStorage.getItem("progrowth_user");
  
  if (savedUser && validateSession && validateSession()) {
    setCurrentUser(savedUser);
    setupAppSession(savedUser);
  } else if (savedUser) {
    console.log("Invalid session, forcing logout");
    sessionStorage.clear();
    location.reload();
  }
}

// ============ FIREBASE LISTENER ============
function initFirebaseListener() {
  cleanupAllListeners();
  
  if (!appInitialized) {
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
      if (loggedUser && appInitialized && validateSession && validateSession()) {
        if (currentPage === "dashboard" && typeof renderDashboard === 'function') renderDashboard();
        else if (currentPage === "moment" && typeof renderCalendar === 'function') { 
          renderCalendar(); 
          if (typeof renderMomentsList === 'function') renderMomentsList(); 
        }
        else if (currentPage === "keuangan" && typeof initKeuangan === 'function') initKeuangan();
        else if (currentPage === "catatan" && typeof initCatatan === 'function') initCatatan();
        else if (currentPage === "impian" && typeof initImpian === 'function') initImpian();
      }
      
      console.log("Firebase data synced");
    }, (error) => {
      console.error("Firebase listener error:", error);
      showNotif("⚠️ Gagal terhubung ke server", true, 'error');
    });
  }
}

// ============ TOAST CONTAINER ============
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

// ============ INIT APP ============
async function init() {
  console.log("🚀 Initializing Growthogether App...");
  showInitialLoading();
  
  injectToastContainer();
  initOfflineIndicator();
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

// ============ EXPORTS ============
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
window.confirmLogout = confirmLogout;
window.cleanupAllListeners = cleanupAllListeners;
window.registerListener = registerListener;
window.initHamburgerMenu = initHamburgerMenu;
window.handleResize = handleResize;

// Register logout handler
window.handleLogout = handleLogout;

document.addEventListener("DOMContentLoaded", init);
