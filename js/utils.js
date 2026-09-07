// js/utils.js - Kompatibel dengan struktur global moments
import { db, ref, get, set, push, remove, update } from './firebase-config.js';

export let currentUser = null;
export let masterData = null;
export let privacyHidden = false;
export let currentUserLevel = null;
export let currentUserLimits = null;
export let currentPartner = null;
export let currentPairId = null;
export let currentPairData = null;

// ============ CACHING SYSTEM ============
let cacheData = {};
let cacheExpiry = {};

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
  console.log("Cache cleared:", key || "all");
}

// ============ LOAD PARTNER FROM EXISTING STRUCTURE ============
export async function loadUserPartnerAndPair(username) {
  try {
    console.log(`Loading partner for user: ${username}`);
    
    const partnerSnap = await get(ref(db, `data/partners/${username}`));
    let partner = partnerSnap.val();
    
    if (partner) {
      currentPartner = partner;
      console.log(`Partner found via partners node: ${currentPartner}`);
      
      const pair = [username, partner].sort();
      currentPairId = `${pair[0]}_${pair[1]}`;
      sessionStorage.setItem('progrowth_pairId', currentPairId);
      
      console.log(`PairId: ${currentPairId}`);
      return currentPartner;
    } else {
      console.log(`User ${username} has no partner yet`);
      currentPartner = null;
      currentPairId = null;
      return null;
    }
  } catch(err) {
    console.error("Error loading pair data:", err);
    return null;
  }
}

// ============ SHARED DATA FUNCTIONS ============

export async function getSharedMoments() {
  if (!currentUser) return {};
  try {
    const snap = await get(ref(db, `data/moments`));
    const allMoments = snap.val() || {};
    
    const filteredMoments = {};
    Object.entries(allMoments).forEach(([id, moment]) => {
      if (moment.author === currentUser || (currentPartner && moment.author === currentPartner)) {
        filteredMoments[id] = moment;
      }
    });
    
    console.log(`Found ${Object.keys(filteredMoments).length} moments for user ${currentUser} and partner ${currentPartner}`);
    return filteredMoments;
  } catch(err) {
    console.error("Error getting shared moments:", err);
    return {};
  }
}

export async function addSharedMoment(moment) {
  if (!currentUser) return null;
  
  try {
    const newRef = push(ref(db, 'data/moments'));
    const newId = newRef.key;
    const momentData = {
      ...moment,
      id: newId,
      createdAt: Date.now(),
      createdBy: currentUser,
      author: currentUser
    };
    await set(newRef, momentData);
    console.log(`Moment added with id: ${newId}`);
    return { id: newId, ...momentData };
  } catch(err) {
    console.error("Error adding shared moment:", err);
    return null;
  }
}

export async function updateSharedMoment(momentId, momentData) {
  if (!currentUser) return false;
  
  try {
    await update(ref(db, `data/moments/${momentId}`), {
      ...momentData,
      updatedAt: Date.now()
    });
    console.log(`Moment updated: ${momentId}`);
    return true;
  } catch(err) {
    console.error("Error updating shared moment:", err);
    return false;
  }
}

export async function deleteSharedMoment(momentId) {
  if (!currentUser) return false;
  
  try {
    await remove(ref(db, `data/moments/${momentId}`));
    console.log(`Moment deleted: ${momentId}`);
    return true;
  } catch(err) {
    console.error("Error deleting shared moment:", err);
    return false;
  }
}

export async function getSharedKeuangan() {
  if (!currentUser) return { transaksi: {} };
  try {
    const snap = await get(ref(db, `data/keuangan/${currentUser}/transaksi`));
    const transactions = snap.val() || {};
    
    let partnerTransactions = {};
    if (currentPartner) {
      const partnerSnap = await get(ref(db, `data/keuangan/${currentPartner}/transaksi`));
      partnerTransactions = partnerSnap.val() || {};
    }
    
    const allTransactions = {};
    
    Object.entries(transactions).forEach(([id, trans]) => {
      allTransactions[id] = { ...trans, createdBy: currentUser, id };
    });
    
    Object.entries(partnerTransactions).forEach(([id, trans]) => {
      allTransactions[`${id}_partner`] = { ...trans, createdBy: currentPartner, id: id };
    });
    
    return { transaksi: allTransactions };
  } catch(err) {
    console.error("Error getting shared keuangan:", err);
    return { transaksi: {} };
  }
}

