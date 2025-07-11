/**
 * Page for managing route distances and calculations
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapIcon, ClockIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'
import { useClearOldCache } from '@/hooks/useRouteDistance'
import RouteDistanceCalculator from '@/components/route/RouteDistanceCalculator'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface CachedDistance {
  id: string
  from_route_id: string
  to_route_id: string
  distance_km: number
  travel_time_minutes: number
  traffic_factor: number
  last_updated: string
  from_route?: {
    route_code: string
    name: string
  }
  to_route?: {
    route_code: string
    name: string
  }
}

export default function RouteDistancePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const clearCacheMutation = useClearOldCache()

  // Fetch cached distances
  const { data: cachedDistances, isLoading, refetch } = useQuery({
    queryKey: ['cached-distances', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('route_distance_cache')
        .select(`
          *,
          from_route:routes!route_distance_cache_from_route_id_fkey (
            route_code,
            name
          ),
          to_route:routes!route_distance_cache_to_route_id_fkey (
            route_code,
            name
          )
        `)
        .order('last_updated', { ascending: false })

      if (searchTerm) {
        // This is a simplified search - in a real app you might want to join with routes table
        query = query.or(`from_route.route_code.ilike.%${searchTerm}%,to_route.route_code.ilike.%${searchTerm}%`)
      }

      const { data, error } = await query

      if (error) throw error
      return data as CachedDistance[]
    },
  })

  const handleClearOldCache = async (days: number = 30) => {
    try {
      const deletedCount = await clearCacheMutation.mutateAsync(days)
      toast.success(`Cleared ${deletedCount} old cache entries`)
      refetch()
    } catch (error) {
      toast.error('Failed to clear cache')
    }
  }

  const formatLastUpdated = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm')
    } catch {
      return 'Invalid date'
    }
  }

  const getCacheAge = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
      
      if (diffInHours < 1) return 'Less than 1 hour'
      if (diffInHours < 24) return `${diffInHours} hours ago`
      
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays} days ago`
    } catch {
      return 'Unknown'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Route Distance Management</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => handleClearOldCache(7)}
            disabled={clearCacheMutation.isPending}
            className="btn-outline"
          >
            <TrashIcon className="h-4 w-4 mr-2" />
            Clear 7+ Days
          </button>
          <button
            onClick={() => handleClearOldCache(30)}
            disabled={clearCacheMutation.isPending}
            className="btn-outline"
          >
            <TrashIcon className="h-4 w-4 mr-2" />
            Clear 30+ Days
          </button>
          <button
            onClick={() => refetch()}
            className="btn-outline"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Route Distance Calculator */}
      <RouteDistanceCalculator />

      {/* Cached Distances Table */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-secondary-900">Cached Route Distances</h3>
            <div className="flex items-center space-x-4">
              <input
                type="text"
                placeholder="Search routes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-64"
              />
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          {isLoading ? (
            <div className="p-6">
              <div className="loading-skeleton h-64 w-full"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">From Route</th>
                    <th className="table-header-cell">To Route</th>
                    <th className="table-header-cell">Distance</th>
                    <th className="table-header-cell">Travel Time</th>
                    <th className="table-header-cell">Traffic Factor</th>
                    <th className="table-header-cell">Last Updated</th>
                    <th className="table-header-cell">Cache Age</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {cachedDistances?.map((cache) => (
                    <tr key={cache.id} className="table-row">
                      <td className="table-cell">
                        <div>
                          <div className="font-medium">{cache.from_route?.route_code}</div>
                          <div className="text-sm text-secondary-500">{cache.from_route?.name}</div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>
                          <div className="font-medium">{cache.to_route?.route_code}</div>
                          <div className="text-sm text-secondary-500">{cache.to_route?.name}</div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center">
                          <MapIcon className="h-4 w-4 text-secondary-400 mr-1" />
                          {cache.distance_km} km
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 text-secondary-400 mr-1" />
                          {cache.travel_time_minutes} min
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${
                          cache.traffic_factor > 1.5 ? 'badge-error' :
                          cache.traffic_factor > 1.2 ? 'badge-warning' :
                          'badge-success'
                        }`}>
                          {cache.traffic_factor}x
                        </span>
                      </td>
                      <td className="table-cell text-sm">
                        {formatLastUpdated(cache.last_updated)}
                      </td>
                      <td className="table-cell text-sm text-secondary-500">
                        {getCacheAge(cache.last_updated)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {cachedDistances?.length === 0 && (
                <div className="text-center py-12">
                  <MapIcon className="h-12 w-12 text-secondary-300 mx-auto mb-4" />
                  <p className="text-secondary-500">No cached route distances found.</p>
                  <p className="text-sm text-secondary-400 mt-1">
                    Use the calculator above to generate route distances.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}