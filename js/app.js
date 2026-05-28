// js/app.js - Main Application (PERBAIKAN LENGKAP dengan Partner System)
import { db, ref, onValue, set } from './firebase-config.js';
import { 
  masterData, setMasterData, showNotif, togglePrivacy, setCurrentUser, 
  showLoading, hideLoading, getCache, setCache, clearCache, throttle,
  triggerConfetti, initClickAnimation, escapeHtml,
  loadUserLevelAndLimits, renderLevelBadge, canAddMoment, canAddTransaction, canAddCatatan, getRemainingLimits,
  loadUserPartner, filterMomentsByUser, filterKeuanganByUser, currentPartner, currentPairId,
  getCatatanByPair
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
  clearCalendarCache,
  setLimitsChecker
} from './moment.js';
import { initKeuangan, setKeuanganLimitsChecker } from './keuangan.js';
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
  let loader = document.getElementById('initialLoader');
  if (!loader) {
    loader = document.createElement('div');
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
        <i class="bi bi-arrow-through-heart-fill fs-1 mb-3" style="animation: pulse 2s ease-in-out infinite; display: inline-block;"></i>
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
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const [sidebarHtml, modalsHtml, contentHtml, loginHtml] = await Promise.all([
      fetch('components/sidebar.html', { signal: controller.signal }).then(r => r.text()),
      fetch('components/modals.html', { signal: controller.signal }).then(r => r.text()),
      fetch('components/content.html', { signal: controller.signal }).then(r => r.text()),
      fetch('components/login.html', { signal: controller.signal }).then(r => r.text())
    ]);
    
    clearTimeout(timeoutId);
    
    const sidebarContainer = document.getElementById('sidebar-container');
    const modalsContainer = document.getElementById('modals-container');
    const appContent = document.getElementById('app-content');
    const loginScreen = document.getElementById('login-screen');
    
    if (sidebarContainer) sidebarContainer.innerHTML = sidebarHtml;
    if (modalsContainer) modalsContainer.innerHTML = modalsHtml;
    if (appContent) appContent.innerHTML = contentHtml;
    if (loginScreen) loginScreen.innerHTML = loginHtml;
    
    console.log("Components loaded successfully");
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    attachEventListeners();
    initDarkMode();
    initHamburgerMenu();
    handleResize();
    
    return true;
    
  } catch (error) {
    console.error('Error loading components:', error);
    const loader = document.getElementById('initialLoader');
    if (loader) {
      loader.innerHTML = `
        <div class="text-center text-white">
          <i class="bi bi-exclamation-triangle-fill fs-1 mb-3"></i>
          <h3 class="fw-bold">Gagal Memuat Aplikasi</h3>
          <p class="mb-3">${error.message}</p>
          <button class="btn btn-light rounded-pill" onclick="location.reload()">
            <i class="bi bi-arrow-repeat me-2"></i>Coba Lagi
          </button>
        </div>
      `;
    }
    return false;
  }
}

