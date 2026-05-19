// js/app.js - Main Application (FULL VERSION dengan Sidebar Responsive)
import { db, ref, onValue, set } from './firebase-config.js';
import { masterData, setMasterData, showNotif, togglePrivacy, setCurrentUser } from './utils.js';
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
import { initPengingat } from './pengingat.js';

// ============ GLOBAL STATE ============
let firebaseListener = null;
let currentPage = 'dashboard';
let isSidebarOpen = false;

// ============ LOAD COMPONENTS ============
async function loadComponents() {
  try {
    console.log("Loading components...");
    
    const sidebarHtml = await fetch('components/sidebar.html').then(r => r.text());
    const bottomNavHtml = await fetch('components/navbar.html').then(r => r.text());
    const modalsHtml = await fetch('components/modals.html').then(r => r.text());
    const contentHtml = await fetch('components/content.html').then(r => r.text());
    const loginHtml = await fetch('components/login.html').then(r => r.text());
    
    document.getElementById('sidebar-container').innerHTML = sidebarHtml;
    document.getElementById('bottom-nav-container').innerHTML = bottomNavHtml;
    document.getElementById('modals-container').innerHTML = modalsHtml;
    document.getElementById('app-content').innerHTML = contentHtml;
    document.getElementById('login-screen').innerHTML = loginHtml;
    
    console.log("Components loaded successfully");
    attachEventListeners();
    initDarkMode();
    initMenuToggle();
    handleResize();
    
  } catch (error) {
    console.error('Error loading components:', error);
    showNotif("❌ Gagal memuat aplikasi", true, 'error');
  }
}

// ============ INIT DARK MODE ============
function initDarkMode() {
  const darkFab = document.getElementById("darkModeFab");
  if (darkFab) {
    const saved = localStorage.getItem("darkMode");
    if (saved === "enabled") document.body.classList.add("dark");
    darkFab.onclick = () => {
      document.body.classList.toggle("dark");
      localStorage.setItem("darkMode", document.body.classList.contains("dark") ? "enabled" : "disabled");
      darkFab.innerHTML = document.body.classList.contains("dark") ? '<i class="bi bi-brightness-high-fill fs-5"></i>' : '<i class="bi bi-moon-stars fs-5"></i>';
      
      // Animation feedback
      darkFab.style.transform = 'scale(0.9)';
      setTimeout(() => {
        if (darkFab) darkFab.style.transform = '';
      }, 200);
    };
  }
}

// ============ INIT MENU TOGGLE (MOBILE) - FIXED ============
function initMenuToggle() {
  const menuToggle = document.getElementById("menuToggleHp");
  const sidebar = document.getElementById("app-sidebar");
  const closeBtn = document.getElementById("closeSidebarBtn");
  
  if (!menuToggle || !sidebar) {
    console.log("Menu toggle or sidebar not found, will retry");
    // Retry after a short delay
    setTimeout(() => {
      const retryMenuToggle = document.getElementById("menuToggleHp");
      const retrySidebar = document.getElementById("app-sidebar");
      const retryCloseBtn = document.getElementById("closeSidebarBtn");
      
      if (retryMenuToggle && retrySidebar) {
        setupMenuToggleListeners(retryMenuToggle, retrySidebar, retryCloseBtn);
      }
    }, 500);
    return;
  }
  
  setupMenuToggleListeners(menuToggle, sidebar, closeBtn);
}

