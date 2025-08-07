import { db, auth } from './firebase-config.js';
import { ref, get, set, update, push, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { translate, setLanguage, updatePageTranslations } from './i18n.js';

// Global variables
let currentTetherId = null;
let currentUser = null;
let isAdmin = false;
let tetherData = null;

// Get URL parameters
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Show different states
function showState(stateName) {
  const states = ['loading-state', 'error-state', 'unassigned-state', 'assigned-state'];
  states.forEach(state => {
    document.getElementById(state).classList.add('hidden');
  });
  document.getElementById(stateName).classList.remove('hidden');
}

// Show error
function showError(message) {
  document.getElementById('error-message').textContent = message;
  showState('error-state');
}

// Authentication handling
function initializeAuth() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateAuthStatus();
    
    if (user) {
      // Check if user is admin
      const token = await user.getIdTokenResult();
      isAdmin = token.claims.admin === true;
      updateAdminControls();
    } else {
      isAdmin = false;
      updateAdminControls();
    }
  });
}

function updateAuthStatus() {
  const authInfo = document.getElementById('auth-info');
  const authButton = document.getElementById('auth-button');
  
  if (currentUser) {
    if (currentUser.isAnonymous) {
      authInfo.textContent = translate('anonymous_user');
      authButton.textContent = translate('login');
      authButton.onclick = loginWithGoogle;
    } else {
      authInfo.textContent = currentUser.email || currentUser.displayName || 'User';
      authButton.textContent = translate('logout');
      authButton.onclick = logout;
    }
  } else {
    authInfo.textContent = 'Not logged in';
    authButton.textContent = translate('login');
    authButton.onclick = loginAnonymously;
  }
  authButton.style.display = 'inline';
}

async function loginAnonymously() {
  try {
    await signInAnonymously(auth);
  } catch (error) {
    console.error('Anonymous login failed:', error);
  }
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

// Template handling for unassigned tethers
async function loadTemplateOptions() {
  try {
    const templatesRef = ref(db, 'global_templates');
    const snapshot = await get(templatesRef);
    
    if (!snapshot.exists()) {
      document.getElementById('template-options').innerHTML = 
        '<p class="text-red-600" data-i18n="no_templates">No templates available. Please contact the administrator.</p>';
      return;
    }
    
    const templates = snapshot.val();
    const container = document.getElementById('template-options');
    container.innerHTML = '';
    
    Object.entries(templates).forEach(([templateId, template]) => {
      const templateCard = document.createElement('div');
      templateCard.className = 'border rounded-lg p-4 hover:bg-gray-50 cursor-pointer';
      templateCard.onclick = () => selectTemplate(templateId, template);
      
      templateCard.innerHTML = `
        <h4 class="font-semibold text-lg">${template.name || templateId}</h4>
        <p class="text-gray-600 text-sm">${template.type || 'terra'} - ${Object.keys(template.fields || {}).length} fields</p>
        <div class="text-xs text-gray-500 mt-2">
          Fields: ${Object.keys(template.fields || {}).join(', ') || 'None'}
        </div>
      `;
      
      container.appendChild(templateCard);
    });
    
  } catch (error) {
    console.error('Error loading templates:', error);
    document.getElementById('template-options').innerHTML = 
      '<p class="text-red-600">Error loading templates.</p>';
  }
}

async function selectTemplate(templateId, template) {
  try {
    const tetherRef = ref(db, `tethers/${currentTetherId}`);
    await set(tetherRef, {
      type: template.type || 'terra',
      template: templateId,
      status: 'active',
      locked: false,
      created: Date.now(),
      createdBy: currentUser?.uid || 'anonymous'
    });
    
    // Reload the page to show assigned state
    location.reload();
  } catch (error) {
    console.error('Error assigning template:', error);
    alert('Error assigning template. Please try again.');
  }
}

// Custom template creation
function initializeCustomTemplateForm() {
  const form = document.getElementById('custom-template-form');
  const addFieldBtn = document.getElementById('add-field-btn');
  const fieldsContainer = document.getElementById('fields-container');
  
  // Add initial field
  addTemplateField();
  
  addFieldBtn.onclick = addTemplateField;
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    await saveCustomTemplate();
  };
}

