// js/utils.js - Lengkap dengan Enhanced XSS Protection & Security
export let currentUser = null;
export let masterData = null;
export let privacyHidden = false;

// ============ CACHING SYSTEM ============
let cacheData = {};
let cacheExpiry = {};
let pendingRequests = new Map();

export function setCache(key, data, ttlMinutes = 5) {
  cacheData[key] = data;
  cacheExpiry[key] = Date.now() + (ttlMinutes * 60 * 1000);
  try {
    sessionStorage.setItem(`cache_${key}`, JSON.stringify({
      data: data,
      expiry: cacheExpiry[key]
    }));
  } catch (e) {}
}

export function getCache(key) {
  if (cacheData[key] && cacheExpiry[key] > Date.now()) {
    console.log(`✅ Cache hit: ${key}`);
    return cacheData[key];
  }
  
  try {
    const cached = sessionStorage.getItem(`cache_${key}`);
    if (cached) {
      const { data, expiry } = JSON.parse(cached);
      if (expiry > Date.now()) {
        console.log(`✅ Session cache hit: ${key}`);
        cacheData[key] = data;
        cacheExpiry[key] = expiry;
        return data;
      } else {
        sessionStorage.removeItem(`cache_${key}`);
      }
    }
  } catch (e) {}
  
  console.log(`❌ Cache miss: ${key}`);
  return null;
}

export function clearCache(key) {
  if (key) {
    delete cacheData[key];
    delete cacheExpiry[key];
    try { sessionStorage.removeItem(`cache_${key}`); } catch(e) {}
  } else {
    cacheData = {};
    cacheExpiry = {};
    try {
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('cache_')) sessionStorage.removeItem(k);
      });
    } catch(e) {}
  }
}

// ============ LOADING INDICATOR ============
let loadingOverlay = null;
let loadingTimeout = null;

export function showLoading(message = 'Memuat data...') {
  if (loadingOverlay) return;
  
  loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'loadingOverlay';
  loadingOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.75);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    backdrop-filter: blur(4px);
    transition: all 0.3s ease;
  `;
  loadingOverlay.innerHTML = `
    <div class="spinner-border text-light" role="status" style="width: 44px; height: 44px;">
      <span class="visually-hidden">Loading...</span>
    </div>
    <div class="text-white mt-3 fw-bold" style="font-size: 14px;">${escapeHtml(message)}</div>
    <div class="text-white-50 small mt-1">Mohon tunggu sebentar...</div>
  `;
  document.body.appendChild(loadingOverlay);
  
  loadingTimeout = setTimeout(() => {
    hideLoading();
    showNotif("⏰ Koneksi lambat, coba refresh", true, 'error');
  }, 5000);
}

export function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      if (loadingOverlay) loadingOverlay.remove();
      loadingOverlay = null;
    }, 300);
  }
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }
}

// ============ TOAST NOTIFICATION ============
let toastQueue = [];
let isToastShowing = false;
let originalToastBottom = '80px';

function initToastKeyboardFix() {
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      const toast = document.getElementById('customToastContainer');
      if (toast) toast.style.bottom = '20px';
    }
  });
  
  document.addEventListener('focusout', () => {
    const toast = document.getElementById('customToastContainer');
    if (toast) toast.style.bottom = originalToastBottom;
  });
}

export function showNotif(msg, isErr = false, type = 'success') {
  let toastContainer = document.getElementById('customToastContainer');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
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
    initToastKeyboardFix();
  }
  
  if (isToastShowing) {
    toastQueue.push({ msg, isErr, type });
    return;
  }
  
  isToastShowing = true;
  
  const toast = document.createElement('div');
  toast.className = `custom-toast ${isErr ? 'error' : type === 'warning' ? 'warning' : 'success'}`;
  toast.style.cssText = `
    min-width: 260px;
    max-width: 90%;
    background: var(--card-bg, white);
    border-radius: 50px;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    margin-bottom: 8px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  `;
  toast.innerHTML = `
    <i class="bi ${isErr ? 'bi-exclamation-triangle-fill' : type === 'warning' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}" 
       style="color: ${isErr ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#10b981'}; font-size: 20px;"></i>
    <span class="toast-message" style="flex: 1; font-size: 13px; font-weight: 500; color: var(--text-primary, #1e293b);">${escapeHtml(msg)}</span>
  `;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => {
      toast.remove();
      isToastShowing = false;
      if (toastQueue.length > 0) {
        const next = toastQueue.shift();
        showNotif(next.msg, next.isErr, next.type);
      }
    }, 300);
  }, 2700);
}

// ============ CUSTOM PROMPT & CONFIRM ============
export function showCustomPrompt(title, placeholder, defaultValue = '') {
  return new Promise((resolve) => {
    let modalElement = document.getElementById('customPromptModal');
    
    if (!modalElement) {
      const modalHtml = `
        <div class="modal fade" id="customPromptModal" tabindex="-1" data-bs-backdrop="static">
          <div class="modal-dialog modal-dialog-centered modal-sm">
            <div class="modal-content rounded-4">
              <div class="modal-header border-0 pt-4">
                <h5 class="fw-bold mb-0" id="promptTitle"></h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body py-2">
                <input type="number" id="promptInput" class="form-control form-control-lg rounded-3" placeholder="">
              </div>
              <div class="modal-footer border-0 justify-content-center gap-3 pb-4">
                <button class="btn btn-secondary rounded-pill px-4" id="promptCancelBtn">Batal</button>
                <button class="btn btn-primary rounded-pill px-4" id="promptConfirmBtn">OK</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      modalElement = document.getElementById('customPromptModal');
    }
    
    document.getElementById('promptTitle').innerText = escapeHtml(title);
    const input = document.getElementById('promptInput');
    input.placeholder = escapeHtml(placeholder);
    input.value = defaultValue;
    input.type = 'number';
    
    const modal = new bootstrap.Modal(modalElement);
    
    const handleConfirm = () => {
      modal.hide();
      resolve(input.value);
    };
    
    const handleCancel = () => {
      modal.hide();
      resolve(null);
    };
    
    const confirmBtn = document.getElementById('promptConfirmBtn');
    const cancelBtn = document.getElementById('promptCancelBtn');
    
    confirmBtn.onclick = handleConfirm;
    cancelBtn.onclick = handleCancel;
    
    modalElement.addEventListener('hidden.bs.modal', () => {
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
    }, { once: true });
    
    modal.show();
    input.focus();
  });
}

