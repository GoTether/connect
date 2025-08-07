# Copilot Instructions

## Coding Guidelines
- Use ES modules for JavaScript imports/exports
- Apply Tailwind CSS classes for styling (responsive, mobile-first design)
- Ensure accessibility with ARIA attributes and keyboard navigation
- Implement multilingual support using i18next for English, Spanish, French, Afrikaans, Russian, Hindi
- Validate all inputs and handle errors gracefully with user-friendly messages
- Use Playwright to test UI interactions (e.g., form submissions, redirects)
- Follow modular, clean code practices with clear comments

## Project Structure
- All HTML files in `/docs` root
- CSS files in `/docs/css/`
- JavaScript files in `/docs/js/`
- Assets in `/docs/assets/`
- Firebase configuration in `/docs/js/firebase-config.js`

## Firebase Integration
- Use Firebase Realtime Database for data storage
- Implement Authentication (Anonymous and Google providers)
- Apply proper security rules for data access
- Use Firebase Analytics for tracking

## Testing
- Write Playwright tests for all UI interactions
- Test authentication flows and admin restrictions
- Validate responsive design on mobile viewports
- Ensure accessibility compliance

## Code Quality
- Write clean, readable code with meaningful variable names
- Add comments for complex logic
- Handle edge cases and error conditions
- Follow consistent coding style throughout the project