import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type RouteRow = Database['public']['Tables']['routes']['Row']

function RoutesList() {
  const [searchTerm, setSearchTerm] = useState('')

  const { data: routes, isLoading, error } = useQuery({
    queryKey: ['routes', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('routes')
        .select(`
          *,
          customers (
            name,
            customer_code
          )
        `)
        .order('created_at', { ascending: false })

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,route_code.ilike.%${searchTerm}%`)
      }

      const { data, error } = await query

      if (error) throw error
      return data
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return 'status-active'
      case 'Inactive':
        return 'status-inactive'
      case 'Suspended':
        return 'status-suspended'
      default:
        return 'badge-secondary'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-secondary-900">Routes</h1>
          <button className="btn-primary">
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Route
          </button>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="loading-skeleton h-64 w-full"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-secondary-900">Routes</h1>
        <div className="card">
          <div className="card-body">
            <p className="text-error-600">Error loading routes: {error.message}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Routes</h1>
        <button className="btn-primary">
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Route
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search routes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Routes Table */}
      <div className="card">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Route Code</th>
                  <th className="table-header-cell">Name</th>
                  <th className="table-header-cell">Customer</th>
                  <th className="table-header-cell">Origin</th>
                  <th className="table-header-cell">Destination</th>
                  <th className="table-header-cell">Region</th>
                  <th className="table-header-cell">Status</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {routes?.map((route) => (
                  <tr key={route.id} className="table-row">
                    <td className="table-cell font-medium">{route.route_code}</td>
                    <td className="table-cell">{route.name}</td>
                    <td className="table-cell">
                      {route.customers?.name || 'N/A'}
                    </td>
                    <td className="table-cell">{route.origin_name || 'N/A'}</td>
                    <td className="table-cell">{route.destination_name || 'N/A'}</td>
                    <td className="table-cell">{route.region || 'N/A'}</td>
                    <td className="table-cell">
                      <span className={`badge ${getStatusBadge(route.status)}`}>
                        {route.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex space-x-2">
                        <button className="btn-ghost text-xs">Edit</button>
                        <button className="btn-ghost text-xs">View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {routes?.length === 0 && (
            <div className="text-center py-12">
              <p className="text-secondary-500">No routes found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RoutesPage() {
  return (
    <Routes>
      <Route index element={<RoutesList />} />
      {/* Add more routes for create, edit, view */}
    </Routes>
  )
}