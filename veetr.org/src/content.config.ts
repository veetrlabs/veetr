import { defineCollection, z } from 'astro:content';

const pages = defineCollection({
  type: 'content',
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

export const collections = { pages };
