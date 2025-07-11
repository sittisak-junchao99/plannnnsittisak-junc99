import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  UsersIcon,
  TruckIcon,
  BuildingOfficeIcon,
  MapIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface DashboardStats {
  drivers: number
  vehicles: number
  customers: number
  routes: number
  schedules: number
  conflicts: number
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const [
        driversResult,
        vehiclesResult,
        customersResult,
        routesResult,
        schedulesResult,
        conflictsResult,
      ] = await Promise.all([
        supabase.from('drivers').select('id', { count: 'exact', head: true }),
        supabase.from('vehicles').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('routes').select('id', { count: 'exact', head: true }),
        supabase.from('route_schedules').select('id', { count: 'exact', head: true }),
        supabase.from('conflict_checks').select('id', { count: 'exact', head: true }).eq('status', 'Open'),
      ])

      return {
        drivers: driversResult.count || 0,
        vehicles: vehiclesResult.count || 0,
        customers: customersResult.count || 0,
        routes: routesResult.count || 0,
        schedules: schedulesResult.count || 0,
        conflicts: conflictsResult.count || 0,
      }
    },
  })

  const statCards = [
    {
      name: 'Drivers',
      value: stats?.drivers || 0,
      icon: UsersIcon,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
    {
      name: 'Vehicles',
      value: stats?.vehicles || 0,
      icon: TruckIcon,
      color: 'text-success-600',
      bgColor: 'bg-success-50',
    },
    {
      name: 'Customers',
      value: stats?.customers || 0,
      icon: BuildingOfficeIcon,
      color: 'text-warning-600',
      bgColor: 'bg-warning-50',
    },
    {
      name: 'Routes',
      value: stats?.routes || 0,
      icon: MapIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      name: 'Schedules',
      value: stats?.schedules || 0,
      icon: CalendarIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      name: 'Open Conflicts',
      value: stats?.conflicts || 0,
      icon: ExclamationTriangleIcon,
      color: 'text-error-600',
      bgColor: 'bg-error-50',
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-secondary-900">Dashboard</h1>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card">
              <div className="card-body">
                <div className="loading-skeleton h-16 w-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Dashboard</h1>
        <div className="text-sm text-secondary-500">
          Welcome to Transport Planner
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <div key={stat.name} className="card hover:shadow-md transition-shadow">
            <div className="card-body">
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-secondary-600">{stat.name}</p>
                  <p className="text-2xl font-semibold text-secondary-900">{stat.value}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-secondary-900">Recent Schedules</h3>
          </div>
          <div className="card-body">
            <p className="text-secondary-500">No recent schedules to display.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-secondary-900">System Alerts</h3>
          </div>
          <div className="card-body">
            <p className="text-secondary-500">No alerts at this time.</p>
          </div>
        </div>
      </div>
    </div>
  )
}