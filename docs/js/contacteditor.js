import { db, auth } from './firebase-config.js';
import { ref, get, set, push, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { translate, setLanguage, updatePageTranslations } from './i18n.js';

// Global variables
let currentUser = null;
let currentTetherId = null;
let editingContactId = null;

// Get URL parameters
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Show different states
function showState(stateName) {
  const states = ['loading-state', 'error-state', 'main-content'];
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

// Go back functionality
function goBack() {
  if (currentTetherId) {
    window.location.href = `display.html?id=${currentTetherId}`;
  } else {
    window.history.back();
  }
}

// Make goBack globally available
window.goBack = goBack;

// Authentication handling
function initializeAuth() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateAuthStatus();
    
    if (!user) {
      // Auto-login anonymously for contact editing
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error('Anonymous login failed:', error);
      }
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

// Tether verification and setup
async function initializeTether() {
  currentTetherId = getQueryParam('id');
  
  if (!currentTetherId) {
    showError('No Tether ID provided in URL');
    return;
  }
  
  try {
    // Verify tether exists and get info
    const tetherRef = ref(db, `tethers/${currentTetherId}`);
    const snapshot = await get(tetherRef);
    
    if (!snapshot.exists()) {
      showError('Tether not found');
      return;
    }
    
    const tetherData = snapshot.val();
    
    // Update UI with tether info
    document.getElementById('tether-id').textContent = currentTetherId;
    document.getElementById('tether-type').textContent = tetherData.type || 'terra';
    
    // Load existing contacts
    await loadContacts();
    showState('main-content');
    
  } catch (error) {
    console.error('Error loading tether:', error);
    showError('Error loading tether data');
  }
}

// Contact management
function initializeContactForm() {
  const form = document.getElementById('contact-form');
  const clearBtn = document.getElementById('clear-form-btn');
  
  form.onsubmit = async (e) => {
    e.preventDefault();
    await saveContact();
  };
  
  clearBtn.onclick = clearForm;
}

function clearForm() {
  document.getElementById('contact-form').reset();
}

async function saveContact() {
  try {
    const contactData = {
      type: document.getElementById('contact-type').value,
      name: document.getElementById('contact-name').value.trim(),
      phone: document.getElementById('contact-phone').value.trim(),
      email: document.getElementById('contact-email').value.trim(),
      website: document.getElementById('contact-website').value.trim(),
      address: document.getElementById('contact-address').value.trim(),
      notes: document.getElementById('contact-notes').value.trim(),
      created: Date.now(),
      createdBy: currentUser?.uid || 'anonymous'
    };
    
    // Validate required fields
    if (!contactData.type || !contactData.name) {
      alert('Please fill in all required fields (Type and Name)');
      return;
    }
    
    // Validate email format if provided
    if (contactData.email && !isValidEmail(contactData.email)) {
      alert('Please enter a valid email address');
      return;
    }
    
    // Save to Firebase
    const contactsRef = ref(db, `vendor_contacts/${currentTetherId}`);
    await push(contactsRef, contactData);
    
    // Clear form and reload contacts
    clearForm();
    await loadContacts();
    showSuccessMessage('Contact saved successfully!');
    
  } catch (error) {
    console.error('Error saving contact:', error);
    alert('Error saving contact. Please try again.');
  }
}

async function loadContacts() {
  try {
    const contactsRef = ref(db, `vendor_contacts/${currentTetherId}`);
    const snapshot = await get(contactsRef);
    const container = document.getElementById('contacts-list');
    
    if (!snapshot.exists()) {
      container.innerHTML = '<p class="text-gray-600" data-i18n="no_contacts">No contacts found</p>';
      updatePageTranslations();
      return;
    }
    
    const contacts = snapshot.val();
    const contactEntries = Object.entries(contacts)
      .sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
    
    container.innerHTML = contactEntries.map(([contactId, contact]) => {
      const createdDate = contact.created ? new Date(contact.created).toLocaleDateString() : 'Unknown';
      
      return `
        <div class="border rounded-lg p-4 mb-4 bg-white hover:shadow-md transition-shadow">
          <div class="flex justify-between items-start mb-3">
            <div>
              <h4 class="text-lg font-semibold">${contact.name}</h4>
              <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded capitalize">${contact.type}</span>
            </div>
            <div class="space-x-2">
              <button onclick="editContact('${contactId}', ${JSON.stringify(contact).replace(/"/g, '&quot;')})" class="btn-secondary text-sm">Edit</button>
              <button onclick="deleteContact('${contactId}', '${contact.name}')" class="btn-danger text-sm">Delete</button>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            ${contact.phone ? `<div><strong>Phone:</strong> <a href="tel:${contact.phone}" class="text-blue-600">${contact.phone}</a></div>` : ''}
            ${contact.email ? `<div><strong>Email:</strong> <a href="mailto:${contact.email}" class="text-blue-600">${contact.email}</a></div>` : ''}
            ${contact.website ? `<div><strong>Website:</strong> <a href="${contact.website}" target="_blank" class="text-blue-600">${contact.website}</a></div>` : ''}
            ${contact.address ? `<div class="md:col-span-2"><strong>Address:</strong> ${contact.address}</div>` : ''}
          </div>
          
          ${contact.notes ? `<div class="mt-3 p-3 bg-gray-50 rounded"><strong>Notes:</strong> ${contact.notes}</div>` : ''}
          
          <div class="text-xs text-gray-500 mt-3">
            Created: ${createdDate}
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading contacts:', error);
    document.getElementById('contacts-list').innerHTML = 
      '<p class="text-red-600">Error loading contacts</p>';
  }
}

// Edit contact functionality
function editContact(contactId, contactData) {
  editingContactId = contactId;
  
  // Populate edit form
  document.getElementById('edit-contact-id').value = contactId;
  document.getElementById('edit-contact-type').value = contactData.type || '';
  document.getElementById('edit-contact-name').value = contactData.name || '';
  document.getElementById('edit-contact-phone').value = contactData.phone || '';
  document.getElementById('edit-contact-email').value = contactData.email || '';
  document.getElementById('edit-contact-website').value = contactData.website || '';
  document.getElementById('edit-contact-address').value = contactData.address || '';
  document.getElementById('edit-contact-notes').value = contactData.notes || '';
  
  // Show modal
  document.getElementById('edit-modal').classList.remove('hidden');
}

function hideEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  editingContactId = null;
}

// Make functions globally available
window.editContact = editContact;
window.hideEditModal = hideEditModal;

function initializeEditForm() {
  const editForm = document.getElementById('edit-form');
  
  editForm.onsubmit = async (e) => {
    e.preventDefault();
    await updateContact();
  };
}

async function updateContact() {
  try {
    const contactData = {
      type: document.getElementById('edit-contact-type').value,
      name: document.getElementById('edit-contact-name').value.trim(),
      phone: document.getElementById('edit-contact-phone').value.trim(),
      email: document.getElementById('edit-contact-email').value.trim(),
      website: document.getElementById('edit-contact-website').value.trim(),
      address: document.getElementById('edit-contact-address').value.trim(),
      notes: document.getElementById('edit-contact-notes').value.trim(),
      updated: Date.now(),
      updatedBy: currentUser?.uid || 'anonymous'
    };
    
    // Validate required fields
    if (!contactData.type || !contactData.name) {
      alert('Please fill in all required fields (Type and Name)');
      return;
    }
    
    // Validate email format if provided
    if (contactData.email && !isValidEmail(contactData.email)) {
      alert('Please enter a valid email address');
      return;
    }
    
    // Preserve original creation info
    const contactRef = ref(db, `vendor_contacts/${currentTetherId}/${editingContactId}`);
    const snapshot = await get(contactRef);
    if (snapshot.exists()) {
      const originalData = snapshot.val();
      contactData.created = originalData.created;
      contactData.createdBy = originalData.createdBy;
    }
    
    // Update in Firebase
    await set(contactRef, contactData);
    
    // Hide modal and reload contacts
    hideEditModal();
    await loadContacts();
    showSuccessMessage('Contact updated successfully!');
    
  } catch (error) {
    console.error('Error updating contact:', error);
    alert('Error updating contact. Please try again.');
  }
}

// Delete contact functionality
async function deleteContact(contactId, contactName) {
  if (!confirm(`Are you sure you want to delete the contact "${contactName}"?`)) {
    return;
  }
  
  try {
    const contactRef = ref(db, `vendor_contacts/${currentTetherId}/${contactId}`);
    await remove(contactRef);
    
    await loadContacts();
    showSuccessMessage('Contact deleted successfully!');
    
  } catch (error) {
    console.error('Error deleting contact:', error);
    alert('Error deleting contact. Please try again.');
  }
}

// Make deleteContact globally available
window.deleteContact = deleteContact;

// Utility functions
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeLanguageSelector();
  initializeAuth();
  initializeContactForm();
  initializeEditForm();
  updatePageTranslations();
  
  // Wait a moment for auth to initialize
  setTimeout(() => {
    initializeTether();
  }, 500);
});