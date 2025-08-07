import { db, auth } from './firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { translate, setLanguage, updatePageTranslations } from './i18n.js';

// Global variables
let currentUser = null;
let isAdmin = false;
let tetherTypesChart = null;

// Authentication handling
function initializeAuth() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateAuthStatus();
    
    if (user) {
      // Check if user is admin
      const token = await user.getIdTokenResult();
      isAdmin = token.claims.admin === true;
      updateAccessControl();
    } else {
      isAdmin = false;
      updateAccessControl();
    }
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
  
  if (isAdmin) {
    accessDenied.classList.add('hidden');
    loadingState.classList.add('hidden');
    mainContent.classList.remove('hidden');
    loadDashboardData();
  } else {
    accessDenied.classList.remove('hidden');
    loadingState.classList.add('hidden');
    mainContent.classList.add('hidden');
  }
}

// Dashboard data loading
async function loadDashboardData() {
  try {
    await Promise.all([
      loadMetrics(),
      loadCharts(),
      loadRecentActivity(),
      loadPopularTemplates()
    ]);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

async function loadMetrics() {
  try {
    // Load all data in parallel
    const [tethersSnapshot, templatesSnapshot, sharedLogsSnapshot, usersSnapshot] = await Promise.all([
      get(ref(db, 'tethers')),
      get(ref(db, 'global_templates')),
      get(ref(db, 'shared_logs')),
      get(ref(db, 'users'))
    ]);
    
    // Calculate metrics
    const totalTethers = tethersSnapshot.exists() ? Object.keys(tethersSnapshot.val()).length : 0;
    const totalTemplates = templatesSnapshot.exists() ? Object.keys(templatesSnapshot.val()).length : 0;
    
    // Count total logs (shared + personal)
    let totalLogs = 0;
    
    // Count shared logs
    if (sharedLogsSnapshot.exists()) {
      const sharedLogs = sharedLogsSnapshot.val();
      Object.values(sharedLogs).forEach(tetherLogs => {
        if (tetherLogs.entries) {
          totalLogs += Object.keys(tetherLogs.entries).length;
        }
      });
    }
    
    // Count personal logs
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      Object.values(users).forEach(user => {
        if (user.logs) {
          Object.values(user.logs).forEach(tetherLogs => {
            if (tetherLogs.entries) {
              totalLogs += Object.keys(tetherLogs.entries).length;
            }
          });
        }
      });
    }
    
    // Calculate today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    let todayActivity = 0;
    
    // Count today's shared logs
    if (sharedLogsSnapshot.exists()) {
      const sharedLogs = sharedLogsSnapshot.val();
      Object.values(sharedLogs).forEach(tetherLogs => {
        if (tetherLogs.entries) {
          Object.values(tetherLogs.entries).forEach(entry => {
            if (entry.timestamp >= todayTimestamp) {
              todayActivity++;
            }
          });
        }
      });
    }
    
    // Count today's personal logs
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      Object.values(users).forEach(user => {
        if (user.logs) {
          Object.values(user.logs).forEach(tetherLogs => {
            if (tetherLogs.entries) {
              Object.values(tetherLogs.entries).forEach(entry => {
                if (entry.timestamp >= todayTimestamp) {
                  todayActivity++;
                }
              });
            }
          });
        }
      });
    }
    
    // Update UI
    document.getElementById('total-tethers').textContent = totalTethers;
    document.getElementById('total-logs').textContent = totalLogs;
    document.getElementById('total-templates').textContent = totalTemplates;
    document.getElementById('today-activity').textContent = todayActivity;
    
  } catch (error) {
    console.error('Error loading metrics:', error);
    // Set error values
    ['total-tethers', 'total-logs', 'total-templates', 'today-activity'].forEach(id => {
      document.getElementById(id).textContent = '!';
    });
  }
}

