import * as React from 'react'
import { Link } from 'react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, CircleCheck, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/errors'
import { submitContactMessage } from '@/services/support.service'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export const CONTACT_TOPICS = ['Brand enquiry', 'Creator support', 'Payments & payouts', 'Partnerships', 'Press', 'Other'] as const

const MESSAGE_MAX = 4000

/** Mirrors the `contact_messages` table constraints. */
const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter at least 2 characters.').max(100, 'Please keep your name under 100 characters.'),
  email: z
    .string()
    .trim()
    .min(1, 'Please enter your email address.')
    .max(254, 'That email address is too long.')
    .pipe(z.email('Please enter a valid email address.')),
  company: z.string().trim().max(120, 'Please keep this under 120 characters.'),
  topic: z
    .string()
    .min(1, 'Please choose a topic.')
    .refine((value) => (CONTACT_TOPICS as readonly string[]).includes(value), 'Please choose a topic from the list.'),
  message: z
    .string()
    .trim()
    .min(10, 'Please write at least 10 characters so we can help.')
    .max(MESSAGE_MAX, 'Please keep your message under 4,000 characters.'),
})

type ContactInput = z.input<typeof contactSchema>
type ContactValues = z.output<typeof contactSchema>

const TOPIC_OPTIONS = CONTACT_TOPICS.map((topic) => ({ value: topic, label: topic }))

export function ContactForm({ className }: { className?: string }) {
  const { profile, brand } = useAuth()
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<ContactInput, unknown, ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', company: '', topic: '', message: '' },
  })
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const successRef = React.useRef<HTMLHeadingElement>(null)

  // Prefill from the signed-in account without overwriting anything typed.
  React.useEffect(() => {
    if (profile?.full_name && !getValues('name')) setValue('name', profile.full_name)
    if (profile?.email && !getValues('email')) setValue('email', profile.email)
    if (brand?.brand_name && !getValues('company')) setValue('company', brand.brand_name)
  }, [profile, brand, getValues, setValue])

  const mutation = useMutation({
    mutationFn: submitContactMessage,
    meta: { successMessage: 'Message sent. We’ll be in touch soon.' },
  })

  React.useEffect(() => {
    if (sentTo) successRef.current?.focus()
  }, [sentTo])

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      { name: values.name, email: values.email, company: values.company || undefined, topic: values.topic, message: values.message },
      { onSuccess: () => setSentTo(values.email) },
    )
  })

  const messageLength = (watch('message') ?? '').length

  if (sentTo) {
    return (
      <div className={cn('flex flex-col items-center rounded-panel border border-line bg-surface px-6 py-14 text-center shadow-card sm:px-10', className)}>
        <span className="flex size-14 items-center justify-center rounded-full bg-brand text-white">
          <CircleCheck className="size-7" aria-hidden />
        </span>
        <h2 ref={successRef} tabIndex={-1} className="mt-6 font-display text-display-md font-semibold outline-none">
          Thanks — we’ll reply within 1–2 business days
        </h2>
        <p className="mt-3 max-w-md text-muted">
          Your message is with our team, and we’ll write back to <span className="font-medium text-ink">{sentTo}</span>. Keep an eye on your
          spam folder, just in case.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => {
              mutation.reset()
              reset({ name: getValues('name'), email: getValues('email'), company: getValues('company'), topic: '', message: '' })
              setSentTo(null)
            }}
          >
            Send another message
          </Button>
          <Button asChild>
            <Link to="/discover">Explore creators</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-labelledby="contact-form-title"
      className={cn('rounded-panel border border-line bg-surface p-5 shadow-card sm:p-8', className)}
    >
      <h2 id="contact-form-title" className="font-display text-display-sm font-semibold">
        Send us a message
      </h2>
      <p className="mt-1 text-sm text-muted">All fields are required unless marked optional.</p>

      <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="contact-name" error={errors.name?.message}>
          <Input id="contact-name" autoComplete="name" maxLength={100} {...register('name')} />
        </Field>
        <Field label="Email" htmlFor="contact-email" error={errors.email?.message}>
          <Input id="contact-email" type="email" inputMode="email" autoComplete="email" maxLength={254} {...register('email')} />
        </Field>
        <Field label="Company or brand" htmlFor="contact-company" optional error={errors.company?.message}>
          <Input id="contact-company" autoComplete="organization" maxLength={120} {...register('company')} />
        </Field>
        <Field label="Topic" htmlFor="contact-topic" error={errors.topic?.message}>
          <Controller
            control={control}
            name="topic"
            render={({ field }) => (
              <Select
                id="contact-topic"
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
                options={TOPIC_OPTIONS}
                placeholder="Choose a topic"
                aria-invalid={errors.topic ? true : undefined}
              />
            )}
          />
        </Field>
        <Field
          label="Message"
          htmlFor="contact-message"
          className="sm:col-span-2"
          error={errors.message?.message}
          hint={`${messageLength.toLocaleString('en-IN')} / ${MESSAGE_MAX.toLocaleString('en-IN')} characters`}
        >
          <Textarea
            id="contact-message"
            rows={7}
            maxLength={MESSAGE_MAX}
            placeholder="Tell us what you need help with. For an existing order, include the order number."
            {...register('message')}
          />
        </Field>
      </div>

      {mutation.isError && (
        <div role="alert" className="mt-6 flex items-start gap-3 rounded-control border border-danger/25 bg-danger-soft/60 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">Your message wasn’t sent.</span> {errorMessage(mutation.error)}
          </span>
        </div>
      )}

      <div className="mt-7 flex flex-col-reverse items-stretch justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-xs leading-relaxed text-faint">
          By sending this form you agree to our{' '}
          <Link to="/privacy" className="focus-ring rounded-sm underline underline-offset-2 hover:text-ink">
            privacy policy
          </Link>
          .
        </p>
        <Button type="submit" size="lg" loading={mutation.isPending} className="shrink-0">
          {!mutation.isPending && <Send />} {mutation.isPending ? 'Sending…' : 'Send message'}
        </Button>
      </div>
    </form>
  )
}
