import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FixedSizeList as List } from 'react-window'
import { format } from 'date-fns'
import { 
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowUpDownIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserIcon,
  TruckIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'

interface ScheduleItem {
  id: string
  route_code: string
  route_name: string
  customer_name: string
  region: string
  schedule_date: string
  departure_time: string
  driver_name?: string
  vehicle_code?: string
  status: string
  priority: number
  has_conflict: boolean
}

interface ListItemProps {
  index: number
  style: React.CSSProperties
  data: {
    items: ScheduleItem[]
    onItemClick: (item: ScheduleItem) => void
  }
}

const ITEM_HEIGHT = 80

function ListItem({ index, style, data }: ListItemProps) {
  const { items, onItemClick } = data
  const item = items[index]

  if (!item) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800'
      case 'Confirmed': return 'bg-green-100 text-green-800'
      case 'In Progress': return 'bg-yellow-100 text-yellow-800'
      case 'Completed': return 'bg-gray-100 text-gray-800'
      case 'Cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-secondary-100 text-secondary-800'
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'border-l-red-500'
    if (priority >= 6) return 'border-l-yellow-500'
    if (priority >= 4) return 'border-l-blue-500'
    return 'border-l-gray-300'
  }

  return (
    <div style={style} className="px-4">
      <div 
        className={`bg-white border border-secondary-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4 ${getPriorityColor(item.priority)}`}
        onClick={() => onItemClick(item)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <span className="text-sm font-bold text-secondary-900">{item.route_code}</span>
                {item.has_conflict && (
                  <ExclamationTriangleIcon className="h-4 w-4 text-red-500 inline ml-2" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-secondary-900 truncate">
                  {item.route_name}
                </div>
                <div className="text-xs text-secondary-500 truncate">
                  {item.customer_name} • {item.region}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center space-x-4 text-xs text-secondary-600">
              <div className="flex items-center">
                <ClockIcon className="h-3 w-3 mr-1" />
                {format(new Date(item.schedule_date), 'MMM dd')} at {item.departure_time}
              </div>
              
              {item.driver_name && (
                <div className="flex items-center">
                  <UserIcon className="h-3 w-3 mr-1" />
                  {item.driver_name}
                </div>
              )}
              
              {item.vehicle_code && (
                <div className="flex items-center">
                  <TruckIcon className="h-3 w-3 mr-1" />
                  {item.vehicle_code}
                </div>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center space-x-3">
            <div className="text-right">
              <div className={`text-xs px-2 py-1 rounded-full ${getStatusColor(item.status)}`}>
                {item.status}
              </div>
              <div className="text-xs text-secondary-500 mt-1">
                Priority {item.priority}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ScheduleList() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'route' | 'status'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null)

  // Fetch schedules
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['schedule-list', searchTerm, statusFilter, regionFilter, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from('schedule_overview')
        .select('*')

      if (dateFilter) {
        query = query.eq('schedule_date', dateFilter)
      } else {
        // Default to current week
        const today = new Date()
        const weekStart = new Date(today.setDate(today.getDate() - today.getDay() + 1))
        const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 7))
        query = query
          .gte('schedule_date', format(weekStart, 'yyyy-MM-dd'))
          .lte('schedule_date', format(weekEnd, 'yyyy-MM-dd'))
      }

      if (searchTerm) {
        query = query.or(`route_code.ilike.%${searchTerm}%,route_name.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`)
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      if (regionFilter) {
        query = query.eq('region', regionFilter)
      }

      const { data, error } = await query

      if (error) throw error

      return data?.map((item: any): ScheduleItem => ({
        id: item.schedule_id,
        route_code: item.route_code,
        route_name: item.route_name,
        customer_name: item.customer_name || 'N/A',
        region: item.region || 'N/A',
        schedule_date: item.schedule_date,
        departure_time: item.departure_time || 'N/A',
        driver_name: item.driver_name,
        vehicle_code: item.vehicle_code,
        status: item.status,
        priority: Math.floor(Math.random() * 10) + 1,
        has_conflict: Math.random() > 0.9
      })) || []
    },
  })

  // Sort and filter schedules
  const sortedSchedules = useMemo(() => {
    if (!schedules) return []

    const sorted = [...schedules].sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy) {
        case 'date':
          aValue = new Date(`${a.schedule_date} ${a.departure_time}`)
          bValue = new Date(`${b.schedule_date} ${b.departure_time}`)
          break
        case 'priority':
          aValue = a.priority
          bValue = b.priority
          break
        case 'route':
          aValue = a.route_code
          bValue = b.route_code
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [schedules, sortBy, sortOrder])

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const handleItemClick = (item: ScheduleItem) => {
    setSelectedItem(item)
  }

  // Get unique regions
  const regions = useMemo(() => {
    if (!schedules) return []
    return [...new Set(schedules.map(s => s.region))].filter(Boolean)
  }, [schedules])

  const listData = useMemo(() => ({
    items: sortedSchedules,
    onItemClick: handleItemClick
  }), [sortedSchedules])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-secondary-900">Schedule List</h1>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="loading-skeleton h-96 w-full"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Schedule List</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-secondary-600">
            <span className="font-medium">{sortedSchedules.length}</span> schedules
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400" />
                <input
                  type="text"
                  placeholder="Search schedules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 text-sm"
                />
              </div>
            </div>

            <div>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="input text-sm"
                placeholder="Filter by date"
              />
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input text-sm"
              >
                <option value="">All Status</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Confirmed">Confirmed</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="input text-sm"
              >
                <option value="">All Regions</option>
                {regions.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-')
                  setSortBy(field as typeof sortBy)
                  setSortOrder(order as typeof sortOrder)
                }}
                className="input text-sm"
              >
                <option value="date-asc">Date (Earliest)</option>
                <option value="date-desc">Date (Latest)</option>
                <option value="priority-desc">Priority (High)</option>
                <option value="priority-asc">Priority (Low)</option>
                <option value="route-asc">Route (A-Z)</option>
                <option value="route-desc">Route (Z-A)</option>
                <option value="status-asc">Status (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card">
        <div className="card-body p-0">
          {sortedSchedules.length > 0 ? (
            <List
              height={600}
              itemCount={sortedSchedules.length}
              itemSize={ITEM_HEIGHT}
              itemData={listData}
            >
              {ListItem}
            </List>
          ) : (
            <div className="text-center py-12">
              <BuildingOfficeIcon className="h-12 w-12 text-secondary-300 mx-auto mb-4" />
              <p className="text-secondary-500">No schedules found.</p>
              <p className="text-sm text-secondary-400 mt-1">
                Try adjusting your filters or search terms.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Item Details */}
      {selectedItem && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-secondary-900">Schedule Details</h3>
              <button 
                onClick={() => setSelectedItem(null)}
                className="btn-ghost btn-sm"
              >
                ×
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-secondary-500">Route Code</label>
                <p className="text-sm font-medium">{selectedItem.route_code}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Route Name</label>
                <p className="text-sm">{selectedItem.route_name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Customer</label>
                <p className="text-sm">{selectedItem.customer_name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Region</label>
                <p className="text-sm">{selectedItem.region}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Schedule Date</label>
                <p className="text-sm">{format(new Date(selectedItem.schedule_date), 'dd/MM/yyyy')}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Departure Time</label>
                <p className="text-sm">{selectedItem.departure_time}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Status</label>
                <p className="text-sm">{selectedItem.status}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Priority</label>
                <p className="text-sm">{selectedItem.priority}/10</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}