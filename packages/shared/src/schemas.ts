import { z } from 'zod';
import { DOWNLOAD_STATUS } from './types.js';

// Auth schemas
export const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(8).max(100),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  password: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type SignupInput = z.infer<typeof signupSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Download request schemas
export const downloadRequestSchema = z.object({
  query: z.string().min(1).max(200).trim(),
  provider: z.string().min(1).max(50),
});

export type DownloadRequestInput = z.infer<typeof downloadRequestSchema>;

export const downloadConfirmSchema = z.object({
  provider: z.string().min(1).max(50),
  resultId: z.string().min(1).max(100),
});

export type DownloadConfirmInput = z.infer<typeof downloadConfirmSchema>;

export const wantedDownloadQualitySchema = z.enum(['720p', '1080p', '2160p']);

export const createWantedDownloadSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  year: z.coerce.number().int().min(1900).max(2100).default(new Date().getFullYear()),
  mediaType: z.enum(['movie', 'show']).default('movie'),
  minQuality: wantedDownloadQualitySchema.default('1080p'),
});

export type CreateWantedDownloadInput = z.infer<typeof createWantedDownloadSchema>;

export const wantedDownloadIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const wantedDownloadAvailabilitySchema = z.object({
  minQuality: wantedDownloadQualitySchema.default('1080p'),
  items: z.array(z.object({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(200).trim(),
    year: z.coerce.number().int().min(1900).max(2100).optional(),
  })).min(1).max(30),
});

export type WantedDownloadAvailabilityInput = z.infer<typeof wantedDownloadAvailabilitySchema>;

// Download status schema
export const downloadStatusSchema = z.enum([
  DOWNLOAD_STATUS.QUEUED,
  DOWNLOAD_STATUS.FETCHING_MAGNET,
  DOWNLOAD_STATUS.ADDING_TO_QBITTORRENT,
  DOWNLOAD_STATUS.DOWNLOADING,
  DOWNLOAD_STATUS.PAUSED,
  DOWNLOAD_STATUS.COMPLETED,
  DOWNLOAD_STATUS.FAILED,
  DOWNLOAD_STATUS.CANCELED,
]);

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// Search schema
export const searchSchema = z.object({
  q: z.string().max(200).optional(),
  ...paginationSchema.shape,
});

export type SearchInput = z.infer<typeof searchSchema>;

// Upload schema
export const uploadConfigSchema = z.object({
  maxSizeBytes: z.number().int().positive(),
  allowedMimeTypes: z.array(z.string()),
});

// File ID param schema
export const fileIdParamSchema = z.object({
  fileId: z.string().uuid(),
});

export const downloadIdParamSchema = z.object({
  id: z.string().uuid('Invalid download ID'),
});

// Provider search result schema
export const providerSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  sizeBytes: z.number().nullable(),
  seeds: z.number().nullable(),
  peers: z.number().nullable(),
  provider: z.string(),
  year: z.number().optional(),
  quality: z.string().optional(),
  compatibility: z.object({
    score: z.number(),
    level: z.enum(['best', 'ok', 'risky']),
    label: z.string(),
    reasons: z.array(z.string()),
  }).optional(),
});

export const dismissRecommendationSchema = z.object({
  itemId: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  source: z.string().min(1).max(50),
  reason: z.enum(['already_watched', 'not_interested']).default('already_watched'),
});

export type DismissRecommendationInput = z.infer<typeof dismissRecommendationSchema>;

export const promptRecommendationSchema = z.object({
  prompt: z.string().min(3).max(300).trim(),
});

export type PromptRecommendationInput = z.infer<typeof promptRecommendationSchema>;

// Magnet URI validation (basic)
export const magnetUriSchema = z.string().refine(
  (val) => val.startsWith('magnet:?'),
  { message: 'Invalid magnet URI format' }
);
