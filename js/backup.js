// js/backup.js - Hanya untuk backup data (tanpa tombol otomatis di profile)
import { db, ref, get } from './firebase-config.js';
import { showNotif, showLoading, hideLoading } from './utils.js';

// Backup manual semua data (hanya dipanggil dari menu Laporan)
export async function backupAllData() {
  showLoading("Membackup data...");
  
  try {
    const snapshot = await get(ref(db, "data/"));
    const allData = snapshot.val() || {};
    
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

// Hapus fungsi restore dan addBackupButtonToProfile
// Restore tidak disediakan untuk keamanan data

window.backupAllData = backupAllData;
