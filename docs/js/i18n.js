// Import i18next from CDN
const i18next = window.i18next;

// Initialize i18next with translations
i18next.init({
  lng: localStorage.getItem('language') || 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        welcome: "Welcome to Tether",
        error: "An error occurred",
        no_tether_id: "No Tether ID provided",
        tether_not_found: "Tether not found",
        tether_display: "Tether Display",
        select_template: "Select Template",
        custom_template: "Create Custom Template",
        add_field: "Add Field",
        save_template: "Save Template",
        submit_log: "Submit Log",
        reset_tether: "Reset this Tether",
        lock_tether: "Lock Tether",
        unlock_tether: "Unlock Tether",
        confirm_reset: "Are you sure you want to reset this Tether?",
        confirm_delete: "Are you sure you want to delete this?",
        vendor_contacts: "Vendor Contacts",
        my_aura: "My Aura Logs",
        template_creator: "Template Creator",
        admin_dashboard: "Admin Dashboard",
        create_template: "Create Template",
        edit_database: "Edit Database",
        manage_aura: "Manage Aura Tethers",
        back_to_admin: "Back to Admin",
        template_name: "Template Name",
        field_name: "Field Name",
        text: "Text",
        number: "Number",
        date: "Date",
        required: "Required",
        delete: "Delete",
        contact_editor: "Vendor Contact Editor",
        add_contact: "Add Contact",
        save_contact: "Save Contact",
        my_aura_dashboard: "My Aura Dashboard",
        aura_studio: "Aura Studio",
        upload_content: "Upload Content",
        activate_tether: "Activate Tether",
        deactivate_tether: "Deactivate Tether",
        no_logs: "No logs available",
        loading: "Loading...",
        language: "Language",
        login: "Login",
        logout: "Logout",
        anonymous_user: "Anonymous User",
        admin_only: "Admin access required",
        authentication_required: "Authentication required",
        tether_locked: "This Tether is locked",
        form_validation_error: "Please check all required fields",
        save_success: "Saved successfully",
        save_error: "Error saving data",
        terra_tether: "Terra Tether",
        aura_tether: "Aura Tether",
        shared_log: "Shared Log",
        personal_log: "Personal Log",
        reference_content: "Reference Content",
        static_info: "Static Information"
      }
    },
    es: {
      translation: {
        welcome: "Bienvenido a Tether",
        error: "Se produjo un error",
        no_tether_id: "No se proporcionó ID de Tether",
        tether_not_found: "Tether no encontrado",
        tether_display: "Mostrar Tether",
        select_template: "Seleccionar Plantilla",
        custom_template: "Crear Plantilla Personalizada",
        // Add more Spanish translations as needed
        loading: "Cargando...",
        language: "Idioma"
      }
    },
    fr: {
      translation: {
        welcome: "Bienvenue à Tether",
        error: "Une erreur s'est produite",
        no_tether_id: "Aucun ID Tether fourni",
        tether_not_found: "Tether non trouvé",
        // Add more French translations as needed
        loading: "Chargement...",
        language: "Langue"
      }
    },
    af: {
      translation: {
        welcome: "Welkom by Tether",
        error: "Fout het voorgekom",
        // Add more Afrikaans translations as needed
        loading: "Laai...",
        language: "Taal"
      }
    },
    ru: {
      translation: {
        welcome: "Добро пожаловать в Tether",
        error: "Произошла ошибка",
        // Add more Russian translations as needed
        loading: "Загрузка...",
        language: "Язык"
      }
    },
    hi: {
      translation: {
        welcome: "टेदर में आपका स्वागत है",
        error: "एक त्रुटि हुई",
        // Add more Hindi translations as needed
        loading: "लोड हो रहा है...",
        language: "भाषा"
      }
    }
  }
});

export function translate(key, options = {}) {
  return i18next.t(key, options);
}

export function setLanguage(lng) {
  i18next.changeLanguage(lng);
  localStorage.setItem('language', lng);
  updatePageTranslations();
}

export function updatePageTranslations() {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(elem => {
    const key = elem.dataset.i18n;
    if (key) {
      if (elem.tagName === 'INPUT' || elem.tagName === 'TEXTAREA') {
        if (elem.type === 'text' || elem.type === 'email' || elem.type === 'password' || elem.tagName === 'TEXTAREA') {
          elem.placeholder = translate(key);
        } else {
          elem.value = translate(key);
        }
      } else {
        elem.textContent = translate(key);
      }
    }
  });
  
  // Update elements with data-i18n-title attribute (for tooltips)
  document.querySelectorAll('[data-i18n-title]').forEach(elem => {
    const key = elem.dataset.i18nTitle;
    if (key) {
      elem.title = translate(key);
    }
  });
}

export function getCurrentLanguage() {
  return i18next.language;
}

export function getSupportedLanguages() {
  return [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'af', name: 'Afrikaans' },
    { code: 'ru', name: 'Русский' },
    { code: 'hi', name: 'हिन्दी' }
  ];
}

// Initialize translations when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  updatePageTranslations();
});