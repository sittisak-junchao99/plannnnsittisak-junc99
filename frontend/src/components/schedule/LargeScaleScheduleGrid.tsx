/**
 * Large Scale Schedule Grid Component
 * Optimized for handling 400+ routes per day with virtual scrolling and performance optimizations
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { FixedSizeGrid as Grid } from 'react-window'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns'
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  CalendarIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface ScheduleItem {
  route_schedule_id: string
  route_code: string
  route_name: string
  customer_name: string
  region: string
  standby_date: string
  standby_time: string
  departure_date: string
  departure_time: string
  driver_name?: string
  vehicle_code?: string
  status: 'Scheduled' | 'Confirmed' | 'In Progress' | 'Completed' | 'Cancelled'
  is_override: boolean
  is_cross_day_departure: boolean
  priority: number
  instance_id?: string
}

interface GridCellProps {
  columnIndex: number
  rowIndex: number
  style: React.CSSProperties
  data: {
    schedules: ScheduleItem[][]
    dates: Date[]
    onCellClick: (schedule: ScheduleItem) => void
    onCellDoubleClick: (schedule: ScheduleItem) => void
    filters: FilterState
  }
}

interface FilterState {
  region: string
  status: string
  showOverridesOnly: boolean
  showCrossDayOnly: boolean
  driverFilter: string
}

const CELL_WIDTH = 320
const CELL_HEIGHT = 80
const HEADER_HEIGHT = 100

// Virtual Grid Cell Component
function GridCell({ columnIndex, rowIndex, style, data }: GridCellProps) {
  const { schedules, dates, onCellClick, onCellDoubleClick, filters } = data
  
  if (rowIndex === 0) {
    // Header row
    const date = dates[columnIndex]
    const isToday = isSameDay(date, new Date())
    const daySchedules = schedules[columnIndex] || []
    const totalCount = daySchedules.length
    const overrideCount = daySchedules.filter(s => s.is_override).length
    const crossDayCount = daySchedules.filter(s => s.is_cross_day_departure).length
    
    return (
      <div style={style} className={`border-r border-b border-secondary-200 bg-secondary-50 flex flex-col justify-center p-3 ${isToday ? 'bg-primary-50 border-primary-200' : ''}`}>
        <div className="text-center">
          <div className="text-sm font-medium text-secondary-700">{format(date, 'EEE')}</div>
          <div className="text-xl font-bold text-secondary-900">{format(date, 'dd')}</div>
          <div className="text-xs text-secondary-500">{format(date, 'MMM')}</div>
          
          <div className="mt-2 space-y-1">
            <div className="text-xs text-secondary-600">
              {totalCount} routes
            </div>
            {overrideCount > 0 && (
              <div className="text-xs text-warning-600">
                {overrideCount} overrides
              </div>
            )}
            {crossDayCount > 0 && (
              <div className="text-xs text-blue-600">
                {crossDayCount} cross-day
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const daySchedules = schedules[columnIndex] || []
  const schedule = daySchedules[rowIndex - 1]

  if (!schedule) {
    return (
      <div style={style} className="border-r border-b border-secondary-200 bg-white hover:bg-secondary-50 cursor-pointer">
        <div className="h-full flex items-center justify-center text-secondary-300">
          <span className="text-xs">Empty</span>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Confirmed': return 'bg-green-100 text-green-800 border-green-200'
      case 'In Progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Completed': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-secondary-100 text-secondary-800 border-secondary-200'
    }
  }

  const getPriorityIndicator = (priority: number) => {
    if (priority >= 8) return 'border-l-4 border-l-red-500'
    if (priority >= 6) return 'border-l-4 border-l-yellow-500'
    if (priority >= 4) return 'border-l-4 border-l-blue-500'
    return 'border-l-4 border-l-gray-300'
  }

  return (
    <div 
      style={style} 
      className={`border-r border-b border-secondary-200 bg-white hover:bg-secondary-50 cursor-pointer transition-colors ${getPriorityIndicator(schedule.priority)} ${schedule.is_override ? 'bg-yellow-50' : ''}`}
      onClick={() => onCellClick(schedule)}
      onDoubleClick={() => onCellDoubleClick(schedule)}
    >
      <div className="p-3 h-full flex flex-col justify-between">
        <div className="flex-1 min-h-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-secondary-900 truncate">
              {schedule.route_code}
            </span>
            <div className="flex items-center space-x-1">
              {schedule.is_override && (
                <Cog6ToothIcon className="h-3 w-3 text-warning-600" title="Override" />
              )}
              {schedule.is_cross_day_departure && (
                <ArrowRightIcon className="h-3 w-3 text-blue-600" title="Cross-day departure" />
              )}
            </div>
          </div>
          
          <div className="text-xs text-secondary-600 truncate mb-1">
            {schedule.route_name}
          </div>
          
          <div className="text-xs text-secondary-500 truncate mb-1">
            {schedule.customer_name}
          </div>
          
          {schedule.is_cross_day_departure && (
            <div className="text-xs text-blue-600 mb-1">
              Standby: {schedule.standby_time} → Depart: {schedule.departure_time}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-xs text-secondary-600">
            {schedule.is_cross_day_departure ? (
              <span>
                {format(parseISO(schedule.standby_date), 'dd/MM')} → {format(parseISO(schedule.departure_date), 'dd/MM')}
              </span>
            ) : (
              schedule.departure_time
            )}
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${getStatusColor(schedule.status)}`}>
            {schedule.status}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function LargeScaleScheduleGrid() {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<FilterState>({
    region: '',
    status: '',
    showOverridesOnly: false,
    showCrossDayOnly: false,
    driverFilter: ''
  })
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null)
  const [pageSize, setPageSize] = useState(50) // For pagination
  const [currentPage, setCurrentPage] = useState(0)
  const gridRef = useRef<Grid>(null)
  const queryClient = useQueryClient()

  // Generate week dates
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i))
  }, [currentWeek])

  // Fetch schedules with pagination and filtering
  const { data: schedulesData, isLoading, refetch } = useQuery({
    queryKey: ['large-scale-schedule-grid', currentWeek, searchTerm, filters, currentPage, pageSize],
    queryFn: async () => {
      const startDate = format(currentWeek, 'yyyy-MM-dd')
      const endDate = format(addDays(currentWeek, 6), 'yyyy-MM-dd')

      let query = supabase
        .from('schedule_overview')
        .select('*', { count: 'exact' })
        .gte('departure_date', startDate)
        .lte('departure_date', endDate)
        .order('departure_time')
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1)

      if (searchTerm) {
        query = query.or(`route_code.ilike.%${searchTerm}%,route_name.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`)
      }

      if (filters.region) {
        query = query.eq('region', filters.region)
      }

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      if (filters.showOverridesOnly) {
        query = query.eq('is_override', true)
      }

      if (filters.showCrossDayOnly) {
        query = query.eq('is_cross_day_departure', true)
      }

      if (filters.driverFilter) {
        query = query.ilike('driver_name', `%${filters.driverFilter}%`)
      }

      const { data, error, count } = await query

      if (error) throw error

      // Group schedules by departure date
      const groupedSchedules: ScheduleItem[][] = weekDates.map(() => [])
      
      data?.forEach((item: any) => {
        const departureDate = new Date(item.departure_date)
        const dayIndex = weekDates.findIndex(date => isSameDay(date, departureDate))
        
        if (dayIndex !== -1) {
          const schedule: ScheduleItem = {
            route_schedule_id: item.route_schedule_id,
            route_code: item.route_code,
            route_name: item.route_name,
            customer_name: item.customer_name || 'N/A',
            region: item.region || 'N/A',
            standby_date: item.standby_date,
            standby_time: item.standby_time || 'N/A',
            departure_date: item.departure_date,
            departure_time: item.departure_time || 'N/A',
            driver_name: item.driver_name,
            vehicle_code: item.vehicle_code,
            status: item.status,
            is_override: item.is_override || false,
            is_cross_day_departure: item.is_cross_day_departure || false,
            priority: Math.floor(Math.random() * 10) + 1, // Simulate priority
            instance_id: item.instance_id
          }

          groupedSchedules[dayIndex].push(schedule)
        }
      })

      return {
        schedules: groupedSchedules,
        totalCount: count || 0
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  // Calculate grid dimensions
  const maxRowsPerDay = useMemo(() => {
    if (!schedulesData?.schedules) return 0
    return Math.max(...schedulesData.schedules.map(day => day.length), 20) // Minimum 20 rows for large scale
  }, [schedulesData?.schedules])

  const gridData = useMemo(() => ({
    schedules: schedulesData?.schedules || [],
    dates: weekDates,
    filters,
    onCellClick: (schedule: ScheduleItem) => {
      setSelectedSchedule(schedule)
    },
    onCellDoubleClick: (schedule: ScheduleItem) => {
      // Open edit modal or navigate to edit page
      toast.success(`Opening ${schedule.route_code} for editing`)
    }
  }), [schedulesData?.schedules, weekDates, filters])

  // Bulk operations
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ instanceIds, updates }: { instanceIds: string[], updates: any }) => {
      const { error } = await supabase
        .from('schedule_instances')
        .update(updates)
        .in('id', instanceIds)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['large-scale-schedule-grid'] })
      toast.success('Bulk update completed!')
    },
    onError: (error: any) => {
      toast.error(`Bulk update failed: ${error.message}`)
    },
  })

  const handlePreviousWeek = () => {
    setCurrentWeek(prev => addDays(prev, -7))
    setCurrentPage(0) // Reset pagination
  }

  const handleNextWeek = () => {
    setCurrentWeek(prev => addDays(prev, 7))
    setCurrentPage(0) // Reset pagination
  }

  const handleToday = () => {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))
    setCurrentPage(0) // Reset pagination
  }

  // Get unique regions for filter
  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('region')
        .not('region', 'is', null)
        .order('region')

      if (error) throw error
      return [...new Set(data.map(r => r.region))]
    },
  })

  const totalSchedules = schedulesData?.totalCount || 0
  const overrideCount = useMemo(() => {
    return schedulesData?.schedules?.reduce((total, day) => 
      total + day.filter(s => s.is_override).length, 0
    ) || 0
  }, [schedulesData?.schedules])

  const crossDayCount = useMemo(() => {
    return schedulesData?.schedules?.reduce((total, day) => 
      total + day.filter(s => s.is_cross_day_departure).length, 0
    ) || 0
  }, [schedulesData?.schedules])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-secondary-900">Large Scale Schedule Grid</h1>
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
        <h1 className="text-2xl font-bold text-secondary-900">Large Scale Schedule Grid</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-secondary-600">
            <span className="font-medium">{totalSchedules}</span> total schedules
            {overrideCount > 0 && (
              <span className="ml-2 text-warning-600">
                <Cog6ToothIcon className="h-4 w-4 inline mr-1" />
                {overrideCount} overrides
              </span>
            )}
            {crossDayCount > 0 && (
              <span className="ml-2 text-blue-600">
                <ArrowRightIcon className="h-4 w-4 inline mr-1" />
                {crossDayCount} cross-day
              </span>
            )}
          </div>
          <button onClick={() => refetch()} className="btn-outline btn-sm">
            Refresh
          </button>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <CalendarIcon className="h-5 w-5 text-blue-600 mt-0.5" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-900">Large Scale Performance</h3>
            <div className="mt-1 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Virtual scrolling enabled for smooth performance with 400+ routes</li>
                <li>Pagination: Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, totalSchedules)} of {totalSchedules}</li>
                <li>Cross-day departures automatically calculated and highlighted</li>
                <li>Override tracking for schedule modifications</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Week Navigation */}
            <div className="flex items-center space-x-2">
              <button onClick={handlePreviousWeek} className="btn-outline btn-sm">
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button onClick={handleToday} className="btn-outline btn-sm">
                <CalendarIcon className="h-4 w-4 mr-1" />
                Today
              </button>
              <button onClick={handleNextWeek} className="btn-outline btn-sm">
                <ChevronRightIcon className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium text-secondary-700 ml-4">
                {format(currentWeek, 'MMM dd')} - {format(addDays(currentWeek, 6), 'MMM dd, yyyy')}
              </span>
            </div>

            {/* Filters */}
            <div className="flex flex-1 items-center space-x-3">
              <div className="relative flex-1 max-w-xs">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400" />
                <input
                  type="text"
                  placeholder="Search routes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 text-sm"
                />
              </div>

              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="input text-sm w-32"
              >
                <option value="">All Status</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Confirmed">Confirmed</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <select
                value={filters.region}
                onChange={(e) => setFilters(prev => ({ ...prev, region: e.target.value }))}
                className="input text-sm w-32"
              >
                <option value="">All Regions</option>
                {regions?.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>

              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.showOverridesOnly}
                  onChange={(e) => setFilters(prev => ({ ...prev, showOverridesOnly: e.target.checked }))}
                  className="rounded border-secondary-300 text-warning-600 focus:ring-warning-500"
                />
                <span>Overrides only</span>
              </label>

              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.showCrossDayOnly}
                  onChange={(e) => setFilters(prev => ({ ...prev, showCrossDayOnly: e.target.checked }))}
                  className="rounded border-secondary-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Cross-day only</span>
              </label>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-secondary-200">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-secondary-600">Page size:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(0)
                }}
                className="input text-sm w-20"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
                className="btn-outline btn-sm"
              >
                Previous
              </button>
              <span className="text-sm text-secondary-600">
                Page {currentPage + 1} of {Math.ceil(totalSchedules / pageSize)}
              </span>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={(currentPage + 1) * pageSize >= totalSchedules}
                className="btn-outline btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="card">
        <div className="card-body p-0">
          <div className="border border-secondary-200 rounded-lg overflow-hidden">
            <Grid
              ref={gridRef}
              columnCount={7}
              rowCount={maxRowsPerDay + 1} // +1 for header
              columnWidth={CELL_WIDTH}
              rowHeight={(index) => index === 0 ? HEADER_HEIGHT : CELL_HEIGHT}
              height={Math.min(800, HEADER_HEIGHT + (maxRowsPerDay * CELL_HEIGHT))}
              width={7 * CELL_WIDTH}
              itemData={gridData}
            >
              {GridCell}
            </Grid>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="card">
        <div className="card-body">
          <h3 className="text-sm font-medium text-secondary-900 mb-3">Legend</h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 border-l-4 border-l-red-500 bg-white border border-secondary-200"></div>
              <span>High Priority (8-10)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 border-l-4 border-l-yellow-500 bg-white border border-secondary-200"></div>
              <span>Medium Priority (6-7)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 border-l-4 border-l-blue-500 bg-white border border-secondary-200"></div>
              <span>Normal Priority (4-5)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Cog6ToothIcon className="h-3 w-3 text-warning-600" />
              <span>Schedule Override</span>
            </div>
            <div className="flex items-center space-x-2">
              <ArrowRightIcon className="h-3 w-3 text-blue-600" />
              <span>Cross-day Departure</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Schedule Details */}
      {selectedSchedule && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-secondary-900">Schedule Details</h3>
              <button 
                onClick={() => setSelectedSchedule(null)}
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
                <p className="text-sm font-medium">{selectedSchedule.route_code}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Route Name</label>
                <p className="text-sm">{selectedSchedule.route_name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Customer</label>
                <p className="text-sm">{selectedSchedule.customer_name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Region</label>
                <p className="text-sm">{selectedSchedule.region}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Standby</label>
                <p className="text-sm">{selectedSchedule.standby_date} {selectedSchedule.standby_time}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Departure</label>
                <p className="text-sm">{selectedSchedule.departure_date} {selectedSchedule.departure_time}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Status</label>
                <p className="text-sm">{selectedSchedule.status}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Type</label>
                <div className="flex items-center space-x-2">
                  {selectedSchedule.is_override && (
                    <span className="badge badge-warning">Override</span>
                  )}
                  {selectedSchedule.is_cross_day_departure && (
                    <span className="badge badge-primary">Cross-day</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}