import { db, auth } from './firebase-config.js';
import { ref, get, set, remove, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
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
    loadExistingTemplates();
  } else {
    accessDenied.classList.remove('hidden');
    loadingState.classList.add('hidden');
    mainContent.classList.add('hidden');
  }
}

// Template field management
function addTemplateField() {
  const fieldsContainer = document.getElementById('fields-container');
  const fieldDiv = document.createElement('div');
  fieldDiv.className = 'grid grid-cols-1 md:grid-cols-5 gap-3 items-end p-4 border rounded-lg bg-gray-50';
  
  fieldDiv.innerHTML = `
    <div>
      <label class="form-label text-sm" data-i18n="field_name">Field Name</label>
      <input type="text" class="form-input field-name" required>
    </div>
    <div>
      <label class="form-label text-sm">Field Type</label>
      <select class="form-input field-type" required>
        <option value="text" data-i18n="text">Text</option>
        <option value="number" data-i18n="number">Number</option>
        <option value="date" data-i18n="date">Date</option>
        <option value="email">Email</option>
        <option value="url">URL</option>
        <option value="textarea">Long Text</option>
      </select>
    </div>
    <div>
      <label class="form-label text-sm">Placeholder</label>
      <input type="text" class="form-input field-placeholder" placeholder="Optional">
    </div>
    <div>
      <label class="flex items-center text-sm">
        <input type="checkbox" class="field-required mr-2">
        <span data-i18n="required">Required</span>
      </label>
    </div>
    <div>
      <button type="button" class="btn-danger w-full" onclick="removeField(this)">
        <span data-i18n="delete">Delete</span>
      </button>
    </div>
  `;
  
  fieldsContainer.appendChild(fieldDiv);
  updatePageTranslations();
}

function removeField(button) {
  button.closest('div.grid').remove();
}

// Make removeField globally available
window.removeField = removeField;

// Template management
function initializeTemplateForm() {
  const form = document.getElementById('template-form');
  const addFieldBtn = document.getElementById('add-field-btn');
  const resetBtn = document.getElementById('reset-form-btn');
  
  // Add initial field
  addTemplateField();
  
  addFieldBtn.onclick = addTemplateField;
  resetBtn.onclick = resetForm;
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    await saveTemplate();
  };
}

function resetForm() {
  document.getElementById('template-form').reset();
  document.getElementById('fields-container').innerHTML = '';
  addTemplateField();
}

async function saveTemplate() {
  try {
    const templateName = document.getElementById('template-name').value.trim();
    const templateType = document.getElementById('template-type').value;
    const templateDescription = document.getElementById('template-description').value.trim();
    
    if (!templateName) {
      alert('Please enter a template name');
      return;
    }
    
    // Validate template name (alphanumeric and spaces only)
    if (!/^[a-zA-Z0-9\s]+$/.test(templateName)) {
      alert('Template name can only contain letters, numbers, and spaces');
      return;
    }
    
    // Collect fields
    const fieldsContainer = document.getElementById('fields-container');
    const fieldRows = fieldsContainer.querySelectorAll('div.grid');
    const fields = {};
    
    for (const fieldRow of fieldRows) {
      const nameInput = fieldRow.querySelector('.field-name');
      const typeSelect = fieldRow.querySelector('.field-type');
      const placeholderInput = fieldRow.querySelector('.field-placeholder');
      const requiredCheck = fieldRow.querySelector('.field-required');
      
      const fieldName = nameInput.value.trim();
      if (!fieldName) {
        alert('Please fill in all field names');
        return;
      }
      
      // Validate field name
      if (!/^[a-zA-Z0-9_\s]+$/.test(fieldName)) {
        alert('Field names can only contain letters, numbers, underscores, and spaces');
        return;
      }
      
      fields[fieldName] = {
        type: typeSelect.value,
        placeholder: placeholderInput.value.trim(),
        required: requiredCheck.checked
      };
    }
    
    if (Object.keys(fields).length === 0) {
      alert('Please add at least one field');
      return;
    }
    
    // Create template ID
    const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const templateData = {
      name: templateName,
      type: templateType,
      description: templateDescription,
      fields: fields,
      created: Date.now(),
      createdBy: currentUser?.uid || 'unknown',
      createdByEmail: currentUser?.email || 'unknown'
    };
    
    // Save to Firebase
    const templateRef = ref(db, `global_templates/${templateId}`);
    await set(templateRef, templateData);
    
    // Show success message
    showSuccessMessage('Template saved successfully!');
    
    // Reset form and reload templates
    resetForm();
    await loadExistingTemplates();
    
  } catch (error) {
    console.error('Error saving template:', error);
    alert('Error saving template. Please try again.');
  }
}

function showSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'alert-success mb-4';
  successDiv.textContent = message;
  
  const form = document.getElementById('template-form');
  form.parentNode.insertBefore(successDiv, form);
  
  setTimeout(() => {
    successDiv.remove();
  }, 5000);
}

// Load and display existing templates
async function loadExistingTemplates() {
  try {
    const templatesRef = ref(db, 'global_templates');
    const snapshot = await get(templatesRef);
    const container = document.getElementById('templates-list');
    
    if (!snapshot.exists()) {
      container.innerHTML = '<p class="text-gray-600">No templates found.</p>';
      return;
    }
    
    const templates = snapshot.val();
    const templateEntries = Object.entries(templates)
      .sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
    
    container.innerHTML = '';
    
    templateEntries.forEach(([templateId, template]) => {
      const templateCard = document.createElement('div');
      templateCard.className = 'border rounded-lg p-4 mb-4 bg-white hover:shadow-md transition-shadow';
      
      const fieldsCount = Object.keys(template.fields || {}).length;
      const createdDate = template.created ? new Date(template.created).toLocaleDateString() : 'Unknown';
      
      templateCard.innerHTML = `
        <div class="flex justify-between items-start mb-3">
          <div>
            <h3 class="text-lg font-semibold">${template.name}</h3>
            <div class="text-sm text-gray-600 space-x-4">
              <span class="capitalize">${template.type || 'terra'}</span>
              <span>${fieldsCount} fields</span>
              <span>Created: ${createdDate}</span>
            </div>
          </div>
          <button class="btn-danger text-sm" onclick="deleteTemplate('${templateId}', '${template.name}')">
            <span data-i18n="delete">Delete</span>
          </button>
        </div>
        
        ${template.description ? `<p class="text-gray-700 mb-3">${template.description}</p>` : ''}
        
        <div class="bg-gray-50 rounded p-3">
          <h4 class="font-semibold text-sm mb-2">Fields:</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            ${Object.entries(template.fields || {}).map(([fieldName, fieldConfig]) => `
              <div class="flex justify-between">
                <span class="font-medium">${fieldName}</span>
                <span class="text-gray-600">${fieldConfig.type}${fieldConfig.required ? ' *' : ''}</span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="text-xs text-gray-500 mt-3">
          Created by: ${template.createdByEmail || 'Unknown'} | ID: ${templateId}
        </div>
      `;
      
      container.appendChild(templateCard);
    });
    
    updatePageTranslations();
    
  } catch (error) {
    console.error('Error loading templates:', error);
    document.getElementById('templates-list').innerHTML = 
      '<p class="text-red-600">Error loading templates.</p>';
  }
}

// Delete template
async function deleteTemplate(templateId, templateName) {
  if (!confirm(translate('confirm_delete') + ' "' + templateName + '"?')) {
    return;
  }
  
  try {
    const templateRef = ref(db, `global_templates/${templateId}`);
    await remove(templateRef);
    
    showSuccessMessage('Template deleted successfully!');
    await loadExistingTemplates();
    
  } catch (error) {
    console.error('Error deleting template:', error);
    alert('Error deleting template. Please try again.');
  }
}

// Make deleteTemplate globally available
window.deleteTemplate = deleteTemplate;

// Language selector
function initializeLanguageSelector() {
  const languageSelector = document.getElementById('language-selector');
  const currentLang = localStorage.getItem('language') || 'en';
  languageSelector.value = currentLang;
  
  languageSelector.addEventListener('change', (e) => {
    setLanguage(e.target.value);
  });
}

// Initialize login button in access denied state
function initializeLoginButton() {
  document.getElementById('login-btn').onclick = loginWithGoogle;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeLanguageSelector();
  initializeAuth();
  initializeTemplateForm();
  initializeLoginButton();
  updatePageTranslations();
});