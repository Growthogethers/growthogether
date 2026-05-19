// js/utils.js
export let currentUser = null;
export let masterData = null;
export let privacyHidden = false;

// Toast
let toastQueue = [];
let isToastShowing = false;

export function showNotif(msg, isErr = false) { 
  const t = document.getElementById("customToast"); 
  if (!t) return;
  
  if (isToastShowing) {
    toastQueue.push({ msg, isErr });
    return;
  }
  
  isToastShowing = true;
  const toastBody = t.querySelector(".toast-body");
  if (toastBody) toastBody.innerText = msg;
  t.style.display = "block"; 
  const toastDiv = t.querySelector(".toast");
  if (toastDiv) {
    toastDiv.className = `toast align-items-center border-0 ${isErr ? "text-bg-danger" : "text-bg-success"}`;
  }
  
  setTimeout(() => {
    t.style.display = "none";
    isToastShowing = false;
    
    if (toastQueue.length > 0) {
      const next = toastQueue.shift();
      showNotif(next.msg, next.isErr);
    }
  }, 2700); 
}

export function hideToast() { 
  const toast = document.getElementById("customToast");
  if (toast) toast.style.display = "none"; 
  isToastShowing = false;
}

export function formatNumberRp(val) { 
  if (privacyHidden) return "●●● ●●●";
  if (val === undefined || val === null) return "Rp 0";
  return `Rp ${val.toLocaleString('id-ID')}`;
}

export function escapeHtml(str) { 
  if (!str) return ""; 
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function togglePrivacy() { 
  privacyHidden = !privacyHidden; 
  showNotif(privacyHidden ? "🔒 Angka disembunyikan" : "👁️ Angka ditampilkan"); 
}

export function setCurrentUser(user) { currentUser = user; }
export function setMasterData(data) { masterData = data; window.masterData = data; }

// Compress image
export async function compressImage(file, maxSizeMB = 2) {
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

// Expose ke window
window.showNotif = showNotif;
window.hideToast = hideToast;
window.formatNumberRp = formatNumberRp;
window.togglePrivacy = togglePrivacy;