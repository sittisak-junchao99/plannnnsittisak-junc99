import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { FixedSizeGrid as Grid } from 'react-window'
import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  CalendarIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface ScheduleItem {
  id: string
  route_code: string
  route_name: string
  customer_name: string
  region: string
  departure_time: string
  driver_name?: string
  vehicle_code?: string
  status: 'Scheduled' | 'Confirmed' | 'In Progress' | 'Completed' | 'Cancelled'
  has_conflict: boolean
  priority: number
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
  }
}

const CELL_WIDTH = 280
const CELL_HEIGHT = 60
const HEADER_HEIGHT = 80

// Virtual Grid Cell Component
function GridCell({ columnIndex, rowIndex, style, data }: GridCellProps) {
  const { schedules, dates, onCellClick, onCellDoubleClick } = data
  
  if (rowIndex === 0) {
    // Header row
    const date = dates[columnIndex]
    const isToday = isSameDay(date, new Date())
    
    return (
      <div style={style} className={`border-r border-b border-secondary-200 bg-secondary-50 flex items-center justify-center font-medium ${isToday ? 'bg-primary-50 text-primary-700' : 'text-secondary-700'}`}>
        <div className="text-center">
          <div className="text-sm">{format(date, 'EEE')}</div>
          <div className="text-lg">{format(date, 'dd')}</div>
          <div className="text-xs">{format(date, 'MMM')}</div>
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
      className={`border-r border-b border-secondary-200 bg-white hover:bg-secondary-50 cursor-pointer transition-colors ${getPriorityIndicator(schedule.priority)}`}
      onClick={() => onCellClick(schedule)}
      onDoubleClick={() => onCellDoubleClick(schedule)}
    >
      <div className="p-2 h-full flex flex-col justify-between">
        <div className="flex-1 min-h-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-secondary-900 truncate">
              {schedule.route_code}
            </span>
            {schedule.has_conflict && (
              <ExclamationTriangleIcon className="h-3 w-3 text-red-500 flex-shrink-0" />
            )}
          </div>
          <div className="text-xs text-secondary-600 truncate mb-1">
            {schedule.route_name}
          </div>
          <div className="text-xs text-secondary-500 truncate">
            {schedule.customer_name}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-secondary-600">
            {schedule.departure_time}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${getStatusColor(schedule.status)}`}>
            {schedule.status}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function ScheduleGrid() {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [regionFilter, setRegionFilter] = useState<string>('')
  const [showConflictsOnly, setShowConflictsOnly] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null)
  const gridRef = useRef<Grid>(null)

  // Generate week dates
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i))
  }, [currentWeek])

  // Fetch schedules for the current week
  const { data: schedules, isLoading, refetch } = useQuery({
    queryKey: ['schedule-grid', currentWeek, searchTerm, statusFilter, regionFilter, showConflictsOnly],
    queryFn: async () => {
      const startDate = format(currentWeek, 'yyyy-MM-dd')
      const endDate = format(addDays(currentWeek, 6), 'yyyy-MM-dd')

      let query = supabase
        .from('schedule_overview')
        .select('*')
        .gte('schedule_date', startDate)
        .lte('schedule_date', endDate)
        .order('departure_time')

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

      // Group schedules by date
      const groupedSchedules: ScheduleItem[][] = weekDates.map(() => [])
      
      data?.forEach((item: any) => {
        const scheduleDate = new Date(item.schedule_date)
        const dayIndex = weekDates.findIndex(date => isSameDay(date, scheduleDate))
        
        if (dayIndex !== -1) {
          const schedule: ScheduleItem = {
            id: item.schedule_id,
            route_code: item.route_code,
            route_name: item.route_name,
            customer_name: item.customer_name || 'N/A',
            region: item.region || 'N/A',
            departure_time: item.departure_time || 'N/A',
            driver_name: item.driver_name,
            vehicle_code: item.vehicle_code,
            status: item.status,
            has_conflict: Math.random() > 0.9, // Simulate conflicts
            priority: Math.floor(Math.random() * 10) + 1
          }

          if (!showConflictsOnly || schedule.has_conflict) {
            groupedSchedules[dayIndex].push(schedule)
          }
        }
      })

      return groupedSchedules
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  // Calculate grid dimensions
  const maxRowsPerDay = useMemo(() => {
    if (!schedules) return 0
    return Math.max(...schedules.map(day => day.length), 10) // Minimum 10 rows
  }, [schedules])

  const gridData = useMemo(() => ({
    schedules: schedules || [],
    dates: weekDates,
    onCellClick: (schedule: ScheduleItem) => {
      setSelectedSchedule(schedule)
    },
    onCellDoubleClick: (schedule: ScheduleItem) => {
      // Open edit modal or navigate to edit page
      toast.success(`Opening ${schedule.route_code} for editing`)
    }
  }), [schedules, weekDates])

  const handlePreviousWeek = () => {
    setCurrentWeek(prev => addDays(prev, -7))
  }

  const handleNextWeek = () => {
    setCurrentWeek(prev => addDays(prev, 7))
  }

  const handleToday = () => {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))
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

  const totalSchedules = useMemo(() => {
    return schedules?.reduce((total, day) => total + day.length, 0) || 0
  }, [schedules])

  const conflictCount = useMemo(() => {
    return schedules?.reduce((total, day) => 
      total + day.filter(s => s.has_conflict).length, 0
    ) || 0
  }, [schedules])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-secondary-900">Schedule Grid</h1>
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
        <h1 className="text-2xl font-bold text-secondary-900">Schedule Grid</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-secondary-600">
            <span className="font-medium">{totalSchedules}</span> schedules
            {conflictCount > 0 && (
              <span className="ml-2 text-red-600">
                <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
                {conflictCount} conflicts
              </span>
            )}
          </div>
          <button onClick={() => refetch()} className="btn-outline btn-sm">
            Refresh
          </button>
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
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
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
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
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
                  checked={showConflictsOnly}
                  onChange={(e) => setShowConflictsOnly(e.target.checked)}
                  className="rounded border-secondary-300 text-red-600 focus:ring-red-500"
                />
                <span>Conflicts only</span>
              </label>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
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
              <ExclamationTriangleIcon className="h-3 w-3 text-red-500" />
              <span>Has Conflict</span>
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
                <label className="text-xs font-medium text-secondary-500">Departure Time</label>
                <p className="text-sm">{selectedSchedule.departure_time}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Driver</label>
                <p className="text-sm">{selectedSchedule.driver_name || 'Not assigned'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Vehicle</label>
                <p className="text-sm">{selectedSchedule.vehicle_code || 'Not assigned'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Status</label>
                <p className="text-sm">{selectedSchedule.status}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-500">Priority</label>
                <p className="text-sm">{selectedSchedule.priority}/10</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}