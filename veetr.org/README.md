# Veetr.org Website

This folder contains the source for the static website at https://veetr.org.

The site is built with Astro so shared UI lives in components, page copy can live in Markdown, and the deployed output remains plain static HTML/CSS/JS.

## Structure

- `src/pages/` - Astro routes for the generated pages
- `src/content/pages/` - Markdown page copy and metadata
- repository `../docs/*.md` - canonical Starlight documentation loaded directly at build time
- `src/components/` - shared footer, newsletter, and utility components; Starlight navigation in `starlight/`
- `src/layouts/BaseLayout.astro` - shared Starlight page layout with optional optimized hero imagery
- `src/styles/starlight.css` - site-wide light/dark theme, responsive sections, and form styles
- `src/styles/global.css` - retained legacy stylesheet, no longer imported by website routes
- `public/` - static assets copied directly into the built site
- `public/CNAME` - GitHub Pages custom domain configuration

## Local Development

Use Node 22.19 or newer. With nvm, run `nvm install` and `nvm use` from
`veetr.org/` to select the current Node 22 release specified by `.nvmrc`.
The site deployment workflow also uses Node 22.

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

## Starlight website

All nine routes use Starlight's sidebar-free splash layout, shared navigation,
theme selector, and footer. Marketing pages use optimized hero images and
responsive sections; legal pages use a restrained text layout. Nine documentation
routes add a sidebar, page table of contents, search, and source edit links. The homepage,
product, build, and documentation pages use Starlight cards.
The website uses Astro 7.3.1 and Starlight 0.42.0, with Astro's native Markdown
processor and Content Layer loaders. Versions are pinned in `package.json`.
Custom header and footer components live in `src/components/starlight/`.

The shared newsletter, contact, campaign, and cookie-consent components keep
their existing destinations and behavior. `/docs/` opens the user setup guide
directly with its documentation navigation; there is no separate landing page.
Search and previous/next navigation are enabled. Nine public technical guides are loaded directly from
the repository-level `docs/` directory, so GitHub and the website share one
source of truth. TODOs, roadmaps, and recording scripts are not published.

Run `npm test --workspace veetr.org` from the repository root to build and check
the generated routes, every Markdown page's copy, metadata, shared theme,
form destinations, documentation routes, local links, search, and image assets.
The deployment workflow runs these checks before publishing generated files.

## Content Editing

Most page copy lives in `src/content/pages/*.md`. Each file contains frontmatter used for titles, descriptions, and hero text. The route files in `src/pages/` combine that Markdown with structured sections such as feature cards, docs links, and roadmap milestones.

## Deployment

Changes to `veetr.org/**`, `docs/**`, `package.json`, or `package-lock.json` trigger `.github/workflows/mirror-site.yml`.

The workflow:

1. Installs Node dependencies with `npm ci`
2. Builds the site with `npm run build --workspace veetr.org`
3. Runs the generated-site regression checks
4. Clones the `veetrlabs/veetr-site` repository
5. Copies `veetr.org/dist` into that repository
6. Commits and pushes the generated static files

GitHub Pages serves the mirrored repository at https://veetr.org.