function addTemplateField() {
  const fieldsContainer = document.getElementById('fields-container');
  const fieldDiv = document.createElement('div');
  fieldDiv.className = 'flex gap-2 mb-2 items-end';
  
  fieldDiv.innerHTML = `
    <div class="flex-1">
      <input type="text" placeholder="Field Name" class="form-input" required>
    </div>
    <div class="w-32">
      <select class="form-input" required>
        <option value="text" data-i18n="text">Text</option>
        <option value="number" data-i18n="number">Number</option>
        <option value="date" data-i18n="date">Date</option>
      </select>
    </div>
    <div class="w-20">
      <label class="flex items-center">
        <input type="checkbox" class="mr-1">
        <span class="text-sm" data-i18n="required">Required</span>
      </label>
    </div>
    <button type="button" class="btn-danger px-2 py-1" onclick="this.parentElement.remove()">×</button>
  `;
  
  fieldsContainer.appendChild(fieldDiv);
  updatePageTranslations();
}

async function saveCustomTemplate() {
  try {
    const templateName = document.getElementById('template-name').value;
    const templateType = document.getElementById('template-type').value;
    const fieldsContainer = document.getElementById('fields-container');
    
    const fields = {};
    const fieldDivs = fieldsContainer.querySelectorAll('div.flex');
    
    fieldDivs.forEach(fieldDiv => {
      const nameInput = fieldDiv.querySelector('input[type="text"]');
      const typeSelect = fieldDiv.querySelector('select');
      const requiredCheck = fieldDiv.querySelector('input[type="checkbox"]');
      
      if (nameInput.value.trim()) {
        fields[nameInput.value.trim()] = {
          type: typeSelect.value,
          required: requiredCheck.checked
        };
      }
    });
    
    if (Object.keys(fields).length === 0) {
      alert('Please add at least one field.');
      return;
    }
    
    const templateId = `custom_${Date.now()}`;
    const templateData = {
      name: templateName,
      type: templateType,
      fields: fields,
      created: Date.now(),
      createdBy: currentUser?.uid || 'anonymous'
    };
    
    // Save to global templates
    const templateRef = ref(db, `global_templates/${templateId}`);
    await set(templateRef, templateData);
    
    // Assign to current tether
    await selectTemplate(templateId, templateData);
    
  } catch (error) {
    console.error('Error saving custom template:', error);
    alert('Error saving template. Please try again.');
  }
}

// Assigned tether handling
async function loadAssignedTether() {
  try {
    const tetherRef = ref(db, `tethers/${currentTetherId}`);
    const snapshot = await get(tetherRef);
    
    if (!snapshot.exists()) {
      showUnassignedState();
      return;
    }
    
    tetherData = snapshot.val();
    await displayTetherInfo();
    await loadReferenceContent();
    await createLogForm();
    await loadLogHistory();
    showState('assigned-state');
    
  } catch (error) {
    console.error('Error loading tether:', error);
    showError('Error loading tether data');
  }
}

async function displayTetherInfo() {
  const tetherInfo = document.getElementById('tether-info');
  
  tetherInfo.innerHTML = `
    <div class="space-y-2">
      <div><strong>ID:</strong> <span class="font-mono">${currentTetherId}</span></div>
      <div><strong>Type:</strong> <span class="capitalize">${tetherData.type || 'terra'}</span></div>
      <div><strong>Status:</strong> <span class="capitalize ${tetherData.locked ? 'text-red-600' : 'text-green-600'}">${tetherData.locked ? 'Locked' : 'Active'}</span></div>
      <div><strong>Template:</strong> ${tetherData.template || 'None'}</div>
      <div><strong>Created:</strong> ${tetherData.created ? new Date(tetherData.created).toLocaleDateString() : 'Unknown'}</div>
    </div>
  `;
  
  // Add navigation links
  const navigationLinks = document.getElementById('navigation-links');
  if (tetherData.type === 'terra') {
    navigationLinks.innerHTML = `
      <a href="contacteditor.html?id=${currentTetherId}" class="btn-secondary inline-block" data-i18n="vendor_contacts">Vendor Contacts</a>
    `;
  } else if (tetherData.type === 'aura') {
    navigationLinks.innerHTML = `
      <a href="my_aura.html" class="btn-secondary inline-block" data-i18n="my_aura">My Aura Logs</a>
    `;
  }
  
  updatePageTranslations();
}

