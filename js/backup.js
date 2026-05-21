// js/backup.js - Fitur backup otomatis
import { db, ref, get } from './firebase-config.js';
import { showNotif, showLoading, hideLoading } from './utils.js';

// Backup manual semua data
export async function backupAllData() {
  showLoading("Membackup data...");
  
  try {
    const snapshot = await get(ref(db, "data/"));
    const allData = snapshot.val() || {};
    
    // Tambahkan metadata backup
    const backupData = {
      version: "1.0",
      backupDate: new Date().toISOString(),
      data: allData
    };
    
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `growthogether_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotif("✅ Backup berhasil! File JSON telah diunduh", false, 'success');
  } catch (err) {
    console.error("Backup error:", err);
    showNotif("❌ Gagal backup data", true, 'error');
  } finally {
    hideLoading();
  }
}

// Restore data dari file backup
export async function restoreFromBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        
        if (!backupData.data) {
          throw new Error("Format backup tidak valid");
        }
        
        showLoading("Restore data...");
        
        // Proses restore (hati-hati: ini akan menimpa data yang ada)
        const { db, ref, set } = await import('./firebase-config.js');
        
        for (const [key, value] of Object.entries(backupData.data)) {
          await set(ref(db, `data/${key}`), value);
        }
        
        showNotif("✅ Restore berhasil! Refresh halaman untuk melihat perubahan", false, 'success');
        resolve(true);
      } catch (err) {
        console.error("Restore error:", err);
        showNotif("❌ Gagal restore data: format tidak valid", true, 'error');
        reject(err);
      } finally {
        hideLoading();
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Tambahkan tombol backup di profile modal
export function addBackupButtonToProfile() {
  const profileModalFooter = document.querySelector('#profileModal .modal-footer');
  if (profileModalFooter && !document.getElementById('backupBtn')) {
    const backupBtn = document.createElement('button');
    backupBtn.id = 'backupBtn';
    backupBtn.className = 'btn btn-outline-secondary rounded-pill me-auto';
    backupBtn.innerHTML = '<i class="bi bi-download me-1"></i> Backup Data';
    backupBtn.onclick = backupAllData;
    profileModalFooter.insertBefore(backupBtn, profileModalFooter.firstChild);
  }
}

// Panggil ini saat profile modal dibuka
window.addBackupButtonToProfile = addBackupButtonToProfile;
