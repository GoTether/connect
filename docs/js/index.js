import { db } from './firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { translate, setLanguage, updatePageTranslations } from './i18n.js';

// Get URL parameters
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Show error message
function showError(message, details = '') {
  const errorDiv = document.getElementById('error-message');
  const errorDetails = document.getElementById('error-details');
  const loadingDiv = document.getElementById('loading');
  
  loadingDiv.style.display = 'none';
  errorDiv.classList.remove('hidden');
  errorDetails.textContent = details;
}

// Show success message
function showSuccess(message) {
  const successDiv = document.getElementById('success-message');
  const successText = document.getElementById('success-text');
  const loadingDiv = document.getElementById('loading');
  
  loadingDiv.style.display = 'none';
  successDiv.classList.remove('hidden');
  successText.textContent = message;
}

// Hide loading spinner
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// Redirect to display page
function redirectToDisplay(tetherId, unassigned = false) {
  const params = new URLSearchParams({ id: tetherId });
  if (unassigned) {
    params.append('unassigned', 'true');
  }
  window.location.href = `display.html?${params.toString()}`;
}

// Main logic
async function initializeApp() {
  try {
    // Get Tether ID from URL
    const tetherId = getQueryParam('id');
    
    if (!tetherId) {
      showError(translate('no_tether_id'), 'Please provide a Tether ID in the URL (?id=abc123)');
      return;
    }

    // Check if Tether exists in Firebase
    const tetherRef = ref(db, `tethers/${tetherId}`);
    const snapshot = await get(tetherRef);
    
    if (snapshot.exists()) {
      // Tether exists, redirect to display page
      showSuccess('Tether found! Redirecting...');
      setTimeout(() => {
        redirectToDisplay(tetherId);
      }, 1000);
    } else {
      // Tether doesn't exist, redirect to display page with unassigned flag
      showSuccess('New Tether detected! Setting up...');
      setTimeout(() => {
        redirectToDisplay(tetherId, true);
      }, 1000);
    }
    
  } catch (error) {
    console.error('Error checking Tether:', error);
    showError(translate('error'), error.message || 'Failed to connect to database');
  }
}

// Language selector handler
function initializeLanguageSelector() {
  const languageSelector = document.getElementById('language-selector');
  
  // Set current language
  const currentLang = localStorage.getItem('language') || 'en';
  languageSelector.value = currentLang;
  
  // Handle language change
  languageSelector.addEventListener('change', (e) => {
    setLanguage(e.target.value);
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeLanguageSelector();
  updatePageTranslations();
  
  // Wait a moment for i18next to initialize
  setTimeout(() => {
    initializeApp();
  }, 100);
});