function setupMenuToggleListeners(menuToggle, sidebar, closeBtn) {
  // Hapus listener lama dengan clone node
  const newMenuToggle = menuToggle.cloneNode(true);
  menuToggle.parentNode.replaceChild(newMenuToggle, menuToggle);
  
  // Handler untuk membuka sidebar
  newMenuToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Menu toggle clicked - opening sidebar");
    sidebar.classList.add("open");
    isSidebarOpen = true;
    document.body.style.overflow = "hidden";
    document.body.classList.add("sidebar-open");
  });
  
  // Handler untuk close button
  if (closeBtn) {
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    
    newCloseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("Close button clicked - closing sidebar");
      sidebar.classList.remove("open");
      isSidebarOpen = false;
      document.body.style.overflow = "";
      document.body.classList.remove("sidebar-open");
    });
  }
  
  // Tutup sidebar saat klik di luar (overlay)
  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 768 && 
        sidebar.classList.contains("open") && 
        !sidebar.contains(e.target) && 
        !newMenuToggle.contains(e.target)) {
      console.log("Clicked outside - closing sidebar");
      sidebar.classList.remove("open");
      isSidebarOpen = false;
      document.body.style.overflow = "";
      document.body.classList.remove("sidebar-open");
    }
  });
  
  // Tutup sidebar saat tombol back ditekan di mobile
  window.addEventListener("popstate", () => {
    if (window.innerWidth <= 768 && sidebar.classList.contains("open")) {
      sidebar.classList.remove("open");
      isSidebarOpen = false;
      document.body.style.overflow = "";
      document.body.classList.remove("sidebar-open");
    }
  });
  
  // Handle resize - tutup sidebar saat beralih ke desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove("open");
      isSidebarOpen = false;
      document.body.style.overflow = "";
      document.body.classList.remove("sidebar-open");
    }
  });
}

// ============ HANDLE RESIZE ============
function handleResize() {
  const sidebar = document.getElementById("app-sidebar");
  const appContent = document.getElementById("app-content");
  const menuToggle = document.getElementById("menuToggleHp");
  
  if (window.innerWidth > 768) {
    // Desktop mode
    if (menuToggle) menuToggle.style.display = "none";
    if (appContent) appContent.style.marginLeft = "280px";
    if (sidebar) {
      sidebar.classList.remove("open");
      document.body.style.overflow = "";
    }
  } else {
    // Mobile mode
    if (menuToggle) menuToggle.style.display = "flex";
    if (appContent) appContent.style.marginLeft = "0";
  }
}

// ============ ATTACH EVENT LISTENERS ============
function attachEventListeners() {
  console.log("Attaching event listeners...");
  
  // Profile trigger - Event delegation
  document.body.addEventListener('click', (e) => {
    const profileTrigger = e.target.closest('#profileTrigger');
    if (profileTrigger) {
      e.preventDefault();
      e.stopPropagation();
      console.log("Profile clicked! Opening modal...");
      if (typeof openProfileModal === 'function') {
        openProfileModal();
      } else {
        console.error("openProfileModal is not defined");
        showNotif("❌ Error: Fungsi profile tidak ditemukan", true, 'error');
      }
    }
  });
  
  // Privacy toggle
  document.querySelectorAll("#privacyToggleDash").forEach(btn => {
    if (btn) {
      btn.removeEventListener('click', btn._privacyListener);
      btn._privacyListener = () => {
        togglePrivacy();
        if (window.renderDashboard) window.renderDashboard();
        
        // Animation feedback
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
          if (btn) btn.style.transform = '';
        }, 150);
      };
      btn.addEventListener('click', btn._privacyListener);
    }
  });
  
  // Navigation
  document.querySelectorAll(".nav-link, .bottom-nav-item").forEach(el => {
    el.removeEventListener('click', el._navListener);
    el._navListener = (e) => {
      const page = el.getAttribute("data-page");
      if (page) {
        showPage(page);
        // Tutup sidebar di mobile setelah navigasi
        if (window.innerWidth <= 768) {
          const sidebar = document.getElementById("app-sidebar");
          if (sidebar) {
            sidebar.classList.remove("open");
            isSidebarOpen = false;
            document.body.style.overflow = "";
          }
        }
      }
      
      // Animation feedback
      e.currentTarget.style.transform = 'scale(0.98)';
      setTimeout(() => {
        if (e.currentTarget) e.currentTarget.style.transform = '';
      }, 150);
    };
    el.addEventListener('click', el._navListener);
  });
  
  // Confirm logout
  const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
  if (confirmLogoutBtn) {
    confirmLogoutBtn.removeEventListener('click', confirmLogoutBtn._logoutListener);
    confirmLogoutBtn._logoutListener = () => handleLogout();
    confirmLogoutBtn.addEventListener('click', confirmLogoutBtn._logoutListener);
  }
  
  // Status badge click - Event delegation
  document.body.addEventListener('click', (e) => {
    const statusBadge = e.target.closest('.status-badge');
    if (statusBadge) {
      const status = statusBadge.getAttribute('data-status');
      if (status && typeof updateStatus === 'function') {
        updateStatus(status);
      }
    }
  });
  
  // Window resize handler
  window.addEventListener('resize', () => {
    handleResize();
  });
  
  // Online/Offline detection
  window.addEventListener('online', () => {
    showNotif("📡 Koneksi kembali online", false, 'success');
  });
  
  window.addEventListener('offline', () => {
    showNotif("⚠️ Koneksi terputus", true, 'error');
  });
}

