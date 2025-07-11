/**
 * Custom hook for route distance calculations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRouteDistance, getCachedRoutesForRoute, clearOldCache, batchCalculateRoutes } from '@/lib/tomtom'
import type { RouteCalculationResult, CachedRoute } from '@/lib/tomtom'

/**
 * Hook to get distance between two routes
 */
export function useRouteDistance(fromRouteId: string, toRouteId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['route-distance', fromRouteId, toRouteId],
    queryFn: () => getRouteDistance(fromRouteId, toRouteId),
    enabled: enabled && !!fromRouteId && !!toRouteId,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 2,
  })
}

/**
 * Hook to get all cached routes for a specific route
 */
export function useCachedRoutes(routeId: string) {
  return useQuery({
    queryKey: ['cached-routes', routeId],
    queryFn: () => getCachedRoutesForRoute(routeId),
    enabled: !!routeId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to refresh route distance (force recalculation)
 */
export function useRefreshRouteDistance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ fromRouteId, toRouteId }: { fromRouteId: string; toRouteId: string }) => {
      return getRouteDistance(fromRouteId, toRouteId, true) // Force refresh
    },
    onSuccess: (data, variables) => {
      // Update the cache with new data
      queryClient.setQueryData(['route-distance', variables.fromRouteId, variables.toRouteId], data)
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['cached-routes', variables.fromRouteId] })
      queryClient.invalidateQueries({ queryKey: ['cached-routes', variables.toRouteId] })
    },
  })
}

/**
 * Hook to clear old cache entries
 */
export function useClearOldCache() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (maxAgeDays: number = 30) => clearOldCache(maxAgeDays),
    onSuccess: () => {
      // Invalidate all cached routes queries
      queryClient.invalidateQueries({ queryKey: ['cached-routes'] })
    },
  })
}

/**
 * Hook for batch route calculations
 */
export function useBatchCalculateRoutes() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      routePairs,
      onProgress
    }: {
      routePairs: Array<{ fromRouteId: string; toRouteId: string }>
      onProgress?: (completed: number, total: number) => void
    }) => {
      return batchCalculateRoutes(routePairs, onProgress)
    },
    onSuccess: (results) => {
      // Update cache for successful calculations
      results.forEach(({ fromRouteId, toRouteId, result }) => {
        if (result) {
          queryClient.setQueryData(['route-distance', fromRouteId, toRouteId], result)
        }
      })
      
      // Invalidate cached routes queries
      const routeIds = new Set()
      results.forEach(({ fromRouteId, toRouteId }) => {
        routeIds.add(fromRouteId)
        routeIds.add(toRouteId)
      })
      
      routeIds.forEach(routeId => {
        queryClient.invalidateQueries({ queryKey: ['cached-routes', routeId] })
      })
    },
  })
}

/**
 * Hook to get route distance with automatic caching
 */
export function useRouteDistanceWithCache(fromRouteId: string, toRouteId: string) {
  const { data, isLoading, error } = useRouteDistance(fromRouteId, toRouteId)
  const refreshMutation = useRefreshRouteDistance()

  const refresh = () => {
    refreshMutation.mutate({ fromRouteId, toRouteId })
  }

  return {
    distance: data,
    isLoading: isLoading || refreshMutation.isPending,
    error: error || refreshMutation.error,
    refresh,
    isRefreshing: refreshMutation.isPending,
  }
}