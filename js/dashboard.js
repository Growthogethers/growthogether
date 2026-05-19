// js/dashboard.js - Dashboard kosong
import { masterData, privacyHidden, formatNumberRp } from './utils.js';

export function renderDashboard() {
  if (!masterData) {
    console.log("masterData not available yet");
    return;
  }
  
  console.log("Dashboard rendered - empty dashboard");
}

// Export ke window
window.renderDashboard = renderDashboard;