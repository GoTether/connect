import { db, auth } from './firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { translate, setLanguage, updatePageTranslations } from './i18n.js';

// Global variables
let currentUser = null;

// Authentication handling
function initializeAuth() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateAuthStatus();
    updateAccessControl();
  });
}

function updateAuthStatus() {
  const authInfo = document.getElementById('auth-info');
  const authButton = document.getElementById('auth-button');
  
  if (currentUser) {
    authInfo.textContent = currentUser.email || currentUser.displayName || 'User';
    authButton.textContent = translate('logout');
    authButton.onclick = logout;
  } else {
    authInfo.textContent = 'Not logged in';
    authButton.textContent = translate('login');
    authButton.onclick = loginWithGoogle;
  }
  authButton.style.display = 'inline';
}

async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Google login failed:', error);
  }
}

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

function updateAccessControl() {
  const accessDenied = document.getElementById('access-denied');
  const loadingState = document.getElementById('loading-state');
  const mainContent = document.getElementById('main-content');
  
  if (currentUser && !currentUser.isAnonymous) {
    accessDenied.classList.add('hidden');
    loadingState.classList.remove('hidden');
    mainContent.classList.add('hidden');
    loadAuraData();
  } else {
    accessDenied.classList.remove('hidden');
    loadingState.classList.add('hidden');
    mainContent.classList.add('hidden');
  }
}

// Load Aura data
async function loadAuraData() {
  try {
    await Promise.all([
      loadAuraSummary(),
      loadAuraTethers()
    ]);
    
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    
  } catch (error) {
    console.error('Error loading Aura data:', error);
    showError('Error loading your Aura data');
  }
}

async function loadAuraSummary() {
  try {
    const userLogsRef = ref(db, `users/${currentUser.uid}/logs`);
    const snapshot = await get(userLogsRef);
    
    let totalTethers = 0;
    let totalLogs = 0;
    let monthLogs = 0;
    
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthTimestamp = currentMonth.getTime();
    
    if (snapshot.exists()) {
      const logs = snapshot.val();
      totalTethers = Object.keys(logs).length;
      
      Object.values(logs).forEach(tetherLogs => {
        if (tetherLogs.entries) {
          const entries = Object.values(tetherLogs.entries);
          totalLogs += entries.length;
          
          // Count this month's logs
          monthLogs += entries.filter(entry => 
            entry.timestamp >= monthTimestamp
          ).length;
        }
      });
    }
    
    document.getElementById('total-aura-tethers').textContent = totalTethers;
    document.getElementById('total-aura-logs').textContent = totalLogs;
    document.getElementById('month-aura-logs').textContent = monthLogs;
    
  } catch (error) {
    console.error('Error loading Aura summary:', error);
    ['total-aura-tethers', 'total-aura-logs', 'month-aura-logs'].forEach(id => {
      document.getElementById(id).textContent = '!';
    });
  }
}