async function loadReferenceContent() {
  if (tetherData.type !== 'aura') return;
  
  try {
    const contentRef = ref(db, `reference_content/${currentTetherId}`);
    const snapshot = await get(contentRef);
    
    if (snapshot.exists()) {
      const content = snapshot.val();
      const container = document.getElementById('reference-content');
      
      container.innerHTML = `
        <h3 class="text-lg font-semibold mb-3" data-i18n="reference_content">Reference Content</h3>
        <div class="bg-blue-50 p-4 rounded">
          <h4 class="font-semibold">${content.title || 'No Title'}</h4>
          <p class="text-gray-600 mt-2">${content.description || 'No description'}</p>
          ${content.image ? `<img src="${content.image}" alt="Reference" class="mt-3 max-w-full h-auto rounded">` : ''}
        </div>
      `;
      
      container.classList.remove('hidden');
      updatePageTranslations();
    }
  } catch (error) {
    console.error('Error loading reference content:', error);
  }
}

async function createLogForm() {
  try {
    // Get template
    const templateRef = ref(db, `global_templates/${tetherData.template}`);
    const snapshot = await get(templateRef);
    
    if (!snapshot.exists()) {
      document.getElementById('dynamic-fields').innerHTML = 
        '<p class="text-red-600">Template not found</p>';
      return;
    }
    
    const template = snapshot.val();
    const fields = template.fields || {};
    
    const container = document.getElementById('dynamic-fields');
    container.innerHTML = '';
    
    Object.entries(fields).forEach(([fieldName, fieldConfig]) => {
      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'mb-4';
      
      const label = document.createElement('label');
      label.className = 'form-label';
      label.textContent = fieldName;
      if (fieldConfig.required) {
        label.innerHTML += ' <span class="text-red-500">*</span>';
      }
      
      let input;
      switch (fieldConfig.type) {
        case 'number':
          input = document.createElement('input');
          input.type = 'number';
          break;
        case 'date':
          input = document.createElement('input');
          input.type = 'date';
          break;
        default:
          input = document.createElement('input');
          input.type = 'text';
      }
      
      input.name = fieldName;
      input.className = 'form-input';
      input.required = fieldConfig.required;
      
      fieldDiv.appendChild(label);
      fieldDiv.appendChild(input);
      container.appendChild(fieldDiv);
    });
    
    // Handle form submission
    const form = document.getElementById('log-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      await submitLogEntry(e.target);
    };
    
    // Disable form if tether is locked
    if (tetherData.locked) {
      const formContainer = document.getElementById('log-form-container');
      formContainer.innerHTML = `
        <div class="alert-info">
          <span data-i18n="tether_locked">This Tether is locked</span>
        </div>
      `;
      updatePageTranslations();
    }
    
  } catch (error) {
    console.error('Error creating log form:', error);
  }
}

async function submitLogEntry(form) {
  try {
    if (!currentUser) {
      await loginAnonymously();
    }
    
    const formData = new FormData(form);
    const logEntry = {
      timestamp: Date.now(),
      submittedBy: currentUser?.uid || 'anonymous',
      data: {}
    };
    
    formData.forEach((value, key) => {
      logEntry.data[key] = value;
    });
    
    // Save to appropriate location
    let logRef;
    if (tetherData.type === 'aura') {
      logRef = ref(db, `users/${currentUser.uid}/logs/${currentTetherId}/entries`);
    } else {
      logRef = ref(db, `shared_logs/${currentTetherId}/entries`);
    }
    
    await push(logRef, logEntry);
    
    // Clear form and reload log history
    form.reset();
    await loadLogHistory();
    
    // Show success message
    const successDiv = document.createElement('div');
    successDiv.className = 'alert-success';
    successDiv.innerHTML = '<span data-i18n="save_success">Saved successfully</span>';
    form.parentNode.insertBefore(successDiv, form);
    
    setTimeout(() => {
      successDiv.remove();
    }, 3000);
    
    updatePageTranslations();
    
  } catch (error) {
    console.error('Error submitting log entry:', error);
    alert('Error submitting log entry. Please try again.');
  }
}

