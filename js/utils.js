// js/utils.js - Tambahan fungsi custom modal
export let currentUser = null;
export let masterData = null;
export let privacyHidden = false;

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

// Custom Prompt Modal (menggantikan prompt bawaan browser)
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
    
    document.getElementById('promptTitle').innerText = title;
    const input = document.getElementById('promptInput');
    input.placeholder = placeholder;
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

// Custom Confirm Modal (menggantikan confirm bawaan browser)
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
    
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerText = message;
    
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

window.showNotif = showNotif;
window.formatNumberRp = formatNumberRp;
window.togglePrivacy = togglePrivacy;
window.showCustomPrompt = showCustomPrompt;
window.showCustomConfirm = showCustomConfirm;
