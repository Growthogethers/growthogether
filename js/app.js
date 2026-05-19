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
    loadSidebarState();
    handleResize();
    
  } catch (error) {
    console.error('Error loading components:', error);
    showNotif("❌ Gagal memuat aplikasi", true);
  }
}

// ============ TOGGLE SIDEBAR (COLLAPSE/DESKTOP) ============
function toggleSidebar() {
  const sidebar = document.getElementById("app-sidebar");
  const appContent = document.getElementById("app-content");
  const toggleBtn = document.querySelector(".sidebar-toggle-btn i");
  
  if (!sidebar) return;
  
  sidebar.classList.toggle("collapsed");
  
  // Save state to localStorage
  const isCollapsed = sidebar.classList.contains("collapsed");
  localStorage.setItem("sidebarCollapsed", isCollapsed);
  
  // Update toggle button icon
  if (toggleBtn) {
    if (isCollapsed) {
      toggleBtn.classList.remove("bi-chevron-left");
      toggleBtn.classList.add("bi-chevron-right");
    } else {
      toggleBtn.classList.remove("bi-chevron-right");
      toggleBtn.classList.add("bi-chevron-left");
    }
  }
  
  // Update app content margin for desktop only
  if (window.innerWidth > 768) {
    if (appContent) {
      if (isCollapsed) {
        appContent.style.marginLeft = "80px";
      } else {
        appContent.style.marginLeft = "280px";
      }
    }
  }
}

// ============ LOAD SIDEBAR STATE ON START ============
function loadSidebarState() {
  const savedState = localStorage.getItem("sidebarCollapsed");
  const sidebar = document.getElementById("app-sidebar");
  const appContent = document.getElementById("app-content");
  const toggleBtn = document.querySelector(".sidebar-toggle-btn i");
  
  if (!sidebar) return;
  
  if (savedState === "true" && sidebar && window.innerWidth > 768) {
    sidebar.classList.add("collapsed");
    if (appContent) appContent.style.marginLeft = "80px";
    if (toggleBtn) {
      toggleBtn.classList.remove("bi-chevron-left");
      toggleBtn.classList.add("bi-chevron-right");
    }
  } else {
    if (appContent && window.innerWidth > 768) appContent.style.marginLeft = "280px";
  }
}

// ============ HANDLE RESIZE ============
function handleResize() {
  const sidebar = document.getElementById("app-sidebar");
  const appContent = document.getElementById("app-content");
  const menuToggle = document.getElementById("menuToggleHp");
  
  if (window.innerWidth > 768) {
    // Desktop mode
    if (menuToggle) menuToggle.style.display = "none";
    
    if (sidebar) {
      if (sidebar.classList.contains("collapsed")) {
        if (appContent) appContent.style.marginLeft = "80px";
      } else {
        if (appContent) appContent.style.marginLeft = "280px";
      }
      sidebar.classList.remove("open");
    }
  } else {
    // Mobile mode
    if (menuToggle) menuToggle.style.display = "flex";
    if (appContent) appContent.style.marginLeft = "0";
    if (sidebar) {
      sidebar.classList.remove("collapsed");
    }
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

// ============ INIT MENU TOGGLE (MOBILE) ============
function initMenuToggle() {
  const menuToggle = document.getElementById("menuToggleHp");
  const sidebar = document.getElementById("app-sidebar");
  const closeBtn = document.getElementById("closeSidebarBtn");
  
  if (menuToggle && sidebar) {
    menuToggle.removeEventListener("click", menuToggle._listener);
    menuToggle._listener = () => {
      isSidebarOpen = !isSidebarOpen;
      sidebar.classList.toggle("open");
      // Prevent body scroll when sidebar is open on mobile
      if (isSidebarOpen) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
    };
    menuToggle.addEventListener("click", menuToggle._listener);
    
    if (closeBtn) {
      closeBtn.removeEventListener("click", closeBtn._listener);
      closeBtn._listener = () => {
        sidebar.classList.remove("open");
        isSidebarOpen = false;
        document.body.style.overflow = "";
      };
      closeBtn.addEventListener("click", closeBtn._listener);
    }
    
    // Close on outside click for mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && isSidebarOpen && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
        isSidebarOpen = false;
        document.body.style.overflow = "";
      }
    });
  }
}

// ============ ATTACH EVENT LISTENERS ============
function attachEventListeners() {
  console.log("Attaching event listeners...");
  
  // Sidebar toggle button (desktop collapse)
  const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
  if (sidebarToggleBtn) {
    sidebarToggleBtn.removeEventListener("click", sidebarToggleBtn._toggleListener);
    sidebarToggleBtn._toggleListener = () => toggleSidebar();
    sidebarToggleBtn.addEventListener("click", sidebarToggleBtn._toggleListener);
  }
  
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
        showNotif("❌ Error: Fungsi profile tidak ditemukan", true);
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
      if (page) showPage(page);
      
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
    showNotif("📡 Koneksi kembali online");
  });
  
  window.addEventListener('offline', () => {
    showNotif("⚠️ Koneksi terputus", true);
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
  
  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
      sidebar.classList.remove("open");
      isSidebarOpen = false;
      document.body.style.overflow = "";
    }
  }
  
  // Render page content
  if (pageId === "moment") {
    setTimeout(() => {
      if (typeof renderCalendar === 'function') renderCalendar();
      if (typeof renderMomentsList === 'function') renderMomentsList();
    }, 100);
  } else if (pageId === "dashboard") {
    setTimeout(() => {
      if (typeof renderDashboard === 'function') renderDashboard();
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
    // Re-apply sidebar state after profile loads
    loadSidebarState();
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
      const data = snapshot.val() || { dreams: {}, plans: {}, finances: {}, settings: {}, moments: {}, vendors: {}, profiles: {} };
      setMasterData(data);
      
      // Initialize default auth if not exists
      if (!data.auth) {
        set(ref(db, "data/auth"), { FACHMI: "gokil223", AZIZAH: "1234" })
          .then(() => console.log("Default auth created"))
          .catch(err => console.error("Error creating default auth:", err));
      }
      
      // Initialize default settings if not exists
      if (!data.settings?.weddingTarget) {
        set(ref(db, "data/settings"), { weddingTarget: 50000000 })
          .then(() => console.log("Default settings created"))
          .catch(err => console.error("Error creating default settings:", err));
      }
      
      // Re-render if user is logged in
      if (sessionStorage.getItem("progrowth_user")) {
        if (currentPage === "dashboard" && typeof renderDashboard === 'function') {
          renderDashboard();
        } else if (currentPage === "moment" && typeof renderCalendar === 'function') {
          renderCalendar();
          if (typeof renderMomentsList === 'function') renderMomentsList();
        }
      }
      
      console.log("Firebase data synced");
    }, (error) => {
      console.error("Firebase listener error:", error);
      showNotif("⚠️ Gagal terhubung ke server", true);
    });
  }
}

// ============ TOAST NOTIFICATION ============
function injectToastHTML() {
  if (!document.getElementById('customToast')) {
    const toastHTML = `
      <div id="customToast" style="display:none; position:fixed; bottom:80px; left:50%; transform:translateX(-50%); z-index:1100; min-width:250px;">
        <div class="toast align-items-center border-0 shadow-lg" role="alert" style="border-radius: 50px;">
          <div class="d-flex">
            <div class="toast-body fw-semibold"></div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', toastHTML);
  }
}

// ============ INITIALIZE APP ============
async function init() {
  console.log("🚀 Initializing Growthogether App...");
  injectToastHTML();
  await loadComponents();
  checkAuth();
  initFirebaseListener();
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
window.toggleSidebar = toggleSidebar;

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
