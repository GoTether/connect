// Fallback for when i18next fails to load
let translations = {
  en: {
    welcome: "Welcome to Tether",
    error: "Connection Error",
    no_tether_id: "Ready to Connect",
    loading: "Initializing connection...",
    tether_found: "Tether Found!",
    new_tether: "New Tether Detected!",
    redirecting: "Connecting you to your Tether..."
  }
};

let currentLang = 'en';

// Fallback translation function
function translate(key) {
  if (window.i18next && window.i18next.t) {
    return window.i18next.t(key);
  }
  return translations[currentLang][key] || key;
}

// Import Firebase modules with error handling
let db = null;
let firebaseLoaded = false;

async function initializeFirebase() {
  try {
    const { db: database } = await import('./firebase-config.js');
    db = database;
    firebaseLoaded = true;
    return true;
  } catch (error) {
    console.warn('Firebase failed to load:', error);
    return false;
  }
}

// Get URL parameters
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// UI State Management
function showState(stateName) {
  // Hide all states
  document.querySelectorAll('.status-item').forEach(item => {
    item.classList.remove('active');
    item.classList.add('hidden');
  });
  
  // Show target state
  const targetState = document.getElementById(stateName);
  if (targetState) {
    targetState.classList.remove('hidden');
    targetState.classList.add('active');
  }
}

// Show error state
function showError(message, details = '') {
  const errorDescription = document.getElementById('error-description');
  if (errorDescription) {
    errorDescription.textContent = details || message;
  }
  showState('error-state');
}

// Show success state
function showSuccess(title, description) {
  const successTitle = document.getElementById('success-title');
  const successDescription = document.getElementById('success-description');
  
  if (successTitle) successTitle.textContent = title;
  if (successDescription) successDescription.textContent = description;
  
  showState('success-state');
}

// Show no tether state
function showNoTether() {
  showState('no-tether-state');
}

// Redirect to display page
function redirectToDisplay(tetherId, unassigned = false) {
  const params = new URLSearchParams({ id: tetherId });
  if (unassigned) {
    params.append('unassigned', 'true');
  }
  
  // Add smooth transition
  setTimeout(() => {
    window.location.href = `display.html?${params.toString()}`;
  }, 2000);
}

// Main logic
async function initializeApp() {
  try {
    // Get Tether ID from URL
    const tetherId = getQueryParam('id');
    
    if (!tetherId) {
      showNoTether();
      return;
    }

    // Try to initialize Firebase
    const firebaseReady = await initializeFirebase();
    
    if (!firebaseReady) {
      // Fallback: assume it's a new tether if Firebase fails
      showSuccess(
        translate('new_tether'),
        translate('redirecting')
      );
      redirectToDisplay(tetherId, true);
      return;
    }

    // Check if Tether exists in Firebase
    const { ref, get } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
    const tetherRef = ref(db, `tethers/${tetherId}`);
    const snapshot = await get(tetherRef);
    
    if (snapshot.exists()) {
      // Tether exists, redirect to display page
      showSuccess(
        translate('tether_found'),
        translate('redirecting')
      );
      redirectToDisplay(tetherId);
    } else {
      // Tether doesn't exist, redirect to display page with unassigned flag
      showSuccess(
        translate('new_tether'),
        translate('redirecting')
      );
      redirectToDisplay(tetherId, true);
    }
    
  } catch (error) {
    console.error('Error checking Tether:', error);
    
    // If we have a tether ID but there's an error, still try to proceed
    const tetherId = getQueryParam('id');
    if (tetherId) {
      showSuccess(
        translate('new_tether'),
        translate('redirecting')
      );
      redirectToDisplay(tetherId, true);
    } else {
      showError(
        translate('error'),
        'Unable to connect to the Tether network. Please check your connection and try again.'
      );
    }
  }
}

// Language selector handler
function initializeLanguageSelector() {
  const languageSelector = document.getElementById('language-selector');
  
  if (!languageSelector) return;
  
  // Set current language
  currentLang = localStorage.getItem('language') || 'en';
  languageSelector.value = currentLang;
  
  // Handle language change
  languageSelector.addEventListener('change', (e) => {
    currentLang = e.target.value;
    localStorage.setItem('language', currentLang);
    
    // Update translations if i18next is available
    if (window.i18next && window.i18next.changeLanguage) {
      window.i18next.changeLanguage(currentLang);
      updatePageTranslations();
    }
  });
}

// Update page translations
function updatePageTranslations() {
  if (!window.i18next) return;
  
  document.querySelectorAll('[data-i18n]').forEach(elem => {
    const key = elem.dataset.i18n;
    if (key) {
      elem.textContent = translate(key);
    }
  });
}

// Initialize i18next with fallback
async function initializeI18n() {
  try {
    if (window.i18next) {
      const { updatePageTranslations: updateTranslations } = await import('./i18n.js');
      updatePageTranslations = updateTranslations;
      setTimeout(updatePageTranslations, 100);
    }
  } catch (error) {
    console.warn('i18n failed to load, using fallback translations');
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize language selector
  initializeLanguageSelector();
  
  // Initialize i18n
  await initializeI18n();
  
  // Wait a moment for everything to load, then start
  setTimeout(() => {
    initializeApp();
  }, 500);
});

// Add some visual polish
document.addEventListener('DOMContentLoaded', () => {
  // Add subtle entrance animation
  const heroCard = document.querySelector('.hero-card');
  if (heroCard) {
    heroCard.style.opacity = '0';
    heroCard.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      heroCard.style.transition = 'all 0.6s ease';
      heroCard.style.opacity = '1';
      heroCard.style.transform = 'translateY(0)';
    }, 100);
  }
});