// ============ SHOW PAGE FUNCTION ============
function showPage(pageId) {
  console.log("Showing page:", pageId);
  currentPage = pageId;
  
  // Hide all sections with animation
  document.querySelectorAll("section").forEach(s => {
    s.style.transition = 'opacity 0.2s';
    s.style.opacity = '0';
    setTimeout(() => {
      s.style.display = "none";
    }, 150);
  });
  
  // Show selected page with animation
  setTimeout(() => {
    const pageElement = document.getElementById(`${pageId}-page`);
    if (pageElement) {
      pageElement.style.display = "block";
      setTimeout(() => {
        pageElement.style.opacity = "1";
      }, 10);
    }
  }, 150);
  
  // Update active states
  document.querySelectorAll(".nav-link, .bottom-nav-item").forEach(el => {
    el.classList.remove("active");
  });
  
  document.querySelectorAll(`[data-page="${pageId}"]`).forEach(el => {
    el.classList.add("active");
  });
  
  // Initialize page-specific content
  if (pageId === "moment") {
    setTimeout(() => {
      if (typeof renderCalendar === 'function') renderCalendar();
      if (typeof renderMomentsList === 'function') renderMomentsList();
    }, 100);
  } else if (pageId === "dashboard") {
    setTimeout(() => {
      if (typeof renderDashboard === 'function') renderDashboard();
    }, 100);
  } else if (pageId === "keuangan") {
    setTimeout(() => {
      if (typeof initKeuangan === 'function') initKeuangan();
    }, 100);
  } else if (pageId === "catatan") {
    setTimeout(() => {
      if (typeof initCatatan === 'function') initCatatan();
    }, 100);
  } else if (pageId === "impian") {
    setTimeout(() => {
      if (typeof initImpian === 'function') initImpian();
    }, 100);
  } else if (pageId === "pengingat") {
    setTimeout(() => {
      if (typeof initPengingat === 'function') initPengingat();
    }, 100);
  }
}

// ============ SETUP APP SESSION ============
function setupAppSession(u) {
  console.log("Setting up session for user:", u);
  
  const loginScreen = document.getElementById("login-screen");
  const sidebar = document.getElementById("app-sidebar");
  const appContent = document.getElementById("app-content");
  
  // Hide login with animation
  if (loginScreen) {
    loginScreen.style.transition = 'all 0.3s ease-out';
    loginScreen.style.opacity = '0';
    loginScreen.style.transform = 'scale(0.95)';
    setTimeout(() => {
      loginScreen.style.display = "none";
    }, 300);
  }
  
  // Show app UI
  if (sidebar) {
    sidebar.style.display = "flex";
    sidebar.style.opacity = '0';
    sidebar.style.transform = 'translateX(-20px)';
    setTimeout(() => {
      if (sidebar) {
        sidebar.style.opacity = '1';
        sidebar.style.transform = 'translateX(0)';
      }
    }, 50);
  }
  
  if (appContent) {
    appContent.style.display = "block";
    appContent.style.opacity = '0';
    appContent.style.transform = 'translateY(20px)';
    setTimeout(() => {
      if (appContent) {
        appContent.style.opacity = '1';
        appContent.style.transform = 'translateY(0)';
      }
    }, 100);
  }
  
  const displayName = u === "FACHMI" ? "Fachmi" : "Azizah";
  
  // Update UI elements
  const badge = document.getElementById("activeUserBadge");
  if (badge) badge.innerText = displayName;
  
  const userGreet = document.getElementById("userGreet");
  if (userGreet) userGreet.innerText = displayName;
  
  // Force refresh profile UI
  setTimeout(() => {
    if (typeof forceRefreshProfile === 'function') {
      forceRefreshProfile();
    }
    if (typeof updateProfileUI === 'function') {
      updateProfileUI();
    }
    handleResize();
  }, 200);
  
  renderDashboard();
  showPage('dashboard');
}

