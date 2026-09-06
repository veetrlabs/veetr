import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://veetr.org',
  output: 'static',
  redirects: {
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
      logo: { src: './public/img/veetr-logo.svg', alt: '' },
      favicon: '/img/veetr-logo.svg',
      // Marketing routes use the splash layout; repository Markdown powers /docs/*.
      disable404Route: true,
      pagefind: true,
      pagination: true,
      sidebar: [
        {
          label: 'Documentation',
          items: [
            {
              label: 'Get started',
              items: ['docs', 'docs/firmware-update'],
            },
            {
              label: 'Hardware',
              items: [
                { label: 'Overview', slug: 'docs/hardware' },
                'docs/components',
                'docs/wiring',
                'docs/hardware-reference',
                'docs/storage',
                'docs/compliance',
              ],
            },
            {
              label: 'Development',
              items: ['docs/development', 'docs/platformio', 'docs/firmware-testing', 'docs/version-management'],
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
