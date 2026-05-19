// js/utils.js
export let currentUser = null;
export let masterData = null;
export let privacyHidden = false;

// ============ CUSTOM TOAST (BUKAN BROWSER DEFAULT) ============
let toastQueue = [];
let isToastShowing = false;

export function showNotif(msg, isErr = false, type = 'success') {
  let toastContainer = document.getElementById('customToastContainer');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'customToastContainer';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '80px';
    toastContainer.style.left = '50%';
    toastContainer.style.transform = 'translateX(-50%)';
    toastContainer.style.zIndex = '9999';
    toastContainer.style.pointerEvents = 'none';
    document.body.appendChild(toastContainer);
  }
  
  if (isToastShowing) {
    toastQueue.push({ msg, isErr, type });
    return;
  }
  
  isToastShowing = true;
  
  const toast = document.createElement('div');
  toast.className = `custom-toast ${isErr ? 'error' : type === 'warning' ? 'warning' : 'success'}`;
  toast.innerHTML = `
    <i class="bi ${isErr ? 'bi-exclamation-triangle-fill' : type === 'warning' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}"></i>
    <span class="toast-message">${msg}</span>
  `;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
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

export function formatNumberRp(val) { 
  if (privacyHidden) return "●●● ●●●";
  if (val === undefined || val === null) return "Rp 0";
  return `Rp ${val.toLocaleString('id-ID')}`;
}

export function escapeHtml(str) { 
  if (!str) return ""; 
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function togglePrivacy() { 
  privacyHidden = !privacyHidden; 
  showNotif(privacyHidden ? "🔒 Angka disembunyikan" : "👁️ Angka ditampilkan", false, 'info'); 
  if (window.renderDashboard) window.renderDashboard();
}

export function setCurrentUser(user) { currentUser = user; }
export function setMasterData(data) { masterData = data; window.masterData = data; }

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

// Expose
window.showNotif = showNotif;
window.formatNumberRp = formatNumberRp;
window.togglePrivacy = togglePrivacy;