// ============ CHECK AUTH ============
function checkAuth() {
  const savedUser = sessionStorage.getItem("progrowth_user");
  if (savedUser) {
    setCurrentUser(savedUser);
    setupAppSession(savedUser);
  }
}

// ============ FIREBASE LISTENER ============
function initFirebaseListener() {
  if (!firebaseListener) {
    console.log("Initializing Firebase listener...");
    firebaseListener = onValue(ref(db, "data/"), (snapshot) => {
      const data = snapshot.val() || { 
        dreams: {}, 
        plans: {}, 
        finances: {}, 
        settings: {}, 
        moments: {}, 
        vendors: {}, 
        profiles: {},
        keuangan: {},
        catatan: {},
        impian: {},
        pengingat: {}
      };
      setMasterData(data);
      
      // Initialize default auth if not exists
      if (!data.auth) {
        set(ref(db, "data/auth"), { FACHMI: "gokil223", AZIZAH: "1234" })
          .then(() => console.log("Default auth created"))
          .catch(err => console.error("Error creating default auth:", err));
      }
      
      // Re-render if user is logged in
      const loggedUser = sessionStorage.getItem("progrowth_user");
      if (loggedUser) {
        if (currentPage === "dashboard" && typeof renderDashboard === 'function') {
          renderDashboard();
        } else if (currentPage === "moment" && typeof renderCalendar === 'function') {
          renderCalendar();
          if (typeof renderMomentsList === 'function') renderMomentsList();
        } else if (currentPage === "keuangan" && typeof initKeuangan === 'function') {
          initKeuangan();
        } else if (currentPage === "catatan" && typeof initCatatan === 'function') {
          initCatatan();
        } else if (currentPage === "impian" && typeof initImpian === 'function') {
          initImpian();
        } else if (currentPage === "pengingat" && typeof initPengingat === 'function') {
          initPengingat();
        }
      }
      
      console.log("Firebase data synced");
    }, (error) => {
      console.error("Firebase listener error:", error);
      showNotif("⚠️ Gagal terhubung ke server", true, 'error');
    });
  }
}

// ============ CUSTOM TOAST CONTAINER ============
function injectToastContainer() {
  if (!document.getElementById('customToastContainer')) {
    const toastContainer = document.createElement('div');
    toastContainer.id = 'customToastContainer';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '80px';
    toastContainer.style.left = '50%';
    toastContainer.style.transform = 'translateX(-50%)';
    toastContainer.style.zIndex = '9999';
    toastContainer.style.pointerEvents = 'none';
    document.body.appendChild(toastContainer);
  }
}

// ============ SIDEBAR TOGGLE (DESKTOP COLLAPSE) ============
function toggleSidebarCollapse() {
  const sidebar = document.getElementById("app-sidebar");
  if (!sidebar) return;
  
  // Only for desktop
  if (window.innerWidth > 768) {
    sidebar.classList.toggle("collapsed");
    const isCollapsed = sidebar.classList.contains("collapsed");
    localStorage.setItem("sidebarCollapsed", isCollapsed);
    
    const appContent = document.getElementById("app-content");
    if (appContent) {
      appContent.style.marginLeft = isCollapsed ? "80px" : "280px";
    }
  }
}

// ============ LOAD SIDEBAR STATE ============
function loadSidebarState() {
  const savedState = localStorage.getItem("sidebarCollapsed");
  const sidebar = document.getElementById("app-sidebar");
  const appContent = document.getElementById("app-content");
  
  if (savedState === "true" && sidebar && window.innerWidth > 768) {
    sidebar.classList.add("collapsed");
    if (appContent) appContent.style.marginLeft = "80px";
  }
}

// ============ INITIALIZE APP ============
async function init() {
  console.log("🚀 Initializing Growthogether App...");
  injectToastContainer();
  await loadComponents();
  checkAuth();
  initFirebaseListener();
  loadSidebarState();
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
window.toggleSidebarCollapse = toggleSidebarCollapse;

// Moment functions
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

// Start the app
document.addEventListener("DOMContentLoaded", init);