async function loadCharts() {
  try {
    const tethersSnapshot = await get(ref(db, 'tethers'));
    
    if (!tethersSnapshot.exists()) {
      createEmptyChart();
      return;
    }
    
    const tethers = tethersSnapshot.val();
    const typeCounts = {};
    
    Object.values(tethers).forEach(tether => {
      const type = tether.type || 'terra';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    createTetherTypesChart(typeCounts);
    
  } catch (error) {
    console.error('Error loading charts:', error);
    createEmptyChart();
  }
}

function createTetherTypesChart(typeCounts) {
  const ctx = document.getElementById('tether-types-chart').getContext('2d');
  
  // Destroy existing chart if it exists
  if (tetherTypesChart) {
    tetherTypesChart.destroy();
  }
  
  const labels = Object.keys(typeCounts);
  const data = Object.values(typeCounts);
  
  tetherTypesChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.map(label => label.charAt(0).toUpperCase() + label.slice(1)),
      datasets: [{
        data: data,
        backgroundColor: [
          '#3B82F6', // Blue for Terra
          '#8B5CF6', // Purple for Aura
          '#10B981', // Green for others
          '#F59E0B'  // Amber for others
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

function createEmptyChart() {
  const ctx = document.getElementById('tether-types-chart').getContext('2d');
  
  if (tetherTypesChart) {
    tetherTypesChart.destroy();
  }
  
  tetherTypesChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['No Data'],
      datasets: [{
        data: [1],
        backgroundColor: ['#E5E7EB'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

async function loadRecentActivity() {
  try {
    const container = document.getElementById('recent-activity');
    const activities = [];
    
    // Get recent shared logs
    const sharedLogsSnapshot = await get(ref(db, 'shared_logs'));
    if (sharedLogsSnapshot.exists()) {
      const sharedLogs = sharedLogsSnapshot.val();
      Object.entries(sharedLogs).forEach(([tetherId, tetherLogs]) => {
        if (tetherLogs.entries) {
          Object.values(tetherLogs.entries).forEach(entry => {
            activities.push({
              type: 'shared_log',
              tetherId,
              timestamp: entry.timestamp,
              user: entry.submittedBy
            });
          });
        }
      });
    }
    
    // Get recent tether creations
    const tethersSnapshot = await get(ref(db, 'tethers'));
    if (tethersSnapshot.exists()) {
      const tethers = tethersSnapshot.val();
      Object.entries(tethers).forEach(([tetherId, tether]) => {
        if (tether.created) {
          activities.push({
            type: 'tether_created',
            tetherId,
            timestamp: tether.created,
            user: tether.createdBy
          });
        }
      });
    }
    
    // Sort by timestamp (most recent first) and take last 10
    activities.sort((a, b) => b.timestamp - a.timestamp);
    const recentActivities = activities.slice(0, 10);
    
    if (recentActivities.length === 0) {
      container.innerHTML = '<p class="text-gray-600">No recent activity</p>';
      return;
    }
    
    container.innerHTML = recentActivities.map(activity => {
      const date = new Date(activity.timestamp);
      const timeAgo = getTimeAgo(activity.timestamp);
      
      let activityText = '';
      let icon = '';
      
      switch (activity.type) {
        case 'shared_log':
          icon = '📝';
          activityText = `Log entry added to ${activity.tetherId}`;
          break;
        case 'tether_created':
          icon = '🔗';
          activityText = `Tether ${activity.tetherId} created`;
          break;
        default:
          icon = '•';
          activityText = 'Unknown activity';
      }
      
      return `
        <div class="flex items-start space-x-3 p-3 bg-gray-50 rounded">
          <span class="text-lg">${icon}</span>
          <div class="flex-1">
            <p class="text-sm">${activityText}</p>
            <p class="text-xs text-gray-500">${timeAgo} by ${activity.user || 'unknown'}</p>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading recent activity:', error);
    document.getElementById('recent-activity').innerHTML = 
      '<p class="text-red-600">Error loading activity</p>';
  }
}

async function loadPopularTemplates() {
  try {
    const [templatesSnapshot, tethersSnapshot] = await Promise.all([
      get(ref(db, 'global_templates')),
      get(ref(db, 'tethers'))
    ]);
    
    const container = document.getElementById('popular-templates');
    
    if (!templatesSnapshot.exists()) {
      container.innerHTML = '<p class="text-gray-600">No templates found</p>';
      return;
    }
    
    const templates = templatesSnapshot.val();
    const templateUsage = {};
    
    // Count template usage
    if (tethersSnapshot.exists()) {
      const tethers = tethersSnapshot.val();
      Object.values(tethers).forEach(tether => {
        if (tether.template) {
          templateUsage[tether.template] = (templateUsage[tether.template] || 0) + 1;
        }
      });
    }
    
    // Sort templates by usage
    const sortedTemplates = Object.entries(templates)
      .map(([id, template]) => ({
        id,
        ...template,
        usage: templateUsage[id] || 0
      }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5);
    
    if (sortedTemplates.length === 0) {
      container.innerHTML = '<p class="text-gray-600">No templates available</p>';
      return;
    }
    
    container.innerHTML = `
      <div class="space-y-3">
        ${sortedTemplates.map(template => `
          <div class="flex justify-between items-center p-3 bg-gray-50 rounded">
            <div>
              <h4 class="font-semibold">${template.name}</h4>
              <p class="text-sm text-gray-600 capitalize">${template.type || 'terra'} template</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-bold text-blue-600">${template.usage}</p>
              <p class="text-xs text-gray-500">uses</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading popular templates:', error);
    document.getElementById('popular-templates').innerHTML = 
      '<p class="text-red-600">Error loading templates</p>';
  }
}

// Utility functions
function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
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