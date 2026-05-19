// js/app.js - Main Application (FULL VERSION)
import { db, ref, onValue, set } from './firebase-config.js';
import { masterData, setMasterData, showNotif, togglePrivacy, setCurrentUser } from './utils.js';
import { handleLogin, updateCloudPassword, resetPassword, confirmLogout, handleLogout, openForgotPasswordModal, openDirectChangePasswordModal, updatePasswordHint } from './auth.js';
import { renderDashboard } from './dashboard.js';
import { renderCalendar, renderMomentsList, saveMoment, viewMomentDetail, deleteMomentFromDetail, changeMonth, selectMomentDate, openMomentModal, handleMultiplePhotos, removePhotoAtIndex, editMomentFromDetail } from './moment.js';

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
    
  } catch (error) {
    console.error('Error loading components:', error);
    showNotif("❌ Gagal memuat aplikasi, refresh halaman", true);
  }
}

// ============ INIT DARK MODE ============
function initDarkMode() {
  const darkFab = document.getElementById("darkModeFab");
  if (darkFab) {
    const saved = localStorage.getItem("darkMode");
    if (saved === "enabled") {
      document.body.classList.add("dark");
      darkFab.innerHTML = '<i class="bi bi-brightness-high-fill fs-5"></i>';
    } else {
      darkFab.innerHTML = '<i class="bi bi-moon-stars fs-5"></i>';
    }
    
    darkFab.onclick = () => {
      document.body.classList.toggle("dark");
      const isDark = document.body.classList.contains("dark");
      localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
      darkFab.innerHTML = isDark ? '<i class="bi bi-brightness-high-fill fs-5"></i>' : '<i class="bi bi-moon-stars fs-5"></i>';
      
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
  
  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      isSidebarOpen = !isSidebarOpen;
      sidebar.classList.toggle("open");
      
      // Animation for toggle button
      menuToggle.style.transform = isSidebarOpen ? 'rotate(90deg)' : 'rotate(0deg)';
      setTimeout(() => {
        if (menuToggle) menuToggle.style.transform = '';
      }, 300);
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && isSidebarOpen && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
        isSidebarOpen = false;
      }
    });
  }
}

// ============ ATTACH ALL EVENT LISTENERS ============
function attachEventListeners() {
  console.log("Attaching event listeners...");
  
  // ============ PRIVACY TOGGLE ============
  document.querySelectorAll("#privacyToggleDash").forEach(btn => {
    if (btn) {
      btn.removeEventListener('click', handlePrivacyToggle);
      btn.addEventListener('click', handlePrivacyToggle);
    }
  });
  
  // ============ NAVIGATION ============
  document.querySelectorAll(".nav-link, .bottom-nav-item").forEach(el => {
    el.removeEventListener('click', handleNavigation);
    el.addEventListener('click', handleNavigation);
  });
  
  // ============ CONFIRM LOGOUT ============
  const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
  if (confirmLogoutBtn) {
    confirmLogoutBtn.removeEventListener('click', handleLogout);
    confirmLogoutBtn.addEventListener('click', handleLogout);
  }
  
  // ============ LUPA PASSWORD LINK DENGAN ANIMASI PREMIUM ============
  document.body.addEventListener('click', handleForgotPasswordClick);
  
  // ============ SELECT USER CHANGE HINT ============
  document.body.addEventListener('change', (e) => {
    if (e.target.id === 'resetUserSelect') {
      updatePasswordHint();
    }
  });
  
  // ============ ESCAPE KEY HANDLER ============
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSidebarOpen && window.innerWidth <= 768) {
      const sidebar = document.getElementById("app-sidebar");
      if (sidebar) {
        sidebar.classList.remove('open');
        isSidebarOpen = false;
      }
    }
  });
}

// ============ EVENT HANDLER FUNCTIONS ============
function handlePrivacyToggle() {
  togglePrivacy();
  if (window.renderDashboard) window.renderDashboard();
  // Animation feedback
  const btn = document.getElementById("privacyToggleDash");
  if (btn) {
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      if (btn) btn.style.transform = '';
    }, 150);
  }
}

