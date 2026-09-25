import { z } from 'zod'

export const emailSchema = z.string().trim().min(1, 'Enter your email').email('Enter a valid email address').max(254)

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const forgotSchema = z.object({ email: emailSchema })
export type ForgotValues = z.infer<typeof forgotSchema>

export const resetSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' })
export type ResetValues = z.infer<typeof resetSchema>

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Start with https://')

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Enter a valid phone number')

export const brandOnboardingSchema = z.object({
  brand_name: z.string().trim().min(2, 'Enter your brand name').max(80),
  industry: z.string().trim().min(1, 'Choose an industry').max(80),
  website_url: optionalUrl,
  instagram_url: optionalUrl,
  location: z.string().trim().max(120),
  description: z.string().trim().max(2000),
  contact_email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email'),
  contact_phone: optionalPhone,
})
export type BrandOnboardingValues = z.infer<typeof brandOnboardingSchema>

export function passwordStrength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4
}
