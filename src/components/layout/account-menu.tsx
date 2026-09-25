import { Link, useNavigate } from 'react-router'
import { ExternalLink, LogOut, Settings, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { Avatar } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toAppError } from '@/lib/errors'

export function AccountMenu({ settingsHref, profileHref }: { settingsHref: string; profileHref?: string }) {
  const { profile, brand, creator, signOut } = useAuth()
  const navigate = useNavigate()
  const name = brand?.brand_name ?? creator?.display_name ?? profile?.full_name ?? profile?.email ?? 'Account'
  const image = brand?.brand_logo_url ?? creator?.profile_image_url ?? profile?.avatar_url

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus-ring flex items-center gap-2 rounded-pill p-0.5 pr-2 transition-colors hover:bg-subtle" aria-label="Account menu">
        <Avatar src={image} name={name} size="sm" />
        <span className="hidden max-w-32 truncate text-sm font-medium lg:inline">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-medium text-ink">{name}</span>
          <span className="block truncate text-xs font-normal text-muted">{profile?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profileHref && (
          <DropdownMenuItem asChild>
            <Link to={profileHref}>
              <UserRound /> Profile
            </Link>
          </DropdownMenuItem>
        )}
        {creator?.status === 'published' && (
          <DropdownMenuItem asChild>
            <Link to={`/creators/${creator.slug}`} target="_blank">
              <ExternalLink /> View public storefront
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to={settingsHref}>
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onSelect={async () => {
            try {
              await signOut()
              navigate('/', { replace: true })
            } catch (e) {
              toast.error(toAppError(e).message)
            }
          }}
        >
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
