/**
 * Component for calculating and displaying route distances
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPinIcon, ClockIcon, TruckIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'
import { useRouteDistanceWithCache, useBatchCalculateRoutes } from '@/hooks/useRouteDistance'
import toast from 'react-hot-toast'

interface Route {
  id: string
  route_code: string
  name: string
  origin_name: string
  destination_name: string
}

export default function RouteDistanceCalculator() {
  const [fromRouteId, setFromRouteId] = useState('')
  const [toRouteId, setToRouteId] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([])
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0 })

  // Fetch available routes
  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ['routes-for-distance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('id, route_code, name, origin_name, destination_name')
        .eq('status', 'Active')
        .order('route_code')

      if (error) throw error
      return data as Route[]
    },
  })

  // Single route distance calculation
  const {
    distance,
    isLoading: distanceLoading,
    error: distanceError,
    refresh,
    isRefreshing
  } = useRouteDistanceWithCache(fromRouteId, toRouteId)

  // Batch calculation
  const batchMutation = useBatchCalculateRoutes()

  const handleSingleCalculation = () => {
    if (!fromRouteId || !toRouteId) {
      toast.error('Please select both routes')
      return
    }
    if (fromRouteId === toRouteId) {
      toast.error('Please select different routes')
      return
    }
    // The calculation will happen automatically via the hook
  }

  const handleBatchCalculation = async () => {
    if (selectedRoutes.length < 2) {
      toast.error('Please select at least 2 routes for batch calculation')
      return
    }

    // Generate all possible route pairs
    const routePairs = []
    for (let i = 0; i < selectedRoutes.length; i++) {
      for (let j = i + 1; j < selectedRoutes.length; j++) {
        routePairs.push({
          fromRouteId: selectedRoutes[i],
          toRouteId: selectedRoutes[j]
        })
        // Also add reverse direction
        routePairs.push({
          fromRouteId: selectedRoutes[j],
          toRouteId: selectedRoutes[i]
        })
      }
    }

    setBatchProgress({ completed: 0, total: routePairs.length })

    try {
      await batchMutation.mutateAsync({
        routePairs,
        onProgress: (completed, total) => {
          setBatchProgress({ completed, total })
        }
      })
      toast.success(`Batch calculation completed! ${routePairs.length} route pairs calculated.`)
    } catch (error) {
      toast.error('Batch calculation failed')
    } finally {
      setBatchProgress({ completed: 0, total: 0 })
    }
  }

  const toggleRouteSelection = (routeId: string) => {
    setSelectedRoutes(prev => 
      prev.includes(routeId) 
        ? prev.filter(id => id !== routeId)
        : [...prev, routeId]
    )
  }

  if (routesLoading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="loading-skeleton h-64 w-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-secondary-900">Route Distance Calculator</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setBatchMode(false)}
                className={`btn-sm ${!batchMode ? 'btn-primary' : 'btn-outline'}`}
              >
                Single Route
              </button>
              <button
                onClick={() => setBatchMode(true)}
                className={`btn-sm ${batchMode ? 'btn-primary' : 'btn-outline'}`}
              >
                Batch Mode
              </button>
            </div>
          </div>
        </div>

        <div className="card-body">
          {!batchMode ? (
            // Single Route Mode
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label htmlFor="fromRoute" className="form-label">
                    From Route
                  </label>
                  <select
                    id="fromRoute"
                    value={fromRouteId}
                    onChange={(e) => setFromRouteId(e.target.value)}
                    className="input"
                  >
                    <option value="">Select origin route</option>
                    {routes?.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.route_code} - {route.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="toRoute" className="form-label">
                    To Route
                  </label>
                  <select
                    id="toRoute"
                    value={toRouteId}
                    onChange={(e) => setToRouteId(e.target.value)}
                    className="input"
                  >
                    <option value="">Select destination route</option>
                    {routes?.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.route_code} - {route.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleSingleCalculation}
                  disabled={!fromRouteId || !toRouteId || distanceLoading}
                  className="btn-primary"
                >
                  {distanceLoading ? (
                    <div className="flex items-center">
                      <div className="loading-spinner h-4 w-4 mr-2"></div>
                      Calculating...
                    </div>
                  ) : (
                    'Calculate Distance'
                  )}
                </button>

                {distance && (
                  <button
                    onClick={refresh}
                    disabled={isRefreshing}
                    className="btn-outline"
                  >
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                  </button>
                )}
              </div>

              {/* Results Display */}
              {distance && (
                <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                  <h4 className="font-medium text-success-900 mb-3">Route Distance Results</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center">
                      <MapPinIcon className="h-5 w-5 text-success-600 mr-2" />
                      <div>
                        <p className="text-sm text-success-600">Distance</p>
                        <p className="font-semibold text-success-900">{distance.distance_km} km</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <ClockIcon className="h-5 w-5 text-success-600 mr-2" />
                      <div>
                        <p className="text-sm text-success-600">Travel Time</p>
                        <p className="font-semibold text-success-900">{distance.travel_time_minutes} min</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <TruckIcon className="h-5 w-5 text-success-600 mr-2" />
                      <div>
                        <p className="text-sm text-success-600">Traffic Factor</p>
                        <p className="font-semibold text-success-900">{distance.traffic_factor}x</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {distanceError && (
                <div className="bg-error-50 border border-error-200 rounded-lg p-4">
                  <p className="text-error-800">
                    Error calculating distance: {distanceError.message}
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Batch Mode
            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label">Select Routes for Batch Calculation</label>
                <div className="max-h-64 overflow-y-auto border border-secondary-200 rounded-lg p-3">
                  {routes?.map((route) => (
                    <label key={route.id} className="flex items-center space-x-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedRoutes.includes(route.id)}
                        onChange={() => toggleRouteSelection(route.id)}
                        className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm">
                        {route.route_code} - {route.name}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="form-help">
                  Selected: {selectedRoutes.length} routes
                  {selectedRoutes.length >= 2 && (
                    <span className="ml-2 text-primary-600">
                      ({selectedRoutes.length * (selectedRoutes.length - 1)} route pairs will be calculated)
                    </span>
                  )}
                </p>
              </div>

              <button
                onClick={handleBatchCalculation}
                disabled={selectedRoutes.length < 2 || batchMutation.isPending}
                className="btn-primary"
              >
                {batchMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="loading-spinner h-4 w-4 mr-2"></div>
                    Calculating... ({batchProgress.completed}/{batchProgress.total})
                  </div>
                ) : (
                  'Start Batch Calculation'
                )}
              </button>

              {batchMutation.isPending && batchProgress.total > 0 && (
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-primary-900">Progress</span>
                    <span className="text-sm text-primary-600">
                      {batchProgress.completed} / {batchProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-primary-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(batchProgress.completed / batchProgress.total) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}