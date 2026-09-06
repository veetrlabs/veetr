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
        'HARDWARE.md',
        'COMPONENTS.md',
        'PCB.md',
        'WIRING.md',
        'HARDWARE_REFERENCE.md',
        'FIRMWARE_UPDATE.md',
        'COMPLIANCE.md',
        'DEVELOPMENT.md',
        'PLATFORMIO.md',
        'FIRMWARE_TESTING.md',
        'STORAGE.md',
        'VERSION_MANAGEMENT.md',
      ],
      generateId: ({ entry }) => {
        if (entry.toLowerCase() === 'setup.md') return 'docs';
        return `docs/${entry.replace(/\.md$/i, '').toLowerCase().replaceAll('_', '-')}`;
      },
    }),
    schema: docsSchema(),
  }),
};