async function loadAuraTethers() {
  try {
    const userLogsRef = ref(db, `users/${currentUser.uid}/logs`);
    const snapshot = await get(userLogsRef);
    const container = document.getElementById('aura-tethers-list');
    
    if (!snapshot.exists()) {
      container.innerHTML = `
        <div class="text-center py-12">
          <div class="text-6xl mb-4">✨</div>
          <h3 class="text-lg font-semibold mb-2">No Aura Tethers Yet</h3>
          <p class="text-gray-600 mb-4">You haven't interacted with any Aura Tethers yet.</p>
          <a href="display.html?id=demo&unassigned=true" class="btn-primary">Explore Demo Tether</a>
        </div>
      `;
      return;
    }
    
    const logs = snapshot.val();
    
    // Get additional tether info for each
    const tetherPromises = Object.keys(logs).map(async (tetherId) => {
      try {
        const tetherRef = ref(db, `tethers/${tetherId}`);
        const tetherSnapshot = await get(tetherRef);
        
        let tetherInfo = null;
        if (tetherSnapshot.exists()) {
          tetherInfo = tetherSnapshot.val();
        }
        
        // Get reference content if it exists
        const contentRef = ref(db, `reference_content/${tetherId}`);
        const contentSnapshot = await get(contentRef);
        let referenceContent = null;
        if (contentSnapshot.exists()) {
          referenceContent = contentSnapshot.val();
        }
        
        return {
          id: tetherId,
          logs: logs[tetherId],
          tetherInfo,
          referenceContent
        };
      } catch (error) {
        console.error(`Error loading tether ${tetherId}:`, error);
        return {
          id: tetherId,
          logs: logs[tetherId],
          tetherInfo: null,
          referenceContent: null
        };
      }
    });
    
    const tethers = await Promise.all(tetherPromises);
    
    // Sort by most recent activity
    tethers.sort((a, b) => {
      const aLatest = getLatestLogTimestamp(a.logs);
      const bLatest = getLatestLogTimestamp(b.logs);
      return bLatest - aLatest;
    });
    
    container.innerHTML = tethers.map(tether => {
      const logCount = tether.logs.entries ? Object.keys(tether.logs.entries).length : 0;
      const latestLog = getLatestLogTimestamp(tether.logs);
      const latestDate = latestLog ? new Date(latestLog).toLocaleDateString() : 'No logs';
      
      return `
        <div class="border rounded-lg p-6 mb-4 bg-white hover:shadow-md transition-shadow">
          <div class="flex justify-between items-start mb-4">
            <div class="flex-1">
              <div class="flex items-center mb-2">
                <h3 class="text-lg font-semibold mr-3">${tether.id}</h3>
                <span class="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">Aura</span>
                ${tether.tetherInfo?.locked ? '<span class="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded ml-2">Locked</span>' : ''}
              </div>
              
              ${tether.referenceContent ? `
                <div class="bg-blue-50 p-3 rounded mb-3">
                  <h4 class="font-semibold text-sm">${tether.referenceContent.title || 'Reference Content'}</h4>
                  ${tether.referenceContent.description ? `<p class="text-xs text-gray-600 mt-1">${tether.referenceContent.description}</p>` : ''}
                </div>
              ` : ''}
              
              <div class="text-sm text-gray-600 space-x-4">
                <span>${logCount} logs</span>
                <span>Latest: ${latestDate}</span>
              </div>
            </div>
            
            <div class="space-x-2">
              <button onclick="viewTetherLogs('${tether.id}')" class="btn-secondary text-sm">View Logs</button>
              <a href="display.html?id=${tether.id}" class="btn-primary text-sm">Open Tether</a>
            </div>
          </div>
          
          ${logCount > 0 ? `
            <div class="bg-gray-50 rounded p-3">
              <h4 class="font-semibold text-sm mb-2">Recent Activity</h4>
              <div class="space-y-1">
                ${getRecentLogs(tether.logs, 3).map(log => `
                  <div class="text-xs text-gray-600">
                    ${new Date(log.timestamp).toLocaleDateString()} - 
                    ${Object.keys(log.data).length} fields logged
                  </div>
                `).join('')}
              </div>
            </div>
          ` : '<p class="text-gray-500 text-sm">No logs yet</p>'}
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading Aura tethers:', error);
    document.getElementById('aura-tethers-list').innerHTML = 
      '<p class="text-red-600">Error loading your Aura Tethers</p>';
  }
}

// View tether logs in modal
function viewTetherLogs(tetherId) {
  showLogDetailsModal(tetherId);
}

// Make viewTetherLogs globally available
window.viewTetherLogs = viewTetherLogs;

async function showLogDetailsModal(tetherId) {
  try {
    const modal = document.getElementById('log-details-modal');
    const titleElement = document.getElementById('modal-tether-title');
    const contentElement = document.getElementById('modal-log-content');
    
    titleElement.textContent = `Logs for ${tetherId}`;
    contentElement.innerHTML = '<div class="text-center py-4"><div class="spinner"></div></div>';
    modal.classList.remove('hidden');
    
    // Load logs
    const logsRef = ref(db, `users/${currentUser.uid}/logs/${tetherId}/entries`);
    const snapshot = await get(logsRef);
    
    if (!snapshot.exists()) {
      contentElement.innerHTML = '<p class="text-gray-600">No logs found for this Tether</p>';
      return;
    }
    
    const logs = snapshot.val();
    const logEntries = Object.entries(logs)
      .map(([id, log]) => ({ id, ...log }))
      .sort((a, b) => b.timestamp - a.timestamp);
    
    // Get template info to format logs better
    const tetherRef = ref(db, `tethers/${tetherId}`);
    const tetherSnapshot = await get(tetherRef);
    let template = null;
    
    if (tetherSnapshot.exists()) {
      const tetherData = tetherSnapshot.val();
      if (tetherData.template) {
        const templateRef = ref(db, `global_templates/${tetherData.template}`);
        const templateSnapshot = await get(templateRef);
        if (templateSnapshot.exists()) {
          template = templateSnapshot.val();
        }
      }
    }
    
    contentElement.innerHTML = `
      <div class="max-h-96 overflow-y-auto">
        <div class="space-y-4">
          ${logEntries.map(log => {
            const date = new Date(log.timestamp).toLocaleString();
            
            return `
              <div class="border rounded p-4 bg-gray-50">
                <div class="flex justify-between items-center mb-2">
                  <span class="text-sm font-semibold">${date}</span>
                  <span class="text-xs text-gray-500">ID: ${log.id}</span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  ${Object.entries(log.data).map(([field, value]) => {
                    const fieldConfig = template?.fields?.[field];
                    const fieldType = fieldConfig?.type || 'text';
                    
                    let displayValue = value;
                    if (fieldType === 'date' && value) {
                      displayValue = new Date(value).toLocaleDateString();
                    } else if (fieldType === 'url' && value) {
                      displayValue = `<a href="${value}" target="_blank" class="text-blue-600">${value}</a>`;
                    } else if (fieldType === 'email' && value) {
                      displayValue = `<a href="mailto:${value}" class="text-blue-600">${value}</a>`;
                    }
                    
                    return `
                      <div>
                        <label class="text-xs font-medium text-gray-700">${field}</label>
                        <div class="text-sm">${displayValue}</div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading tether logs:', error);
    document.getElementById('modal-log-content').innerHTML = 
      '<p class="text-red-600">Error loading logs</p>';
  }
}

function hideLogDetailsModal() {
  document.getElementById('log-details-modal').classList.add('hidden');
}

// Make hideLogDetailsModal globally available
window.hideLogDetailsModal = hideLogDetailsModal;

// Utility functions
function getLatestLogTimestamp(logs) {
  if (!logs.entries) return 0;
  
  const timestamps = Object.values(logs.entries).map(log => log.timestamp);
  return Math.max(...timestamps);
}

function getRecentLogs(logs, count = 3) {
  if (!logs.entries) return [];
  
  return Object.values(logs.entries)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, count);
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'alert-error fixed top-4 right-4 z-50 max-w-sm';
  errorDiv.textContent = message;
  
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

// Language selector
function initializeLanguageSelector() {
  const languageSelector = document.getElementById('language-selector');
  const currentLang = localStorage.getItem('language') || 'en';
  languageSelector.value = currentLang;
  
  languageSelector.addEventListener('change', (e) => {
    setLanguage(e.target.value);
  });
}

// Initialize login button
function initializeLoginButton() {
  document.getElementById('login-btn').onclick = loginWithGoogle;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeLanguageSelector();
  initializeAuth();
  initializeLoginButton();
  updatePageTranslations();
});