export function showCustomConfirm(title, message) {
  return new Promise((resolve) => {
    let modalElement = document.getElementById('customConfirmModalDialog');
    
    if (!modalElement) {
      const modalHtml = `
        <div class="modal fade" id="customConfirmModalDialog" tabindex="-1" data-bs-backdrop="static">
          <div class="modal-dialog modal-dialog-centered modal-sm">
            <div class="modal-content rounded-4">
              <div class="modal-header border-0 pt-4 pb-0">
                <h5 class="fw-bold mb-0" id="confirmTitle"></h5>
              </div>
              <div class="modal-body text-center py-3">
                <i class="bi bi-question-circle fs-1 text-warning mb-2 d-block"></i>
                <p class="mb-0" id="confirmMessage"></p>
              </div>
              <div class="modal-footer border-0 justify-content-center gap-3 pb-4">
                <button class="btn btn-secondary rounded-pill px-4" id="confirmCancelBtn">Batal</button>
                <button class="btn btn-danger rounded-pill px-4" id="confirmOkBtn">Ya, Hapus</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      modalElement = document.getElementById('customConfirmModalDialog');
    }
    
    document.getElementById('confirmTitle').innerText = escapeHtml(title);
    document.getElementById('confirmMessage').innerText = escapeHtml(message);
    
    const modal = new bootstrap.Modal(modalElement);
    
    const handleConfirm = () => {
      modal.hide();
      resolve(true);
    };
    
    const handleCancel = () => {
      modal.hide();
      resolve(false);
    };
    
    const confirmBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    
    confirmBtn.onclick = handleConfirm;
    cancelBtn.onclick = handleCancel;
    
    modalElement.addEventListener('hidden.bs.modal', () => {
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
    }, { once: true });
    
    modal.show();
  });
}

// ============ ENHANCED XSS PROTECTION ============
export function escapeHtml(str) { 
  if (!str) return ""; 
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#96;")
    .replace(/\//g, "&#x2F;");
}

export function sanitizeInput(str) {
  if (!str) return "";
  return escapeHtml(str.trim().substring(0, 500));
}

export function sanitizeNumber(val) {
  const num = parseInt(val);
  return isNaN(num) ? 0 : Math.max(0, Math.min(num, 999999999));
}

// ============ UTILITY FUNCTIONS ============
export function formatNumberRp(val) { 
  if (privacyHidden) return "●●● ●●●";
  if (val === undefined || val === null) return "Rp 0";
  const safeVal = sanitizeNumber(val);
  return `Rp ${safeVal.toLocaleString('id-ID')}`;
}

export function togglePrivacy() { 
  privacyHidden = !privacyHidden; 
  showNotif(privacyHidden ? "🔒 Angka disembunyikan" : "👁️ Angka ditampilkan", false, 'info'); 
  if (window.renderDashboard) window.renderDashboard();
}

export function setCurrentUser(user) { 
  currentUser = user; 
}

export function setMasterData(data) { 
  masterData = data; 
  window.masterData = data; 
}

// ============ THROTTLE FUNCTION ============
export function throttle(func, delay) {
  let lastCall = 0;
  let timeoutId = null;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall < delay) {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, delay - (now - lastCall));
      return;
    }
    lastCall = now;
    func.apply(this, args);
  };
}

// ============ DEBOUNCE FUNCTION ============
export function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// ============ COMPRESS IMAGE ============
export function compressImage(file, maxSizeMB = 2) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDimension = 1024;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.8;
        let result = canvas.toDataURL('image/jpeg', quality);
        while (result.length > maxSizeMB * 1024 * 1024 && quality > 0.3) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(result);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

// ============ BATCH FIREBASE GET ============
export async function batchGet(refs, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const promises = refs.map(ref => get(ref));
    const results = await Promise.all(promises);
    clearTimeout(timeoutId);
    return results;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Batch get error:", error);
    return null;
  }
}

// ============ ANIMASI ============

// Confetti celebration
export function triggerConfetti() {
  const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
  const count = 50;
  
  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.width = Math.random() * 8 + 4 + 'px';
    confetti.style.height = confetti.style.width;
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = Math.random() * 2 + 2 + 's';
    confetti.style.animationDelay = Math.random() * 0.5 + 's';
    document.body.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 3000);
  }
}

// Floating hearts animation
export function triggerFloatingHearts(x, y) {
  const heart = document.createElement('div');
  heart.className = 'floating-heart';
  heart.innerHTML = ['❤️', '💖', '💕', '💗', '💓', '💝'][Math.floor(Math.random() * 6)];
  heart.style.left = (x || window.innerWidth / 2) + 'px';
  heart.style.top = (y || window.innerHeight / 2) + 'px';
  heart.style.position = 'fixed';
  heart.style.pointerEvents = 'none';
  heart.style.zIndex = '9999';
  heart.style.fontSize = '24px';
  document.body.appendChild(heart);
  
  setTimeout(() => heart.remove(), 2000);
}

// Pixel particles on click
export function triggerPixelParticles(x, y) {
  for (let i = 0; i < 15; i++) {
    const particle = document.createElement('div');
    particle.className = 'pixel-particle';
    particle.style.left = (x || window.innerWidth / 2) + 'px';
    particle.style.top = (y || window.innerHeight / 2) + 'px';
    particle.style.setProperty('--tx', (Math.random() - 0.5) * 100 + 'px');
    particle.style.setProperty('--ty', (Math.random() - 0.5) * 100 - 50 + 'px');
    particle.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 60%)`;
    document.body.appendChild(particle);
    
    setTimeout(() => particle.remove(), 2000);
  }
}

// Add click animation to interactive elements
export function initClickAnimation() {
  document.body.addEventListener('click', (e) => {
    const target = e.target.closest('button, .nav-link, .bottom-nav-item, .calendar-day, .moment-card');
    if (target && window.innerWidth <= 768) {
      triggerPixelParticles(e.clientX, e.clientY);
    }
  });
}

// Expose functions ke window
window.triggerConfetti = triggerConfetti;
window.triggerFloatingHearts = triggerFloatingHearts;
window.triggerPixelParticles = triggerPixelParticles;
window.showNotif = showNotif;
window.formatNumberRp = formatNumberRp;
window.togglePrivacy = togglePrivacy;
window.showCustomPrompt = showCustomPrompt;
window.showCustomConfirm = showCustomConfirm;
window.escapeHtml = escapeHtml;
window.sanitizeInput = sanitizeInput;
window.sanitizeNumber = sanitizeNumber;
window.throttle = throttle;
window.debounce = debounce;
