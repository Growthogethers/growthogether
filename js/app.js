// js/app.js - Dengan Fitur Profile
import { db, ref, onValue, set } from './firebase-config.js';
import { masterData, setMasterData, showNotif, togglePrivacy, setCurrentUser } from './utils.js';
import { handleLogin, updateCloudPassword, confirmLogout, handleLogout, openProfileModal, updateStatus, handleProfilePhotoUpload, openChangePasswordFromProfile } from './auth.js';
import { renderDashboard } from './dashboard.js';
import { renderCalendar, renderMomentsList, saveMoment, viewMomentDetail, deleteMomentFromDetail, changeMonth, selectMomentDate, openMomentModal, handleMultiplePhotos, removePhotoAtIndex, editMomentFromDetail } from './moment.js';

let firebaseListener = null;
let currentPage = 'dashboard';
let isSidebarOpen = false;

async function loadComponents() {
  try {
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
    
    attachEventListeners();
    initDarkMode();
    initMenuToggle();
  } catch (error) {
    console.error('Error loading components:', error);
    showNotif("❌ Gagal memuat aplikasi", true);
  }
}

function initDarkMode() {
  const darkFab = document.getElementById("darkModeFab");
  if (darkFab) {
    const saved = localStorage.getItem("darkMode");
    if (saved === "enabled") document.body.classList.add("dark");
    darkFab.onclick = () => {
      document.body.classList.toggle("dark");
      localStorage.setItem("darkMode", document.body.classList.contains("dark") ? "enabled" : "disabled");
      darkFab.innerHTML = document.body.classList.contains("dark") ? '<i class="bi bi-brightness-high-fill fs-5"></i>' : '<i class="bi bi-moon-stars fs-5"></i>';
    };
  }
}

function initMenuToggle() {
  const menuToggle = document.getElementById("menuToggleHp");
  const sidebar = document.getElementById("app-sidebar");
  const closeBtn = document.getElementById("closeSidebarBtn");
  
  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", () => {
      isSidebarOpen = !isSidebarOpen;
      sidebar.classList.toggle("open");
    });
    
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        sidebar.classList.remove("open");
        isSidebarOpen = false;
      });
    }
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && isSidebarOpen && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
        isSidebarOpen = false;
      }
    });
  }
}

function attachEventListeners() {
  // Profile trigger
  const profileTrigger = document.getElementById("profileTrigger");
  if (profileTrigger) {
    profileTrigger.addEventListener("click", () => {
      openProfileModal();
    });
  }
  
  // Privacy toggle
  document.querySelectorAll("#privacyToggleDash").forEach(btn => {
    if (btn) btn.addEventListener("click", () => {
      togglePrivacy();
      if (window.renderDashboard) window.renderDashboard();
    });
  });
  
  // Navigation
  document.querySelectorAll(".nav-link, .bottom-nav-item").forEach(el => {
    el.addEventListener("click", () => {
      const page = el.getAttribute("data-page");
      if (page) showPage(page);
    });
  });
  
  // Confirm logout
  const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
  if (confirmLogoutBtn) {
    confirmLogoutBtn.onclick = () => handleLogout();
  }
}

function showPage(pageId) {
  currentPage = pageId;
  document.querySelectorAll("section").forEach(s => s.style.display = "none");
  const pageElement = document.getElementById(`${pageId}-page`);
  if (pageElement) pageElement.style.display = "block";
  
  document.querySelectorAll(".nav-link, .bottom-nav-item").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(`[data-page="${pageId}"]`).forEach(el => el.classList.add("active"));
  
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
      sidebar.classList.remove("open");
      isSidebarOpen = false;
    }
  }
  
  if (pageId === "moment") {
    setTimeout(() => {
      renderCalendar();
      renderMomentsList();
    }, 100);
  } else if (pageId === "dashboard") {
    setTimeout(() => {
      renderDashboard();
    }, 100);
  }
}

function setupAppSession(u) {
  const loginScreen = document.getElementById("login-screen");
  const sidebar = document.getElementById("app-sidebar");
  const appContent = document.getElementById("app-content");
  
  if (loginScreen) loginScreen.style.display = "none";
  if (sidebar) sidebar.style.display = "flex";
  if (appContent) appContent.style.display = "block";
  
  const displayName = u === "FACHMI" ? "Fachmi" : "Azizah";
  
  const badge = document.getElementById("activeUserBadge");
  if (badge) badge.innerText = displayName;
  
  const userGreet = document.getElementById("userGreet");
  if (userGreet) userGreet.innerText = displayName;
  
  renderDashboard();
  showPage('dashboard');
}

function checkAuth() {
  const savedUser = sessionStorage.getItem("progrowth_user");
  if (savedUser) {
    setCurrentUser(savedUser);
    setupAppSession(savedUser);
  }
}

function initFirebaseListener() {
  if (!firebaseListener) {
    firebaseListener = onValue(ref(db, "data/"), (snapshot) => {
      const data = snapshot.val() || { dreams: {}, plans: {}, finances: {}, settings: {}, moments: {}, vendors: {}, profiles: {} };
      setMasterData(data);
      
      if (!data.auth) set(ref(db, "data/auth"), { FACHMI: "gokil223", AZIZAH: "1234" });
      if (!data.settings?.weddingTarget) set(ref(db, "data/settings"), { weddingTarget: 50000000 });
      
      if (sessionStorage.getItem("progrowth_user")) {
        if (currentPage === "dashboard") renderDashboard();
        else if (currentPage === "moment") {
          renderCalendar();
          renderMomentsList();
        }
      }
    });
  }
}

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

async function init() {
  injectToastHTML();
  await loadComponents();
  checkAuth();
  initFirebaseListener();
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

document.addEventListener("DOMContentLoaded", init);
