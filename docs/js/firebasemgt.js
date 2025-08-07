import { db, auth } from './firebase-config.js';
import { ref, get, set, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { translate, setLanguage, updatePageTranslations } from './i18n.js';

// Global variables
let currentUser = null;
let isAdmin = false;

// Database sections that can be edited
const DATABASE_SECTIONS = [
  'tethers',
  'global_templates', 
  'shared_logs',
  'reference_content',
  'users',
  'vendor_contacts'
];

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
    loadAllData();
  } else {
    accessDenied.classList.remove('hidden');
    loadingState.classList.add('hidden');
    mainContent.classList.add('hidden');
  }
}

// Data management functions
async function loadData(section) {
  try {
    const textarea = document.getElementById(`${section}-data`);
    textarea.value = 'Loading...';
    
    const dataRef = ref(db, section);
    const snapshot = await get(dataRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      textarea.value = JSON.stringify(data, null, 2);
    } else {
      textarea.value = '{}';
    }
    
    // Add success indicator
    textarea.style.borderColor = '#10B981';
    setTimeout(() => {
      textarea.style.borderColor = '';
    }, 1000);
    
  } catch (error) {
    console.error(`Error loading ${section}:`, error);
    const textarea = document.getElementById(`${section}-data`);
    textarea.value = `Error loading data: ${error.message}`;
    textarea.style.borderColor = '#EF4444';
  }
}

async function saveData(section) {
  try {
    const textarea = document.getElementById(`${section}-data`);
    const jsonText = textarea.value.trim();
    
    if (!jsonText) {
      alert('No data to save');
      return;
    }
    
    // Validate JSON
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (parseError) {
      alert('Invalid JSON format. Please check your syntax.');
      textarea.style.borderColor = '#EF4444';
      return;
    }
    
    // Confirm save
    if (!confirm(`Are you sure you want to save changes to ${section}? This will overwrite existing data.`)) {
      return;
    }
    
    // Save to Firebase
    const dataRef = ref(db, section);
    
    if (Object.keys(data).length === 0) {
      // If empty object, remove the section
      await remove(dataRef);
    } else {
      await set(dataRef, data);
    }
    
    // Success feedback
    textarea.style.borderColor = '#10B981';
    showSuccessMessage(`${section} saved successfully!`);
    
    setTimeout(() => {
      textarea.style.borderColor = '';
    }, 2000);
    
  } catch (error) {
    console.error(`Error saving ${section}:`, error);
    alert(`Error saving ${section}: ${error.message}`);
    
    const textarea = document.getElementById(`${section}-data`);
    textarea.style.borderColor = '#EF4444';
  }
}

async function loadAllData() {
  for (const section of DATABASE_SECTIONS) {
    await loadData(section);
    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  showSuccessMessage('All data loaded successfully!');
}

function exportAllData() {
  try {
    const exportData = {};
    
    DATABASE_SECTIONS.forEach(section => {
      const textarea = document.getElementById(`${section}-data`);
      try {
        const data = JSON.parse(textarea.value);
        exportData[section] = data;
      } catch (error) {
        console.warn(`Skipping ${section} due to invalid JSON`);
      }
    });
    
    // Add metadata
    exportData._metadata = {
      exportDate: new Date().toISOString(),
      exportedBy: currentUser?.email || 'unknown',
      version: '1.0'
    };
    
    // Create download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `tether-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccessMessage('Database backup exported successfully!');
    
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Error exporting data: ' + error.message);
  }
}

function showImportDialog() {
  document.getElementById('import-modal').classList.remove('hidden');
}

function hideImportDialog() {
  document.getElementById('import-modal').classList.add('hidden');
  document.getElementById('import-file').value = '';
}

async function importData() {
  try {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    
    if (!file) {
      alert('Please select a file to import');
      return;
    }
    
    if (!file.name.endsWith('.json')) {
      alert('Please select a JSON file');
      return;
    }
    
    const text = await file.text();
    const importData = JSON.parse(text);
    
    // Validate import data structure
    const validSections = DATABASE_SECTIONS.filter(section => 
      importData.hasOwnProperty(section)
    );
    
    if (validSections.length === 0) {
      alert('No valid database sections found in the import file');
      return;
    }
    
    // Final confirmation
    const sectionsText = validSections.join(', ');
    if (!confirm(`This will import data for: ${sectionsText}\n\nThis will OVERWRITE existing data. Are you sure?`)) {
      return;
    }
    
    // Import each section
    let successCount = 0;
    for (const section of validSections) {
      try {
        const dataRef = ref(db, section);
        await set(dataRef, importData[section]);
        
        // Update textarea
        const textarea = document.getElementById(`${section}-data`);
        textarea.value = JSON.stringify(importData[section], null, 2);
        
        successCount++;
      } catch (error) {
        console.error(`Error importing ${section}:`, error);
        alert(`Error importing ${section}: ${error.message}`);
      }
    }
    
    hideImportDialog();
    showSuccessMessage(`Successfully imported ${successCount} sections!`);
    
  } catch (error) {
    console.error('Error importing data:', error);
    alert('Error importing data: ' + error.message);
  }
}

// Make functions globally available
window.loadData = loadData;
window.saveData = saveData;
window.loadAllData = loadAllData;
window.exportAllData = exportAllData;
window.showImportDialog = showImportDialog;
window.hideImportDialog = hideImportDialog;
window.importData = importData;

// UI helper functions
function showSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'alert-success fixed top-4 right-4 z-50 max-w-sm';
  successDiv.textContent = message;
  
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    successDiv.remove();
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