export async function addSharedTransaction(transaction) {
  if (!currentUser) return null;
  
  try {
    const newRef = push(ref(db, `data/keuangan/${currentUser}/transaksi`));
    const newId = newRef.key;
    const transData = {
      ...transaction,
      id: newId,
      createdAt: Date.now(),
      createdBy: currentUser
    };
    await set(newRef, transData);
    console.log(`Transaction added for user ${currentUser}`);
    return { id: newId, ...transData };
  } catch(err) {
    console.error("Error adding shared transaction:", err);
    return null;
  }
}

export async function updateSharedTransaction(transactionId, transactionData) {
  if (!currentUser) return false;
  
  try {
    const snap = await get(ref(db, `data/keuangan/${currentUser}/transaksi/${transactionId}`));
    if (snap.exists()) {
      await update(ref(db, `data/keuangan/${currentUser}/transaksi/${transactionId}`), {
        ...transactionData,
        updatedAt: Date.now()
      });
      return true;
    }
    return false;
  } catch(err) {
    console.error("Error updating shared transaction:", err);
    return false;
  }
}

export async function deleteSharedTransaction(transactionId) {
  if (!currentUser) return false;
  
  try {
    await remove(ref(db, `data/keuangan/${currentUser}/transaksi/${transactionId}`));
    console.log(`Transaction deleted for user ${currentUser}`);
    return true;
  } catch(err) {
    console.error("Error deleting shared transaction:", err);
    return false;
  }
}

export async function getSharedCatatan() {
  if (!currentPairId) return { kategori: {}, items: {} };
  try {
    const snap = await get(ref(db, `data/catatan/bersama`));
    return snap.val() || { kategori: {}, items: {} };
  } catch(err) {
    console.error("Error getting shared catatan:", err);
    return { kategori: {}, items: {} };
  }
}

export async function saveSharedCatatan(catatan) {
  if (!currentPairId) return false;
  try {
    await set(ref(db, `data/catatan/bersama`), catatan);
    if (currentPairData) currentPairData.catatan = catatan;
    return true;
  } catch(err) {
    console.error("Error saving shared catatan:", err);
    return false;
  }
}

export async function saveSharedMoments(moments) {
  console.warn("saveSharedMoments not used in this structure");
  return false;
}

export async function saveSharedKeuangan(keuangan) {
  console.warn("saveSharedKeuangan not used in this structure");
  return false;
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

// ============ VALIDASI DUPLIKAT TRANSAKSI ============
export function checkDuplicateTransaction(existingTransactions, newTransaction) {
  const duplicate = existingTransactions.find(t => 
    t.tanggal === newTransaction.tanggal &&
    t.kategori === newTransaction.kategori &&
    t.nominal === newTransaction.nominal &&
    t.tipe === newTransaction.tipe &&
    Math.abs((t.tanggal || 0) - (newTransaction.tanggal || 0)) < 1000
  );
  
  if (duplicate) {
    showNotif("⚠️ Transaksi dengan data yang sama sudah ada!", true, 'warning');
    return true;
  }
  return false;
}

// ============ VALIDASI UKURAN FOTO (MAX 10MB) ============
export async function validateAndCompressPhotos(files, maxSizeMB = 10, maxFiles = 5) {
  if (files.length > maxFiles) {
    showNotif(`❌ Maksimal ${maxFiles} foto`, true, 'error');
    return null;
  }
  
  const compressedPhotos = [];
  
  for (const file of files) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      showNotif(`❌ Foto ${file.name} terlalu besar (max ${maxSizeMB}MB)`, true, 'error');
      return null;
    }
    
    if (!file.type.startsWith('image/')) {
      showNotif(`❌ File ${file.name} bukan gambar`, true, 'error');
      return null;
    }
    
    try {
      const compressed = await compressImage(file, maxSizeMB);
      compressedPhotos.push(compressed);
    } catch (err) {
      console.error('Compression error:', err);
      showNotif(`❌ Gagal memproses ${file.name}`, true, 'error');
      return null;
    }
  }
  
  return compressedPhotos;
}

