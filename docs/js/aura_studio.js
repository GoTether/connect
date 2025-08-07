import { db, auth } from './firebase-config.js';
import { ref, get, set, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { translate, setLanguage, updatePageTranslations } from './i18n.js';

// Global variables
let currentUser = null;
let isAdmin = false;

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
    loadAuraStudioData();
  } else {
    accessDenied.classList.remove('hidden');
    loadingState.classList.add('hidden');
    mainContent.classList.add('hidden');
  }
}

// Load Aura Studio data
async function loadAuraStudioData() {
  try {
    await Promise.all([
      loadAuraTethersOverview(),
      loadReferenceContentLibrary()
    ]);
  } catch (error) {
    console.error('Error loading Aura Studio data:', error);
  }
}

async function loadAuraTethersOverview() {
  try {
    const tethersRef = ref(db, 'tethers');
    const snapshot = await get(tethersRef);
    const container = document.getElementById('aura-tethers-overview');
    
    if (!snapshot.exists()) {
      container.innerHTML = '<p class="text-gray-600">No Tethers found</p>';
      return;
    }
    
    const tethers = snapshot.val();
    const auraTethers = Object.entries(tethers)
      .filter(([id, tether]) => tether.type === 'aura')
      .sort(([,a], [,b]) => (b.created || 0) - (a.created || 0));
    
    if (auraTethers.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8">
          <div class="text-4xl mb-4">✨</div>
          <h4 class="text-lg font-semibold mb-2">No Aura Tethers Found</h4>
          <p class="text-gray-600 mb-4">Create some Aura Tethers to get started</p>
          <a href="display.html?id=aura_demo&unassigned=true" class="btn-primary">Create Demo Aura Tether</a>
        </div>
      `;
      return;
    }
    
    // Get reference content for each Aura tether
    const referencePromises = auraTethers.map(async ([tetherId, tether]) => {
      try {
        const contentRef = ref(db, `reference_content/${tetherId}`);
        const contentSnapshot = await get(contentRef);
        return {
          id: tetherId,
          tether,
          referenceContent: contentSnapshot.exists() ? contentSnapshot.val() : null
        };
      } catch (error) {
        return {
          id: tetherId,
          tether,
          referenceContent: null
        };
      }
    });
    
    const auraData = await Promise.all(referencePromises);
    
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${auraData.map(({ id, tether, referenceContent }) => {
          const createdDate = tether.created ? new Date(tether.created).toLocaleDateString() : 'Unknown';
          const statusColor = tether.locked ? 'text-red-600' : 'text-green-600';
          const statusText = tether.locked ? 'Locked' : 'Active';
          
          return `
            <div class="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
              <div class="flex justify-between items-start mb-3">
                <div>
                  <h4 class="font-semibold text-sm">${id}</h4>
                  <span class="text-xs ${statusColor}">${statusText}</span>
                </div>
                <div class="space-x-1">
                  <button onclick="editReferenceContent('${id}')" class="text-blue-600 hover:text-blue-800 text-xs">Edit</button>
                  <a href="display.html?id=${id}" class="text-green-600 hover:text-green-800 text-xs">View</a>
                </div>
              </div>
              
              ${referenceContent ? `
                <div class="bg-purple-50 p-3 rounded text-xs mb-3">
                  <h5 class="font-semibold">${referenceContent.title || 'No Title'}</h5>
                  ${referenceContent.description ? `<p class="text-gray-600 mt-1">${referenceContent.description.substring(0, 100)}${referenceContent.description.length > 100 ? '...' : ''}</p>` : ''}
                </div>
              ` : `
                <div class="bg-gray-50 p-3 rounded text-xs mb-3">
                  <p class="text-gray-600">No reference content</p>
                </div>
              `}
              
              <div class="text-xs text-gray-500">
                Created: ${createdDate}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading Aura tethers overview:', error);
    document.getElementById('aura-tethers-overview').innerHTML = 
      '<p class="text-red-600">Error loading Aura Tethers</p>';
  }
}

async function loadReferenceContentLibrary() {
  try {
    const contentRef = ref(db, 'reference_content');
    const snapshot = await get(contentRef);
    const container = document.getElementById('reference-content-library');
    
    if (!snapshot.exists()) {
      container.innerHTML = '<p class="text-gray-600">No reference content found</p>';
      return;
    }
    
    const content = snapshot.val();
    const contentEntries = Object.entries(content);
    
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${contentEntries.map(([tetherId, contentData]) => `
          <div class="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start mb-3">
              <div>
                <h4 class="font-semibold">${contentData.title || 'Untitled'}</h4>
                <span class="text-xs text-gray-500">Tether: ${tetherId}</span>
              </div>
              <button onclick="editReferenceContent('${tetherId}')" class="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
            </div>
            
            ${contentData.description ? `<p class="text-sm text-gray-600 mb-3">${contentData.description.substring(0, 150)}${contentData.description.length > 150 ? '...' : ''}</p>` : ''}
            
            ${contentData.image ? `
              <div class="mb-3">
                <img src="${contentData.image}" alt="Reference content" class="w-full h-32 object-cover rounded">
              </div>
            ` : ''}
            
            <div class="flex justify-between items-center text-xs text-gray-500">
              <span>Last updated: ${contentData.updated ? new Date(contentData.updated).toLocaleDateString() : 'Unknown'}</span>
              <a href="display.html?id=${tetherId}" class="text-blue-600 hover:text-blue-800">View Tether</a>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
  } catch (error) {
    console.error('Error loading reference content library:', error);
    document.getElementById('reference-content-library').innerHTML = 
      '<p class="text-red-600">Error loading reference content</p>';
  }
}

// Modal functions
function showUploadModal() {
  document.getElementById('upload-modal').classList.remove('hidden');
}

function hideUploadModal() {
  document.getElementById('upload-modal').classList.add('hidden');
  document.getElementById('upload-form').reset();
}

function showManageModal() {
  document.getElementById('manage-modal').classList.remove('hidden');
}

function hideManageModal() {
  document.getElementById('manage-modal').classList.add('hidden');
}

function showAnalyticsModal() {
  document.getElementById('analytics-modal').classList.remove('hidden');
}

function hideAnalyticsModal() {
  document.getElementById('analytics-modal').classList.add('hidden');
}

// Make modal functions globally available
window.showUploadModal = showUploadModal;
window.hideUploadModal = hideUploadModal;
window.showManageModal = showManageModal;
window.hideManageModal = hideManageModal;
window.showAnalyticsModal = showAnalyticsModal;
window.hideAnalyticsModal = hideAnalyticsModal;

// Upload content functionality
function initializeUploadForm() {
  const form = document.getElementById('upload-form');
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    await uploadReferenceContent();
  };
}

async function uploadReferenceContent() {
  try {
    const tetherId = document.getElementById('upload-tether-id').value.trim();
    const title = document.getElementById('upload-title').value.trim();
    const description = document.getElementById('upload-description').value.trim();
    const image = document.getElementById('upload-image').value.trim();
    
    if (!tetherId || !title) {
      alert('Please fill in required fields (Tether ID and Title)');
      return;
    }
    
    // Verify tether exists and is an Aura tether
    const tetherRef = ref(db, `tethers/${tetherId}`);
    const tetherSnapshot = await get(tetherRef);
    
    if (!tetherSnapshot.exists()) {
      alert('Tether not found. Please check the Tether ID.');
      return;
    }
    
    const tetherData = tetherSnapshot.val();
    if (tetherData.type !== 'aura') {
      alert('Reference content can only be uploaded to Aura Tethers.');
      return;
    }
    
    const contentData = {
      title,
      description,
      image: image || null,
      updated: Date.now(),
      updatedBy: currentUser?.uid || 'unknown'
    };
    
    // Save reference content
    const contentRef = ref(db, `reference_content/${tetherId}`);
    await set(contentRef, contentData);
    
    hideUploadModal();
    showSuccessMessage('Reference content uploaded successfully!');
    
    // Reload the data
    await loadAuraStudioData();
    
  } catch (error) {
    console.error('Error uploading reference content:', error);
    alert('Error uploading content. Please try again.');
  }
}

// Edit reference content
async function editReferenceContent(tetherId) {
  try {
    // Load existing content
    const contentRef = ref(db, `reference_content/${tetherId}`);
    const snapshot = await get(contentRef);
    
    const existingContent = snapshot.exists() ? snapshot.val() : {};
    
    // Populate form with existing data
    document.getElementById('upload-tether-id').value = tetherId;
    document.getElementById('upload-title').value = existingContent.title || '';
    document.getElementById('upload-description').value = existingContent.description || '';
    document.getElementById('upload-image').value = existingContent.image || '';
    
    // Make tether ID field readonly when editing
    document.getElementById('upload-tether-id').readOnly = true;
    
    showUploadModal();
    
  } catch (error) {
    console.error('Error loading reference content for editing:', error);
    alert('Error loading content for editing');
  }
}

// Make editReferenceContent globally available
window.editReferenceContent = editReferenceContent;

// Override hideUploadModal to reset readonly state
const originalHideUploadModal = hideUploadModal;
window.hideUploadModal = function() {
  document.getElementById('upload-tether-id').readOnly = false;
  originalHideUploadModal();
};

// Utility functions
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
  initializeUploadForm();
  initializeLoginButton();
  updatePageTranslations();
});