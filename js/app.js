// js/app.js - Main Application
import { db, ref, onValue, set } from './firebase-config.js';
import { masterData, setMasterData, showNotif, togglePrivacy, setCurrentUser } from './utils.js';
import { handleLogin, confirmLogout, handleLogout } from './auth.js';
import { renderDashboard } from './dashboard.js';
import { renderCalendar, renderMomentsList, saveMoment, viewMomentDetail, deleteMomentFromDetail, changeMonth, selectMomentDate, openMomentModal, handleMultiplePhotos, removePhotoAtIndex } from './moment.js';

let firebaseListener = null;

// Load components
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
  } catch (error) {
    console.error('Error loading components:', error);
    showNotif("❌ Gagal memuat aplikasi", true);
  }
}

function attachEventListeners() {
  // Dark mode
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
  
  // Menu toggle
  const menuToggle = document.getElementById("menuToggleHp");
  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      document.getElementById("app-sidebar")?.classList.toggle("open");
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
  document.querySelectorAll("section").forEach(s => s.style.display = "none");
  const pageElement = document.getElementById(`${pageId}-page`);
  if (pageElement) pageElement.style.display = "block";
  
  document.querySelectorAll(".nav-link, .bottom-nav-item").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(`[data-page="${pageId}"]`).forEach(el => el.classList.add("active"));
  
  if (window.innerWidth <= 768) {
    document.getElementById("app-sidebar")?.classList.remove("open");
  }
  
  if (pageId === "moment") {
    setTimeout(() => {
      renderCalendar();
      renderMomentsList();
    }, 100);
  }
}

function setupAppSession(u) {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-sidebar").style.display = "flex";
  document.getElementById("app-content").style.display = "block";
  
  const badge = document.getElementById("activeUserBadge");
  if (badge) {
    badge.innerText = u;
  }
  
  document.getElementById("userGreet").innerText = u;
  
  renderDashboard();
  showPage('dashboard');
}

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  loadComponents().then(() => {
    const savedUser = sessionStorage.getItem("progrowth_user");
    if (savedUser) {
      setCurrentUser(savedUser);
      setupAppSession(savedUser);
    }
  });
});

// Firebase listener
if (!firebaseListener) {
  firebaseListener = onValue(ref(db, "data/"), (snapshot) => {
    const data = snapshot.val() || { dreams: {}, plans: {}, finances: {}, settings: {}, moments: {}, vendors: {} };
    setMasterData(data);
    
    if (!data.auth) set(ref(db, "data/auth"), { FACHMI: "gokil223", AZIZAH: "1234" });
    if (!data.settings?.weddingTarget) set(ref(db, "data/settings"), { weddingTarget: 50000000 });
    
    if (sessionStorage.getItem("progrowth_user")) {
      renderDashboard();
      renderCalendar();
      renderMomentsList();
    }
  });
}

// Exports
window.setupAppSession = setupAppSession;
window.showPage = showPage;
window.renderDashboard = renderDashboard;
window.togglePrivacy = togglePrivacy;