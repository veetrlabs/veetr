# Veetr.com redirect

Veetr.com now redirects visitors to the consolidated project site at https://veetr.org.

## Structure

- `index.html` redirects to `https://veetr.org/`
- `terms.html` redirects to the archived kit terms on veetr.org
- `privacy.html` redirects to the archived kit privacy policy on veetr.org

The former shop’s pricing, shipping, parts, early-adopter, business, contact, and legal information is preserved at https://veetr.org/kit/ and its linked legal pages.

## Local Development

Open `index.html` directly in a browser or serve via local web server:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080

## Deployment

Cloudflare Pages project `veetr-com` deploys directly from the `main` branch of
`veetrlabs/veetr`:

- Root directory: `veetr.com`
- Build command: `exit 0` (the files are already static)
- Output directory: `.`
- Custom domain: `veetr.com`

The former standalone mirror repository has been deleted. Edit the redirect
pages in this directory; pushes to `main` trigger Cloudflare's Git integration.

See [Website hosting](../docs/HOSTING.md) for the complete website map.

## Brand Consistency

Uses the same Veetr brand guidelines as veetr.org:
- **Font**: IBM Plex Sans (Semi-Bold 600 for headings, Regular 400 for body)
- **Colors**:
  - Fresh Sky: #48B3F6
  - Oxford Navy: #102F56
  - Alice Blue: #E5F4FE
  - Bright Snow: #F8F8F8

The legacy styles and images remain in this source directory for history but are not loaded by the redirect pages.
