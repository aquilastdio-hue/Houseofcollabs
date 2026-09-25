import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { getPublicSettings, getPublicStats, listCategories, listCreatorTypes } from '@/services/catalog.service'

export function useCategories() {
  return useQuery({ queryKey: qk.categories, queryFn: listCategories, staleTime: 10 * 60_000 })
}

export function useCreatorTypes() {
  return useQuery({ queryKey: qk.creatorTypes, queryFn: listCreatorTypes, staleTime: 10 * 60_000 })
}

export function usePublicSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: getPublicSettings, staleTime: 5 * 60_000 })
}

export function usePublicStats() {
  return useQuery({ queryKey: qk.publicStats, queryFn: getPublicStats, staleTime: 5 * 60_000 })
}
