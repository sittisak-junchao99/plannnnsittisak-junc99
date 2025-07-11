/**
 * TomTom API Integration
 * Handles route calculation and distance caching
 */

import { supabase } from './supabase'

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '1r6aBtuWPGVZ9esC0LGDMno5NsZu6DRP'
const TOMTOM_BASE_URL = 'https://api.tomtom.com/routing/1'

export interface RouteCoordinates {
  lat: number
  lng: number
}

export interface RouteCalculationResult {
  distance_km: number
  travel_time_minutes: number
  traffic_factor: number
  route_geometry?: any
  summary?: any
}

export interface CachedRoute {
  from_route_id: string
  to_route_id: string
  distance_km: number
  travel_time_minutes: number
  traffic_factor: number
  last_updated: string
}

/**
 * Calculate route between two coordinates using TomTom API
 */
export async function calculateRoute(
  origin: RouteCoordinates,
  destination: RouteCoordinates,
  includeTraffic: boolean = true
): Promise<RouteCalculationResult> {
  try {
    const url = `${TOMTOM_BASE_URL}/calculateRoute/${origin.lat},${origin.lng}:${destination.lat},${destination.lng}/json`
    const params = new URLSearchParams({
      key: TOMTOM_API_KEY,
      traffic: includeTraffic.toString(),
      routeType: 'fastest',
      travelMode: 'car',
      instructionsType: 'text',
      language: 'th-TH'
    })

    const response = await fetch(`${url}?${params}`)
    
    if (!response.ok) {
      throw new Error(`TomTom API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No routes found')
    }

    const route = data.routes[0]
    const summary = route.summary

    // Calculate traffic factor (comparison between traffic and no-traffic time)
    const trafficTime = summary.travelTimeInSeconds
    const noTrafficTime = summary.noTrafficTravelTimeInSeconds || trafficTime
    const trafficFactor = trafficTime / noTrafficTime

    return {
      distance_km: Math.round(summary.lengthInMeters / 1000 * 100) / 100, // Round to 2 decimal places
      travel_time_minutes: Math.round(trafficTime / 60),
      traffic_factor: Math.round(trafficFactor * 100) / 100,
      route_geometry: route.legs?.[0]?.points,
      summary: summary
    }
  } catch (error) {
    console.error('Error calculating route:', error)
    throw error
  }
}

/**
 * Get cached route distance or calculate if not cached
 */
export async function getRouteDistance(
  fromRouteId: string,
  toRouteId: string,
  forceRefresh: boolean = false
): Promise<RouteCalculationResult> {
  try {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('route_distance_cache')
        .select('*')
        .eq('from_route_id', fromRouteId)
        .eq('to_route_id', toRouteId)
        .single()

      if (!cacheError && cached) {
        // Check if cache is still valid (less than 7 days old)
        const cacheAge = Date.now() - new Date(cached.last_updated).getTime()
        const maxCacheAge = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds

        if (cacheAge < maxCacheAge) {
          return {
            distance_km: cached.distance_km,
            travel_time_minutes: cached.travel_time_minutes,
            traffic_factor: cached.traffic_factor
          }
        }
      }
    }

    // Get route coordinates from database
    const { data: routes, error: routesError } = await supabase
      .from('routes')
      .select('id, origin_coordinates, destination_coordinates')
      .in('id', [fromRouteId, toRouteId])

    if (routesError) throw routesError
    if (!routes || routes.length !== 2) {
      throw new Error('Could not find route coordinates')
    }

    const fromRoute = routes.find(r => r.id === fromRouteId)
    const toRoute = routes.find(r => r.id === toRouteId)

    if (!fromRoute?.destination_coordinates || !toRoute?.origin_coordinates) {
      throw new Error('Missing route coordinates')
    }

    // Parse coordinates (assuming they're stored as POINT in PostgreSQL)
    const fromCoords = parseCoordinates(fromRoute.destination_coordinates)
    const toCoords = parseCoordinates(toRoute.origin_coordinates)

    // Calculate route using TomTom API
    const result = await calculateRoute(fromCoords, toCoords)

    // Cache the result
    await cacheRouteDistance(fromRouteId, toRouteId, result)

    return result
  } catch (error) {
    console.error('Error getting route distance:', error)
    throw error
  }
}

/**
 * Cache route distance calculation result
 */
export async function cacheRouteDistance(
  fromRouteId: string,
  toRouteId: string,
  result: RouteCalculationResult
): Promise<void> {
  try {
    const { error } = await supabase
      .from('route_distance_cache')
      .upsert({
        from_route_id: fromRouteId,
        to_route_id: toRouteId,
        distance_km: result.distance_km,
        travel_time_minutes: result.travel_time_minutes,
        traffic_factor: result.traffic_factor,
        last_updated: new Date().toISOString()
      })

    if (error) throw error
  } catch (error) {
    console.error('Error caching route distance:', error)
    // Don't throw error here as caching failure shouldn't break the main flow
  }
}

/**
 * Parse coordinates from PostgreSQL POINT format
 */
function parseCoordinates(point: any): RouteCoordinates {
  if (typeof point === 'string') {
    // Parse string format like "(lat,lng)" or "lat,lng"
    const coords = point.replace(/[()]/g, '').split(',')
    return {
      lat: parseFloat(coords[0]),
      lng: parseFloat(coords[1])
    }
  } else if (point && typeof point === 'object') {
    // Handle object format
    return {
      lat: point.x || point.lat || point.latitude,
      lng: point.y || point.lng || point.longitude
    }
  }
  
  throw new Error('Invalid coordinate format')
}

/**
 * Get all cached routes for a specific route
 */
export async function getCachedRoutesForRoute(routeId: string): Promise<CachedRoute[]> {
  try {
    const { data, error } = await supabase
      .from('route_distance_cache')
      .select('*')
      .or(`from_route_id.eq.${routeId},to_route_id.eq.${routeId}`)
      .order('last_updated', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting cached routes:', error)
    return []
  }
}

/**
 * Clear old cache entries (older than specified days)
 */
export async function clearOldCache(maxAgeDays: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays)

    const { data, error } = await supabase
      .from('route_distance_cache')
      .delete()
      .lt('last_updated', cutoffDate.toISOString())
      .select('id')

    if (error) throw error
    return data?.length || 0
  } catch (error) {
    console.error('Error clearing old cache:', error)
    return 0
  }
}

/**
 * Batch calculate distances for multiple route pairs
 */
export async function batchCalculateRoutes(
  routePairs: Array<{ fromRouteId: string; toRouteId: string }>,
  onProgress?: (completed: number, total: number) => void
): Promise<Array<{ fromRouteId: string; toRouteId: string; result: RouteCalculationResult | null; error?: string }>> {
  const results = []
  
  for (let i = 0; i < routePairs.length; i++) {
    const pair = routePairs[i]
    
    try {
      const result = await getRouteDistance(pair.fromRouteId, pair.toRouteId)
      results.push({
        fromRouteId: pair.fromRouteId,
        toRouteId: pair.toRouteId,
        result
      })
    } catch (error) {
      results.push({
        fromRouteId: pair.fromRouteId,
        toRouteId: pair.toRouteId,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Call progress callback if provided
    if (onProgress) {
      onProgress(i + 1, routePairs.length)
    }
    
    // Add small delay to avoid rate limiting
    if (i < routePairs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}