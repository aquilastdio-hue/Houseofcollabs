import { ExternalLink, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/**
 * The creators' WhatsApp community. Shown to creators only — on the sign-up
 * form and their own dashboard — never on a public storefront, where brands
 * would see it.
 */
export const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/CMcu8orqbdG3HpE1SPOJEj'

export function WhatsAppCommunityCard() {
  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-success-soft text-success" aria-hidden>
          <MessageCircle className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">Join our WhatsApp community</p>
          <p className="mt-0.5 text-sm text-muted">Stay in touch with the House of Collabs team and other creators.</p>
        </div>
      </div>
      <Button asChild variant="secondary" className="shrink-0">
        <a href={WHATSAPP_COMMUNITY_URL} target="_blank" rel="noopener noreferrer">
          Join on WhatsApp <ExternalLink className="size-3.5" />
        </a>
      </Button>
    </Card>
  )
}
