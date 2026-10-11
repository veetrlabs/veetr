import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://veetr.org',
  output: 'static',
  vite: {envPrefix: ['PUBLIC_', 'VITE_'], esbuild: {jsx: 'automatic'}},
  redirects: {
    '/cs/contact/': '/cs/about/#contact',
    '/cs/product/': '/cs/',
    '/cs/docs/setup/': '/cs/docs/',
    '/cs/terms.html': '/cs/legal/kit-terms/',
    '/cs/privacy.html': '/cs/legal/kit-privacy/',
    '/contact/': '/about/#contact',
    '/product/': '/',
    '/docs/setup/': '/docs/',
    '/terms.html': '/legal/kit-terms/',
    '/privacy.html': '/legal/kit-privacy/',
  },
  // Keep the existing inline whitespace while migrating to the Astro 7 compiler.
  compressHTML: true,
  integrations: [
    starlight({
      title: 'Veetr',
      defaultLocale: 'root',
      locales: {root: {label: 'English', lang: 'en'}, cs: {label: 'Čeština', lang: 'cs'}},
      logo: { src: './public/img/veetr-logo.svg', alt: '' },
      favicon: '/img/veetr-logo.svg',
      // Marketing routes use the splash layout; repository Markdown powers /docs/*.
      disable404Route: true,
      pagefind: true,
      pagination: true,
      sidebar: [
        {
          label: 'Documentation', translations: {cs: 'Dokumentace'},
          items: [
            {
              label: 'Get started', translations: {cs: 'Začínáme'},
              items: ['docs', 'docs/mobile-apps', 'docs/share-your-trip'],
            },
            {
              label: 'Race management', translations: {cs: 'Správa závodů'},
              items: ['docs/race-guide', 'docs/race-managers', 'docs/race-referees', 'docs/race-skippers', 'docs/race-crew', 'docs/race-spectators', 'docs/race-administrators', 'docs/race-scoring'],
            },
            {
              label: 'Hardware', translations: {cs: 'Hardware'},
              items: [
                { label: 'Overview', translations: {cs: 'Přehled'}, slug: 'docs/hardware' },
                'docs/components',
                'docs/pcb',
                'docs/enclosure',
                'docs/wiring',
                'docs/hardware-reference',
                'docs/storage',
                'docs/compliance',
              ],
            },
            {
              label: 'Software', translations: {cs: 'Software'},
              items: [
                { label: 'Overview', translations: {cs: 'Přehled'}, slug: 'docs/software' },
                {
                  label: 'Firmware', translations: {cs: 'Firmware'},
                  items: [
                    { label: 'Overview', translations: {cs: 'Přehled'}, slug: 'docs/firmware' },
                    'docs/firmware-update',
                    'docs/firmware-testing',
                  ],
                },
                'docs/native-apps',
                'docs/pwa',
                'docs/development',
                'docs/platformio',
                'docs/version-management',
              ],
            },
          ],
        },
      ],
      head: [{ tag: 'meta', attrs: { property: 'og:type', content: 'website' } }],
      customCss: ['./src/styles/starlight.css'],
      components: {
        Header: './src/components/starlight/Header.astro',
        Footer: './src/components/starlight/Footer.astro',
      },
    }),
  ],
});