// ============ HAMBURGER MENU FUNCTIONS ============
function initHamburgerMenu() {
  setTimeout(() => {
    const hamburgerBtn = document.getElementById('hamburgerMenuBtn');
    const sidebar = document.getElementById('app-sidebar');
    const closeBtn = document.getElementById('sidebarCloseBtn');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!hamburgerBtn || !sidebar) {
      console.log("Hamburger menu elements not found, retrying...");
      setTimeout(initHamburgerMenu, 500);
      return;
    }
    
    function openSidebar() {
      sidebar.classList.add('open');
      if (overlay) overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    
    function closeSidebar() {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
    
    hamburgerBtn.onclick = (e) => {
      e.preventDefault();
      openSidebar();
    };
    
    if (closeBtn) closeBtn.onclick = (e) => {
      e.preventDefault();
      closeSidebar();
    };
    
    if (overlay) overlay.onclick = () => closeSidebar();
    
    window.onresize = () => {
      if (window.innerWidth > 768) {
        closeSidebar();
        if (overlay) overlay.classList.remove('active');
      }
    };
    
    console.log("Hamburger menu initialized");
  }, 200);
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
  
  let isDark = savedMode === "enabled" || (savedMode !== "disabled" && systemDark);
  
  function applyDarkMode(isDark) {
    if (isDark) {
      document.body.classList.add("dark");
      darkFab.innerHTML = '<i class="bi bi-brightness-high-fill fs-5"></i>';
    } else {
      document.body.classList.remove("dark");
      darkFab.innerHTML = '<i class="bi bi-moon-stars fs-5"></i>';
    }
  }
  
  applyDarkMode(isDark);
  
  darkFab.onclick = () => {
    const newDarkState = !document.body.classList.contains("dark");
    applyDarkMode(newDarkState);
    localStorage.setItem("darkMode", newDarkState ? "enabled" : "disabled");
    showNotif(newDarkState ? "🌙 Mode Gelap Aktif" : "☀️ Mode Terang Aktif", false, 'info');
  };
}

// ============ HANDLE RESIZE ============
function handleResize() {
  const appContent = document.getElementById("app-content");
  const sidebar = document.getElementById("app-sidebar");
  const hamburgerBtn = document.getElementById("hamburgerMenuBtn");
  
  if (window.innerWidth > 768) {
    if (appContent) appContent.style.marginLeft = "280px";
    if (sidebar) sidebar.classList.remove('open');
    if (hamburgerBtn) hamburgerBtn.style.display = "none";
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  } else {
    if (appContent) appContent.style.marginLeft = "0";
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
  offlineIndicator.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    text-align: center;
    padding: 10px;
    font-size: 12px;
    font-weight: 500;
    z-index: 10001;
    transform: translateY(-100%);
    transition: transform 0.3s ease;
  `;
  document.body.appendChild(offlineIndicator);
  
  window.addEventListener('online', () => {
    if (offlineIndicator) offlineIndicator.style.transform = 'translateY(-100%)';
    showNotif('📡 Koneksi kembali online!', false, 'success');
    clearCache();
  });
  
  window.addEventListener('offline', () => {
    if (offlineIndicator) offlineIndicator.style.transform = 'translateY(0)';
    showNotif('⚠️ Koneksi terputus. Perubahan tidak akan tersimpan.', true, 'error');
  });
}

// ============ ATTACH EVENT LISTENERS ============
function attachEventListeners() {
  console.log("Attaching event listeners...");
  
  const profileTrigger = document.getElementById('profileTrigger');
  if (profileTrigger) {
    profileTrigger.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof openProfileModal === 'function') openProfileModal();
    };
  }
  
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.onclick = (e) => {
      e.preventDefault();
      confirmLogout();
    };
  }
  
  document.querySelectorAll("#privacyToggleDash").forEach(btn => {
    btn.onclick = () => {
      togglePrivacy();
      if (window.renderDashboard) window.renderDashboard();
    };
  });
  
  const throttledShowPage = throttle((page) => {
    showPage(page);
  }, 300);
  
  document.querySelectorAll(".nav-link").forEach(el => {
    el.onclick = (e) => {
      const page = el.getAttribute("data-page");
      if (page) throttledShowPage(page);
    };
  });
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
      const limits = currentUserLimits;
      if (limits && limits.hasMoment === false) {
        showNotif(`⚠️ Akun Trial tidak dapat mengakses Menu Momen. Upgrade ke Basic atau Pro untuk akses penuh!`, true, 'warning');
        return;
      }
      if (typeof renderCalendar === 'function') renderCalendar();
      if (typeof renderMomentsList === 'function') renderMomentsList();
    } else if (pageId === "dashboard") {
      if (typeof renderDashboard === 'function') renderDashboard();
    } else if (pageId === "keuangan") {
      if (typeof initKeuangan === 'function') initKeuangan();
    } else if (pageId === "catatan") {
      if (typeof initCatatan === 'function') initCatatan();
    } else if (pageId === "impian") {
      const limits = currentUserLimits;
      if (limits && limits.impian === false) {
        showNotif(`⚠️ Akun Trial tidak dapat mengakses Menu Impian. Upgrade ke Basic atau Pro untuk akses penuh!`, true, 'warning');
        return;
      }
      if (typeof initImpian === 'function') initImpian();
    }
  }, 50);
}

// ============ SETUP APP SESSION ============
async function setupAppSession(u) {
  console.log("Setting up session for user:", u);
  
  // Load user level and limits
  await loadUserLevelAndLimits(u);
  
  // Load partner
  const partner = await loadUserPartner(u);
  console.log(`Partner for ${u}: ${partner}, PairId: ${currentPairId}`);
  
  renderLevelBadge();
  
  // Set limits checker
  if (typeof setLimitsChecker === 'function') {
    setLimitsChecker(canAddMoment);
  }
  if (typeof setKeuanganLimitsChecker === 'function') {
    setKeuanganLimitsChecker(canAddTransaction);
  }
  
  const loginScreen = document.getElementById("login-screen");
  const sidebar = document.getElementById("app-sidebar");
  const appContent = document.getElementById("app-content");
  const hamburgerBtn = document.getElementById("hamburgerMenuBtn");
  
  if (loginScreen) {
    loginScreen.style.transition = 'all 0.3s ease-out';
    loginScreen.style.opacity = '0';
    loginScreen.style.transform = 'scale(0.95)';
    setTimeout(() => { 
      if (loginScreen) loginScreen.style.display = "none"; 
    }, 300);
  }
  
  handleResize();
  
  if (appContent) {
    appContent.style.display = "block";
    appContent.style.opacity = '0';
    setTimeout(() => { if (appContent) appContent.style.opacity = '1'; }, 100);
  }
  
  if (hamburgerBtn) hamburgerBtn.style.display = window.innerWidth <= 768 ? "flex" : "none";
  
  const displayName = u === "FACHMI" ? "Fachmi" : "Azizah";
  const userGreet = document.getElementById("userGreet");
  if (userGreet) userGreet.innerText = displayName;
  
  // Tampilkan info pasangan di sidebar
  const partnerInfo = document.getElementById("partnerInfo");
  if (partnerInfo && partner) {
    const partnerName = partner === "FACHMI" ? "Fachmi" : partner === "AZIZAH" ? "Azizah" : partner;
    partnerInfo.innerHTML = `<small class="text-muted"><i class="bi bi-heart-fill text-danger me-1"></i> Pasangan: ${partnerName}</small>`;
  }
  
  setTimeout(() => {
    if (typeof forceRefreshProfile === 'function') forceRefreshProfile();
    if (typeof updateProfileUI === 'function') updateProfileUI();
  }, 200);
  
  renderDashboard();
  showPage('dashboard');
  
  setTimeout(() => {
    triggerConfetti();
    showNotif(`🎉 Selamat datang, ${displayName}!`, false, 'success');
    if (partner) {
      showNotif(`💕 Terhubung dengan pasangan: ${partner}`, false, 'info');
    }
  }, 500);
}

// ============ CHECK AUTH ============
function checkAuth() {
  const savedUser = sessionStorage.getItem("progrowth_user");
  
  if (savedUser && validateSession && validateSession()) {
    setCurrentUser(savedUser);
    setupAppSession(savedUser);
  }
}

// ============ FIREBASE LISTENER ============
function initFirebaseListener() {
  cleanupAllListeners();
  
  console.log("Initializing Firebase listener...");
  firebaseListener = onValue(ref(db, "data/"), (snapshot) => {
    const data = snapshot.val() || { 
      dreams: {}, plans: {}, finances: {}, settings: {}, 
      moments: {}, vendors: {}, profiles: {}, keuangan: {},
      catatan: {}, impian: {}
    };
    
    // Filter data berdasarkan user yang login
    const loggedUser = sessionStorage.getItem("progrowth_user");
    if (loggedUser && validateSession && validateSession()) {
      // Filter moments hanya untuk user ini dan pasangannya
      const filteredMoments = filterMomentsByUser(data.moments || {});
      data.filteredMoments = filteredMoments;
    }
    
    setMasterData(data);
    
    const loggedUser2 = sessionStorage.getItem("progrowth_user");
    if (loggedUser2 && validateSession && validateSession()) {
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
  
  const componentsLoaded = await loadComponents();
  
  if (!componentsLoaded) {
    return;
  }
  
  checkAuth();
  initFirebaseListener();
  initClickAnimation();
  appInitialized = true;
  
  setTimeout(() => {
    hideInitialLoading();
  }, 1500);
  
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
window.renderLevelBadge = renderLevelBadge;
window.handleLogout = handleLogout;

document.addEventListener("DOMContentLoaded", init);
