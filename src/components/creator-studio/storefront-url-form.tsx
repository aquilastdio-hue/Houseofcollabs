import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Copy, Link2 } from 'lucide-react'
import { siteUrl } from '@/config/site'
import { updateMyCreator, type CreatorProfile } from '@/services/creators.service'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { slugSchema, type SlugInput } from './schemas'
import { StudioSection } from './parts'
import { useStudioSync } from './use-studio'

/** Custom storefront address (`/creators/{slug}`). The database keeps it unique by suffixing. */
export function StorefrontUrlForm({ creator, className }: { creator: CreatorProfile; className?: string }) {
  const sync = useStudioSync()
  const form = useForm<SlugInput>({ resolver: zodResolver(slugSchema), defaultValues: { slug: creator.slug } })
  const { errors, isSubmitting, isDirty } = form.formState
  const typed = useWatch({ control: form.control, name: 'slug' })
  const base = siteUrl('/creators/').replace(/^https?:\/\//, '')
  const publicUrl = siteUrl(`/creators/${creator.slug}`)

  const save = useMutation({
    mutationFn: async (slug: string) => {
      const row = await updateMyCreator(creator.id, { slug })
      await sync()
      return row
    },
  })

  const onSubmit = form.handleSubmit(async ({ slug }) => {
    try {
      const row = await save.mutateAsync(slug)
      form.reset({ slug: row.slug })
      if (row.slug !== slug) toast.info('That address was taken', { description: `We saved /creators/${row.slug} instead.` })
      else toast.success('Storefront link updated')
    } catch {
      // The mutation cache already surfaced the error.
    }
  })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Link copied')
    } catch {
      toast.error('Couldn’t copy the link. Select it and copy it manually.')
    }
  }

  return (
    <StudioSection
      className={className}
      title="Storefront link"
      description="Choose a short, memorable address to share with brands."
      action={
        creator.status === 'published' ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void copy()}>
            <Copy /> Copy link
          </Button>
        ) : undefined
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          label="Custom URL"
          htmlFor="slug"
          required
          hint={
            <span className="break-all">
              {base}
              <span className="font-medium text-ink">{typed?.trim() || creator.slug}</span>
            </span>
          }
          error={errors.slug?.message}
        >
          <Input
            id="slug"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={60}
            leftIcon={<Link2 />}
            {...form.register('slug', {
              onChange: (e: { target: { value: string } }) => {
                const value = e.target.value
                const next = value.toLowerCase().replace(/[\s_]+/g, '-')
                if (next !== value) form.setValue('slug', next, { shouldDirty: true })
              },
            })}
          />
        </Field>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">Changing it breaks links you’ve already shared.</p>
          <Button type="submit" variant="secondary" loading={isSubmitting} disabled={!isDirty}>
            Save link
          </Button>
        </div>
      </form>
    </StudioSection>
  )
}
