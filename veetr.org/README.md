# Veetr.org Website

This folder contains the source for the static website at https://veetr.org.

The site is built with Astro so shared UI lives in components, page copy can live in Markdown, and the deployed output remains plain static HTML/CSS/JS.

## Structure

- `src/pages/` - Astro routes for the generated pages
- `src/content/pages/` - Markdown page copy and metadata
- `src/components/` - shared header, footer, hero, newsletter, and utility components
- `src/layouts/` - shared page layout
- `src/styles/global.css` - global site styles
- `public/` - static assets copied directly into the built site
- `public/CNAME` - GitHub Pages custom domain configuration

## Local Development

From the repository root:

```bash
npm install
npm run dev --workspace veetr.org
```

Then open the local URL printed by Astro, usually `http://localhost:4321`.

To build and preview the static output:

```bash
npm run build --workspace veetr.org
npm run preview --workspace veetr.org
```

The generated static site is written to `veetr.org/dist`.

## Content Editing

Most page copy lives in `src/content/pages/*.md`. Each file contains frontmatter used for titles, descriptions, and hero text. The route files in `src/pages/` combine that Markdown with structured sections such as feature cards, docs links, and roadmap milestones.

## Deployment

Changes to `veetr.org/**`, `package.json`, or `package-lock.json` trigger `.github/workflows/mirror-site.yml`.

The workflow:

1. Installs Node dependencies with `npm ci`
2. Builds the site with `npm run build --workspace veetr.org`
3. Clones the `veetrlabs/veetr-site` repository
4. Copies `veetr.org/dist` into that repository
5. Commits and pushes the generated static files

GitHub Pages serves the mirrored repository at https://veetr.org.