// ============ COMPRESS IMAGE (MAX 10MB) ============
export function compressImage(file, maxSizeMB = 10) {
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
        
        const fileSizeMB = file.size / (1024 * 1024);
        let maxDimension = 1200;
        if (fileSizeMB > 5) {
          maxDimension = 800;
        } else if (fileSizeMB > 3) {
          maxDimension = 1000;
        }
        
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
        
        let quality = 0.7;
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

// ============ LIMIT FUNCTIONS ============
export async function loadUserLevelAndLimits(username) {
  try {
    const userSnap = await get(ref(db, `data/users/${username}`));
    const userData = userSnap.val();
    
    if (userData && userData.level) {
      currentUserLevel = userData.level;
      
      switch(currentUserLevel) {
        case 'trial':
          currentUserLimits = { moments: 0, transactions: 5, catatan: 5, impian: false, hasMoment: false };
          break;
        case 'basic':
          currentUserLimits = { moments: 50, transactions: 50, catatan: 50, impian: true, hasMoment: true };
          break;
        case 'pro':
          currentUserLimits = { moments: Infinity, transactions: Infinity, catatan: Infinity, impian: true, hasMoment: true };
          break;
        default:
          currentUserLimits = { moments: 0, transactions: 5, catatan: 5, impian: false, hasMoment: false };
      }
      
      console.log(`User level: ${currentUserLevel}, Limits:`, currentUserLimits);
      return { level: currentUserLevel, limits: currentUserLimits };
    } else {
      currentUserLevel = 'trial';
      currentUserLimits = { moments: 0, transactions: 5, catatan: 5, impian: false, hasMoment: false };
      return { level: 'trial', limits: { moments: 0, transactions: 5, catatan: 5, impian: false, hasMoment: false } };
    }
  } catch(err) {
    console.error("Error loading user level:", err);
    return { level: 'trial', limits: { moments: 0, transactions: 5, catatan: 5, impian: false, hasMoment: false } };
  }
}

async function getCurrentUserLimits(username) {
  if (currentUserLimits && currentUserLevel) return currentUserLimits;
  const result = await loadUserLevelAndLimits(username);
  return result.limits;
}

export async function canAddMoment(username) {
  const limits = await getCurrentUserLimits(username);
  if (limits.moments === Infinity) return true;
  if (limits.moments === 0) {
    showNotif(`⚠️ Akun Trial tidak dapat menambah momen. Upgrade ke Basic atau Pro untuk akses momen!`, true, 'warning');
    return false;
  }
  
  const moments = await getSharedMoments();
  const momentsCount = Object.keys(moments).length;
  
  if (momentsCount >= limits.moments) {
    showNotif(`⚠️ Limit momen pasangan Anda ${momentsCount}/${limits.moments}. Upgrade ke Basic atau Pro untuk menambah lebih banyak!`, true, 'warning');
    return false;
  }
  return true;
}

export async function canAddTransaction(username) {
  const limits = await getCurrentUserLimits(username);
  if (limits.transactions === Infinity) return true;
  
  const userTransSnap = await get(ref(db, `data/keuangan/${username}/transaksi`));
  const userTrans = userTransSnap.val() || {};
  const transCount = Object.keys(userTrans).length;
  
  if (transCount >= limits.transactions) {
    showNotif(`⚠️ Limit transaksi Anda ${transCount}/${limits.transactions}. Upgrade ke Basic atau Pro untuk menambah lebih banyak!`, true, 'warning');
    return false;
  }
  return true;
}

export async function canAddCatatan() {
  const username = sessionStorage.getItem("progrowth_user");
  const limits = await getCurrentUserLimits(username);
  if (limits.catatan === Infinity) return true;
  
  const catatan = await getSharedCatatan();
  const items = catatan.items || {};
  let totalItems = 0;
  Object.values(items).forEach(katItems => {
    if (katItems && typeof katItems === 'object') {
      totalItems += Object.keys(katItems).length;
    }
  });
  
  if (totalItems >= limits.catatan) {
    showNotif(`⚠️ Limit catatan pasangan Anda ${totalItems}/${limits.catatan}. Upgrade ke Basic atau Pro untuk menambah lebih banyak!`, true, 'warning');
    return false;
  }
  return true;
}

export async function getRemainingLimits(username) {
  const limits = await getCurrentUserLimits(username);
  const moments = await getSharedMoments();
  const momentsCount = Object.keys(moments).length;
  
  const userTransSnap = await get(ref(db, `data/keuangan/${username}/transaksi`));
  const userTrans = userTransSnap.val() || {};
  const transCount = Object.keys(userTrans).length;
  
  return {
    level: currentUserLevel,
    moments: { used: momentsCount, limit: limits.moments, remaining: limits.moments === Infinity ? Infinity : limits.moments - momentsCount },
    transactions: { used: transCount, limit: limits.transactions, remaining: limits.transactions === Infinity ? Infinity : limits.transactions - transCount }
  };
}

// ============ RENDER LEVEL BADGE DI SIDEBAR ============
export async function renderLevelBadge() {
  const currentUser = sessionStorage.getItem("progrowth_user");
  if (!currentUser) return;
  
  try {
    const userSnap = await get(ref(db, `data/users/${currentUser}`));
    const userData = userSnap.val();
    const level = userData?.level || 'trial';
    
    const levelBadge = document.getElementById('userLevelBadge');
    if (levelBadge) {
      let levelText = '';
      let levelClass = '';
      switch(level) {
        case 'pro': levelText = 'PRO'; levelClass = 'badge-pro'; break;
        case 'basic': levelText = 'BASIC'; levelClass = 'badge-basic'; break;
        default: levelText = 'TRIAL'; levelClass = 'badge-trial';
      }
      levelBadge.innerHTML = `<span class="badge ${levelClass}">${levelText}</span>`;
    }
  } catch(err) {
    console.error("Error rendering level badge:", err);
  }
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

// ============ ANIMASI ============
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

export function initClickAnimation() {
  document.body.addEventListener('click', (e) => {
    const target = e.target.closest('button, .nav-link, .calendar-day, .moment-card');
    if (target && window.innerWidth <= 768) {
      triggerPixelParticles(e.clientX, e.clientY);
    }
  });
}

// ============ EXPORTS KE WINDOW ============
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
window.checkDuplicateTransaction = checkDuplicateTransaction;
window.validateAndCompressPhotos = validateAndCompressPhotos;
window.canAddMoment = canAddMoment;
window.canAddTransaction = canAddTransaction;
window.canAddCatatan = canAddCatatan;
window.getRemainingLimits = getRemainingLimits;
window.renderLevelBadge = renderLevelBadge;
window.loadUserLevelAndLimits = loadUserLevelAndLimits;
window.loadUserPartnerAndPair = loadUserPartnerAndPair;
window.getSharedMoments = getSharedMoments;
window.getSharedKeuangan = getSharedKeuangan;
window.getSharedCatatan = getSharedCatatan;
window.saveSharedMoments = saveSharedMoments;
window.saveSharedKeuangan = saveSharedKeuangan;
window.saveSharedCatatan = saveSharedCatatan;
window.addSharedTransaction = addSharedTransaction;
window.addSharedMoment = addSharedMoment;
window.updateSharedMoment = updateSharedMoment;
window.deleteSharedMoment = deleteSharedMoment;
window.updateSharedTransaction = updateSharedTransaction;
window.deleteSharedTransaction = deleteSharedTransaction;
