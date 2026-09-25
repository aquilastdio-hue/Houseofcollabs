import {
  Baby,
  Camera,
  Cpu,
  Droplets,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  Heart,
  Plane,
  Shapes,
  Shirt,
  Smartphone,
  Sparkles,
  Sun,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Categories store a Lucide icon name (kebab-case); only the ones in use are bundled. */
const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  shirt: Shirt,
  dumbbell: Dumbbell,
  sun: Sun,
  utensils: Utensils,
  plane: Plane,
  cpu: Cpu,
  'gamepad-2': Gamepad2,
  baby: Baby,
  'graduation-cap': GraduationCap,
  droplets: Droplets,
  heart: Heart,
  smartphone: Smartphone,
  camera: Camera,
  wallet: Wallet,
}

export function CategoryIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const Icon = ICONS[icon ?? ''] ?? Shapes
  return <Icon className={cn('size-5 shrink-0', className)} aria-hidden />
}
