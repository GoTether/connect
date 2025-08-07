# Tether System

A comprehensive web-based Tether system that connects physical QR/NFC tags to dynamic web logs using Firebase. Each Tether has a unique ID embedded in a URL that supports two types of interactions: Terra (shared logs) and Aura (personal logs).

## 🌟 Features

### Core Functionality
- **Terra Tethers**: Shared logs accessible to all users with admin lock/unlock functionality
- **Aura Tethers**: Personal logs tied to authenticated users with static reference content
- **Template System**: Dynamic form generation based on customizable templates
- **Admin Controls**: Complete management interface with analytics and database tools
- **Multilingual Support**: Built-in i18n support for 6 languages (English, Spanish, French, Afrikaans, Russian, Hindi)
- **Responsive Design**: Mobile-first design using Tailwind CSS

### Authentication
- **Anonymous Access**: For quick Aura log submissions
- **Google Authentication**: For persistent user accounts
- **Admin Claims**: Role-based access control for administrative functions

### Pages & Functionality
1. **index.html** - Entry point with Tether ID parsing and redirect logic
2. **display.html** - Main Tether interaction interface with template selection and log management
3. **templatecreator.html** - Admin template management with visual field builder
4. **admin.html** - Dashboard with analytics, metrics, and navigation
5. **firebasemgt.html** - Direct database editor with backup/restore functionality
6. **contacteditor.html** - Vendor contact management for Terra Tethers
7. **my_aura.html** - Personal Aura logs dashboard
8. **aura_studio.html** - Admin Aura Tether management and reference content tools

## 🚀 Quick Start