function handleNavigation(e) {
  const page = e.currentTarget.getAttribute("data-page");
  if (page) {
    showPage(page);
    
    // Animation feedback
    e.currentTarget.style.transform = 'scale(0.95)';
    setTimeout(() => {
      if (e.currentTarget) e.currentTarget.style.transform = '';
    }, 150);
  }
}

// ============ SHOW PAGE FUNCTION ============
function showPage(pageId) {
  console.log("Showing page:", pageId);
  currentPage = pageId;
  
  // Hide all sections
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
    }
  }
  
  // Render page content
  if (pageId === "moment") {
    setTimeout(() => {
      if (typeof renderCalendar === 'function') renderCalendar();
      if (typeof renderMomentsList === 'function') renderMomentsList();
    }, 200);
  } else if (pageId === "dashboard") {
    setTimeout(() => {
      if (typeof renderDashboard === 'function') renderDashboard();
    }, 200);
  }
}

// ============ SETUP APP SESSION ============
function setupAppSession(user) {
  console.log("Setting up session for user:", user);
  
  // Hide login screen with animation
  const loginScreen = document.getElementById("login-screen");
  if (loginScreen) {
    loginScreen.style.transition = 'all 0.3s ease-out';
    loginScreen.style.opacity = '0';
    loginScreen.style.transform = 'scale(0.95)';
    setTimeout(() => {
      loginScreen.style.display = "none";
    }, 300);
  }
  
  // Show app UI
  const sidebar = document.getElementById("app-sidebar");
  const appContent = document.getElementById("app-content");
  
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
  
  // Update user badge and greeting
  const badge = document.getElementById("activeUserBadge");
  if (badge) {
    badge.innerText = user;
    badge.style.animation = 'pulse 0.5s ease';
    setTimeout(() => {
      if (badge) badge.style.animation = '';
    }, 500);
  }
  
  const userGreet = document.getElementById("userGreet");
  if (userGreet) {
    userGreet.innerText = user;
  }
  
  // Render initial page
  if (typeof renderDashboard === 'function') renderDashboard();
  showPage('dashboard');
}

// ============ CHECK AUTH ON LOAD ============
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
      const data = snapshot.val() || { dreams: {}, plans: {}, finances: {}, settings: {}, moments: {}, vendors: {} };
      setMasterData(data);
      
      // Initialize default auth if not exists
      if (!data.auth) {
        set(ref(db, "data/auth"), { FACHMI: "gokil223", AZIZAH: "1234" })
          .then(() => console.log("Default auth created"))
          .catch(err => console.error("Error creating default auth:", err));
      }
      
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

// ============ WINDOW RESIZE HANDLER ============
function handleResize() {
  if (window.innerWidth > 768) {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
      sidebar.classList.remove("open");
      isSidebarOpen = false;
    }
  }
}

// ============ TOAST NOTIFICATION STYLE ============
function injectToastHTML() {
  // Check if toast container already exists
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

// ============ INITIALIZE APPLICATION ============
async function init() {
  console.log("🚀 Initializing Growthogether App...");
  
  // Inject toast HTML first
  injectToastHTML();
  
  // Load all components
  await loadComponents();
  
  // Check authentication
  checkAuth();
  
  // Initialize Firebase listener
  initFirebaseListener();
  
  // Add resize handler
  window.addEventListener('resize', handleResize);
  
  // Add online/offline detection
  window.addEventListener('online', () => {
    showNotif("📡 Koneksi kembali online");
  });
  
  window.addEventListener('offline', () => {
    showNotif("⚠️ Koneksi terputus", true);
  });
  
  console.log("✅ App initialized successfully");
}

// ============ EXPORTS FOR GLOBAL ACCESS ============
window.setupAppSession = setupAppSession;
window.showPage = showPage;
window.renderDashboard = renderDashboard;
window.togglePrivacy = togglePrivacy;
window.updateCloudPassword = updateCloudPassword;
window.resetPassword = resetPassword;
window.openForgotPasswordModal = openForgotPasswordModal;
window.openDirectChangePasswordModal = openDirectChangePasswordModal;

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
