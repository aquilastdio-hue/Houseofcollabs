import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { queryClient } from '@/lib/query-client'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { AuthProvider } from '@/contexts/auth-context'
import { CompareProvider } from '@/contexts/compare-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { router } from '@/routes/router'
import { SetupRequired } from '@/components/layout/setup-required'

export default function App() {
  if (!isSupabaseConfigured) return <SetupRequired />
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CompareProvider>
          <TooltipProvider delayDuration={200}>
            <RouterProvider router={router} />
            <Toaster />
          </TooltipProvider>
        </CompareProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
