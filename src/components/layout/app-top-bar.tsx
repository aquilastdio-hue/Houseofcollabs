import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/logo'

/**
 * The apps' header on the few public pages they reach (creator sign-up, the
 * policies): back and the logo, nothing that leads into the marketing site.
 */
export function AppTopBar() {
  const navigate = useNavigate()
  // A page opened straight from a link has nothing to go back to; login does.
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/login', { replace: true }))

  return (
    <header className="sticky top-0 z-40 grid h-(--header-height) grid-cols-[1fr_auto_1fr] items-center border-b border-line/70 bg-canvas/90 px-gutter backdrop-blur-xl">
      <Button variant="ghost" size="icon-sm" onClick={back} aria-label="Back" className="justify-self-start">
        <ChevronLeft />
      </Button>
      <Logo className="[&>span]:h-10" />
      <span aria-hidden />
    </header>
  )
}
