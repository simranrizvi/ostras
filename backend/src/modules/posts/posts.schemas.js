import { z } from 'zod';

export const statuses = ['draft', 'scheduled', 'processing', 'published', 'failed'];
export const postSchema = z
  .object({
    title: z.string().trim().max(140).default(''),
    topic: z.string().trim().max(200).default(''),
    caption: z.string().trim().min(2).max(2200),
    hashtags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    imageUrl: z
      .union([
        z.url().refine((value) => value.startsWith('https://'), 'Use an HTTPS image URL.'),
        z.literal(''),
      ])
      .default(''),
  })
  .refine(
    (post) => [post.caption, post.hashtags.join(' ')].filter(Boolean).join('\n\n').length <= 2200,
    {
      message: 'Caption and hashtags together must fit within 2,200 characters.',
      path: ['caption'],
    },
  );
export const generateSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  withImage: z.boolean().default(false),
});
export const scheduleSchema = z.object({
  scheduledAt: z.iso
    .datetime()
    .refine((value) => new Date(value).getTime() > Date.now(), 'Choose a time in the future.'),
});
export const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(statuses).optional(),
    search: z.string().trim().max(120).default(''),
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from < value.to, {
    message: 'The end date must follow the start date.',
  });
