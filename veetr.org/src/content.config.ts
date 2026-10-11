import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { docsSchema } from '@astrojs/starlight/schema';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    eyebrow: z.string().optional(),
    heroTitle: z.string().optional(),
    heroLead: z.string().optional(),
    heroSupport: z.string().optional(),
    effectiveDate: z.string().optional(),
  }),
});

export const collections = {
  pages,
  docs: defineCollection({
    // The repository-level Markdown files remain the single source of truth on GitHub.
    loader: glob({
      base: '../docs',
      pattern: [
        'SETUP.md',
        'MOBILE_APPS.md',
        'NATIVE_APPS.md',
        'SHARE_YOUR_TRIP.md',
        'VEETR_ACCOUNT.md',
        'RACE_GUIDE.md',
        'RACE_MANAGERS.md',
        'RACE_REFEREES.md',
        'RACE_SKIPPERS.md',
        'RACE_CREW.md',
        'RACE_SPECTATORS.md',
        'RACE_ADMINISTRATORS.md',
        'RACE_SCORING.md',
        'HARDWARE.md',
        'COMPONENTS.md',
        'PCB.md',
        'ENCLOSURE.md',
        'WIRING.md',
        'HARDWARE_REFERENCE.md',
        'FIRMWARE_UPDATE.md',
        'COMPLIANCE.md',
        'DEVELOPMENT.md',
        'PLATFORMIO.md',
        'FIRMWARE_TESTING.md',
        'STORAGE.md',
        'SOFTWARE.md',
        'FIRMWARE.md',
        'PWA.md',
        'VERSION_MANAGEMENT.md',
        'cs/*.md',
      ],
      generateId: ({ entry }) => {
        const locale = entry.startsWith('cs/') ? 'cs/' : '';
        const name = entry.replace(/^cs\//, '');
        if (name.toLowerCase() === 'setup.md') return `${locale}docs`;
        return `${locale}docs/${name.replace(/\.md$/i, '').toLowerCase().replaceAll('_', '-')}`;
      },
    }),
    schema: docsSchema(),
  }),
};