### Prerequisites
- Firebase project with Realtime Database, Authentication, and Analytics enabled
- Node.js 18+ for development tools
- Modern web browser with ES modules support

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/GoTether/connect.git
   cd connect
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Update `docs/js/firebase-config.js` with your Firebase configuration
   - Set up Firebase Security Rules (see [Firebase Setup](#firebase-setup))
   - Enable Anonymous and Google authentication providers

4. **Deploy to GitHub Pages**
   - Push to your repository
   - Enable GitHub Pages with `/docs` as the source directory
   - Access your site at `https://yourusername.github.io/repositoryname`

### Development Server
```bash
npm run dev
```
Serves the site locally at `http://localhost:8000`

## 🔧 Configuration

### Firebase Setup

#### Security Rules
Apply these security rules to your Firebase Realtime Database:

```json
{
  "rules": {
    "tethers": {
      ".read": "true",
      ".write": "auth != null && auth.token.admin === true",
      "$tetherId": {
        "locked": {
          ".write": "auth != null && auth.token.admin === true"
        }
      }
    },
    "shared_logs": {
      "$tetherId": {
        ".read": "true",
        ".write": "auth != null && !root.child('tethers').child($tetherId).child('locked').val()"
      }
    },
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "reference_content": {
      "$tetherId": {
        ".read": "true",
        ".write": "auth != null && auth.token.admin === true"
      }
    },
    "global_templates": {
      ".read": "true",
      ".write": "auth != null && auth.token.admin === true"
    },
    "vendor_contacts": {
      "$tetherId": {
        ".read": "true",
        ".write": "auth != null"
      }
    }
  }
}
```

#### Admin Custom Claims
Set up admin users using Firebase Admin SDK:

```javascript
const admin = require('firebase-admin');
admin.initializeApp();

// Grant admin privileges to a user
admin.auth().setCustomUserClaims('user-uid-here', { admin: true });
```

### Environment Configuration

Update `docs/js/firebase-config.js` with your Firebase project configuration:

```javascript
export const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
  measurementId: "your-measurement-id"
};
```

## 📱 Usage

### Creating Tethers

1. **Access a new Tether**: Visit `https://yourdomain.com/index.html?id=abc123`
2. **Select Template**: Choose from existing templates or create a custom one
3. **Configure Type**: Set as Terra (shared) or Aura (personal)
4. **Start Logging**: Submit log entries through the dynamic form

### Managing Templates

1. **Access Template Creator**: Navigate to Admin Dashboard → Template Creator
2. **Create Fields**: Add text, number, date, email, URL, or textarea fields
3. **Set Validation**: Mark fields as required and add placeholders
4. **Save & Assign**: Templates become available for new Tethers

### Admin Functions

- **Analytics Dashboard**: View metrics, charts, and recent activity
- **Database Management**: Direct JSON editing with validation and backup
- **Aura Studio**: Manage reference content and Aura-specific features
- **Contact Management**: Vendor contact system for Terra Tethers

## 🌐 Multilingual Support

The system supports 6 languages with automatic detection and persistence:

- **English** (en) - Default
- **Spanish** (es) - Español
- **French** (fr) - Français
- **Afrikaans** (af) - Afrikaans
- **Russian** (ru) - Русский
- **Hindi** (hi) - हिन्दी

Language selection is available on all pages and automatically updates the interface.

## 🎨 Customization

### Styling
The system uses Tailwind CSS for styling. Customize by modifying:
- `docs/css/styles.css` - Base styles and custom components
- HTML class attributes - Direct Tailwind utility classes

### Translations
Add or modify translations in `docs/js/i18n.js`:

```javascript
resources: {
  en: {
    translation: {
      "your_key": "Your English text"
    }
  },
  es: {
    translation: {
      "your_key": "Tu texto en español"
    }
  }
}
```

## 🧪 Testing

### Playwright Testing
Run UI tests with Playwright:

```bash
npx playwright test
```

### Manual Testing Checklist
- [ ] Tether creation and template assignment
- [ ] Log submission and display
- [ ] Authentication flows (Anonymous and Google)
- [ ] Admin controls and restrictions
- [ ] Language switching
- [ ] Mobile responsiveness
- [ ] Database backup/restore

## 📂 Project Structure

```
/connect
├── /docs                    # GitHub Pages root
│   ├── index.html          # Entry point
│   ├── display.html        # Main Tether interface
│   ├── templatecreator.html # Template management
│   ├── admin.html          # Admin dashboard
│   ├── firebasemgt.html    # Database editor
│   ├── contacteditor.html  # Contact management
│   ├── my_aura.html        # Personal Aura logs
│   ├── aura_studio.html    # Aura management
│   ├── /css
│   │   └── styles.css      # Tailwind CSS + custom styles
│   ├── /js
│   │   ├── firebase-config.js # Firebase configuration
│   │   ├── i18n.js         # Internationalization
│   │   └── [page].js       # Page-specific scripts
│   └── /assets
│       └── logo.png        # Logo and assets
├── firebase.json           # Firebase hosting config
├── package.json           # Dependencies and scripts
├── .github/
│   ├── copilot-instructions.md # Development guidelines
│   └── copilot-setup-steps.yaml # Environment setup
└── README.md              # This file
```

## 🔒 Security

### Data Protection
- Firebase Security Rules enforce access control
- Admin functions require authenticated admin users
- Personal Aura logs are user-scoped
- Input validation on all forms

### Privacy
- Anonymous authentication for casual users
- User data is compartmentalized
- No personal information required for basic usage

## 🚀 Deployment

### GitHub Pages (Recommended)
1. Push code to GitHub repository
2. Enable GitHub Pages with `/docs` as source
3. Configure custom domain (optional)
4. Site will be available at `https://username.github.io/repository`

### Firebase Hosting
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init hosting`
4. Deploy: `firebase deploy`

### Custom Hosting
Serve the `/docs` directory with any static web server.

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature-name`
3. **Follow coding guidelines** in `.github/copilot-instructions.md`
4. **Test thoroughly** including mobile devices
5. **Submit a pull request** with detailed description

### Development Guidelines
- Use ES modules for JavaScript
- Follow Tailwind CSS conventions
- Ensure accessibility compliance
- Add translations for new text
- Test across browsers and devices

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Common Issues

**Authentication not working?**
- Check Firebase authentication settings
- Verify domain is authorized in Firebase console
- Ensure correct Firebase configuration

**Database rules errors?**
- Apply the security rules from this README
- Check user has necessary permissions
- Verify admin custom claims are set

**Styling issues?**
- Ensure Tailwind CSS is loading correctly
- Check for CSS cache issues
- Verify responsive design on target devices

### Getting Help
- Check the [Issues](https://github.com/GoTether/connect/issues) page
- Create a new issue with detailed description
- Include browser console errors and steps to reproduce

## 🙏 Acknowledgments

- **Firebase** for backend services
- **Tailwind CSS** for styling framework
- **i18next** for internationalization
- **Chart.js** for analytics visualization
- **GitHub Pages** for hosting platform

---

Built with ❤️ for the Tether community