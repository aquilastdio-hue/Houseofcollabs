import { useQuery } from '@tanstack/react-query'
import { signedUrls } from '@/lib/supabase/storage'
import type { Bucket } from '@/lib/validation/files'

/**
 * Signed URLs for private files, cached for 50 minutes (URLs live 60 min).
 * Returns a map path → URL.
 */
export function useSignedUrls(bucket: Bucket, paths: (string | null | undefined)[]) {
  const clean = paths.filter((p): p is string => !!p).sort()
  return useQuery({
    queryKey: ['signed-urls', bucket, clean],
    queryFn: () => signedUrls(bucket, clean),
    enabled: clean.length > 0,
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
  })
}