async function loadLogHistory() {
  try {
    let logRef;
    if (tetherData.type === 'aura' && currentUser) {
      logRef = ref(db, `users/${currentUser.uid}/logs/${currentTetherId}/entries`);
    } else {
      logRef = ref(db, `shared_logs/${currentTetherId}/entries`);
    }
    
    const snapshot = await get(logRef);
    const container = document.getElementById('log-history');
    
    if (!snapshot.exists()) {
      container.innerHTML = '<p class="text-gray-600" data-i18n="no_logs">No logs available</p>';
      updatePageTranslations();
      return;
    }
    
    const logs = snapshot.val();
    const logEntries = Object.entries(logs)
      .map(([id, log]) => ({ id, ...log }))
      .sort((a, b) => b.timestamp - a.timestamp);
    
    const table = document.createElement('table');
    table.className = 'log-table w-full';
    
    // Create header
    const headerRow = table.insertRow();
    headerRow.innerHTML = '<th>Date</th><th>User</th><th>Data</th>';
    
    // Add log entries
    logEntries.forEach(log => {
      const row = table.insertRow();
      const date = new Date(log.timestamp).toLocaleString();
      const user = log.submittedBy === 'anonymous' ? 'Anonymous' : (log.submittedBy || 'Unknown');
      const data = JSON.stringify(log.data, null, 2);
      
      row.innerHTML = `
        <td>${date}</td>
        <td>${user}</td>
        <td><pre class="text-xs overflow-x-auto">${data}</pre></td>
      `;
    });
    
    container.innerHTML = '';
    container.appendChild(table);
    
  } catch (error) {
    console.error('Error loading log history:', error);
    document.getElementById('log-history').innerHTML = 
      '<p class="text-red-600">Error loading log history</p>';
  }
}

// Admin controls
function updateAdminControls() {
  const adminControls = document.getElementById('admin-controls');
  if (isAdmin && tetherData) {
    adminControls.classList.remove('hidden');
    
    const lockBtn = document.getElementById('lock-toggle-btn');
    lockBtn.textContent = tetherData.locked ? translate('unlock_tether') : translate('lock_tether');
    lockBtn.onclick = toggleTetherLock;
    
    document.getElementById('reset-tether-btn').onclick = resetTether;
  } else {
    adminControls.classList.add('hidden');
  }
}

async function toggleTetherLock() {
  if (!confirm(tetherData.locked ? 'Unlock this Tether?' : 'Lock this Tether?')) {
    return;
  }
  
  try {
    const tetherRef = ref(db, `tethers/${currentTetherId}/locked`);
    await set(tetherRef, !tetherData.locked);
    location.reload();
  } catch (error) {
    console.error('Error toggling lock:', error);
    alert('Error updating Tether lock status');
  }
}

async function resetTether() {
  if (!confirm(translate('confirm_reset'))) {
    return;
  }
  
  try {
    // Remove from all locations
    await Promise.all([
      remove(ref(db, `tethers/${currentTetherId}`)),
      remove(ref(db, `shared_logs/${currentTetherId}`)),
      remove(ref(db, `reference_content/${currentTetherId}`)),
      // Note: User logs are not removed as they're personal
    ]);
    
    location.reload();
  } catch (error) {
    console.error('Error resetting tether:', error);
    alert('Error resetting Tether');
  }
}

// State management
function showUnassignedState() {
  showState('unassigned-state');
  document.getElementById('tether-id-display').textContent = currentTetherId;
  loadTemplateOptions();
  initializeCustomTemplateForm();
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

// Main initialization
async function initializeApp() {
  // Get Tether ID from URL
  currentTetherId = getQueryParam('id');
  
  if (!currentTetherId) {
    showError(translate('no_tether_id'));
    return;
  }
  
  const isUnassigned = getQueryParam('unassigned') === 'true';
  
  if (isUnassigned) {
    showUnassignedState();
  } else {
    await loadAssignedTether();
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeLanguageSelector();
  initializeAuth();
  updatePageTranslations();
  
  // Wait a moment for i18next to initialize
  setTimeout(() => {
    initializeApp();
  }, 100);
});