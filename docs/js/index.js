// Simple, self-contained index page logic
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

// Simple translation function
function translate(key) {
  return translations[currentLang][key] || key;
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

// Main logic - simplified to work without Firebase dependencies
async function initializeApp() {
  try {
    // Get Tether ID from URL
    const tetherId = getQueryParam('id');
    
    if (!tetherId) {
      showNoTether();
      return;
    }

    // Show success and redirect (we'll let display.html handle the actual Firebase checks)
    showSuccess(
      translate('tether_found'),
      translate('redirecting')
    );
    redirectToDisplay(tetherId);
    
  } catch (error) {
    console.error('Error:', error);
    
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
    
    // Update translations
    updatePageTranslations();
  });
}

// Update page translations
function updatePageTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(elem => {
    const key = elem.dataset.i18n;
    if (key) {
      elem.textContent = translate(key);
    }
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize language selector
  initializeLanguageSelector();
  
  // Add entrance animation
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
  
  // Start the app
  setTimeout(() => {
    initializeApp();
  }, 500);
});