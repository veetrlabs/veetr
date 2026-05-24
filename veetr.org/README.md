# Veetr.org Website

This folder contains the static website files for https://veetr.org

## Structure

- `index.html` - Main landing page
- `styles.css` - Stylesheet with all CSS styling
- `CNAME` - GitHub Pages custom domain configuration for veetr.org
- Additional assets can be added here as needed

## Deployment

The site is automatically mirrored to the [veetr-site repository](https://github.com/veetrlabs/veetr-site) via GitHub Actions when changes are made to this folder.

## Development

To test the site locally:
1. Open `index.html` directly in a web browser
2. Or serve via a local web server:
   ```bash
   # Python 3
   python3 -m http.server 8000
   
   # Node.js (if installed)
   npx http-server
   
   # PHP (if installed)
   php -S localhost:8000
   
   # macOS with Python 2 (legacy)
   python -m SimpleHTTPServer 8000
   ```
3. Then visit `http://localhost:8000`

## Features

The landing page includes:
- Hero section with project overview
- Feature highlights
- Technical specifications
- Links to all documentation
- Responsive design for mobile and desktop
- Modern CSS with smooth animations
- SEO optimized with meta tags

## Customization

The site uses external CSS for better maintainability. Key design elements:
- Color scheme: Blue gradient (#667eea to #764ba2)
- Font: System font stack for performance
- Layout: CSS Grid and Flexbox for responsiveness
- Icons: Unicode emoji for simplicity
