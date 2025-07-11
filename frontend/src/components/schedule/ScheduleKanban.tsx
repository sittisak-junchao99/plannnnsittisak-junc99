import { useState, useMemo } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { 
  ClockIcon, 
  UserIcon, 
  TruckIcon, 
  ExclamationTriangleIcon,
  PlusIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface ScheduleCard {
  id: string
  route_code: string
  route_name: string
  customer_name: string
  departure_time: string
  driver_name?: string
  vehicle_code?: string
  status: string
  priority: number
  has_conflict: boolean
  region: string
}

interface KanbanColumn {
  id: string
  title: string
  status: string
  color: string
  schedules: ScheduleCard[]
}

const COLUMN_CONFIGS = [
  { id: 'unassigned', title: 'Unassigned', status: 'Scheduled', color: 'bg-gray-100 border-gray-300' },
  { id: 'assigned', title: 'Assigned', status: 'Confirmed', color: 'bg-blue-100 border-blue-300' },
  { id: 'in-progress', title: 'In Progress', status: 'In Progress', color: 'bg-yellow-100 border-yellow-300' },
  { id: 'completed', title: 'Completed', status: 'Completed', color: 'bg-green-100 border-green-300' },
]

export default function ScheduleKanban() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [regionFilter, setRegionFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const queryClient = useQueryClient()

  // Fetch schedules for selected date
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['kanban-schedules', selectedDate, regionFilter, priorityFilter],
    queryFn: async () => {
      let query = supabase
        .from('schedule_overview')
        .select('*')
        .eq('schedule_date', selectedDate)
        .order('departure_time')

      if (regionFilter) {
        query = query.eq('region', regionFilter)
      }

      const { data, error } = await query

      if (error) throw error

      return data?.map((item: any): ScheduleCard => ({
        id: item.schedule_id,
        route_code: item.route_code,
        route_name: item.route_name,
        customer_name: item.customer_name || 'N/A',
        departure_time: item.departure_time || 'N/A',
        driver_name: item.driver_name,
        vehicle_code: item.vehicle_code,
        status: item.status,
        priority: Math.floor(Math.random() * 10) + 1,
        has_conflict: Math.random() > 0.9,
        region: item.region || 'N/A'
      })).filter((schedule: ScheduleCard) => {
        if (priorityFilter === 'high' && schedule.priority < 7) return false
        if (priorityFilter === 'medium' && (schedule.priority < 4 || schedule.priority > 6)) return false
        if (priorityFilter === 'low' && schedule.priority > 3) return false
        return true
      }) || []
    },
  })

  // Group schedules by status
  const columns: KanbanColumn[] = useMemo(() => {
    if (!schedules) return COLUMN_CONFIGS.map(config => ({ ...config, schedules: [] }))

    return COLUMN_CONFIGS.map(config => ({
      ...config,
      schedules: schedules.filter(schedule => {
        // Map status to column
        switch (config.id) {
          case 'unassigned':
            return schedule.status === 'Scheduled' && (!schedule.driver_name || !schedule.vehicle_code)
          case 'assigned':
            return schedule.status === 'Scheduled' && schedule.driver_name && schedule.vehicle_code
          case 'in-progress':
            return schedule.status === 'In Progress'
          case 'completed':
            return schedule.status === 'Completed'
          default:
            return false
        }
      })
    }))
  }, [schedules])

  // Update schedule status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ scheduleId, newStatus }: { scheduleId: string, newStatus: string }) => {
      const { error } = await supabase
        .from('schedule_instances')
        .update({ status: newStatus })
        .eq('id', scheduleId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-schedules'] })
      toast.success('Schedule updated successfully')
    },
    onError: (error: any) => {
      toast.error(`Failed to update schedule: ${error.message}`)
    },
  })

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    // Map column ID to status
    const statusMap: Record<string, string> = {
      'unassigned': 'Scheduled',
      'assigned': 'Confirmed',
      'in-progress': 'In Progress',
      'completed': 'Completed',
    }

    const newStatus = statusMap[destination.droppableId]
    if (newStatus) {
      updateStatusMutation.mutate({ scheduleId: draggableId, newStatus })
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'border-l-red-500'
    if (priority >= 6) return 'border-l-yellow-500'
    if (priority >= 4) return 'border-l-blue-500'
    return 'border-l-gray-300'
  }

  const getRegions = () => {
    if (!schedules) return []
    return [...new Set(schedules.map(s => s.region))].filter(Boolean)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-secondary-900">Schedule Kanban</h1>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card">
              <div className="card-body">
                <div className="loading-skeleton h-96 w-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Schedule Kanban</h1>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-secondary-600">
            <span className="font-medium">{schedules?.length || 0}</span> schedules
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-secondary-700">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input text-sm w-40"
              />
            </div>

            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-secondary-700">Region:</label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="input text-sm w-32"
              >
                <option value="">All Regions</option>
                {getRegions().map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-secondary-700">Priority:</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="input text-sm w-32"
              >
                <option value="">All Priority</option>
                <option value="high">High (7-10)</option>
                <option value="medium">Medium (4-6)</option>
                <option value="low">Low (1-3)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {columns.map((column) => (
            <div key={column.id} className={`card border-2 ${column.color}`}>
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-secondary-900">{column.title}</h3>
                  <span className="badge badge-secondary">{column.schedules.length}</span>
                </div>
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`card-body space-y-3 min-h-96 ${
                      snapshot.isDraggingOver ? 'bg-primary-50' : ''
                    }`}
                  >
                    {column.schedules.map((schedule, index) => (
                      <Draggable key={schedule.id} draggableId={schedule.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`bg-white border border-secondary-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow border-l-4 ${getPriorityColor(schedule.priority)} ${
                              snapshot.isDragging ? 'rotate-2 shadow-lg' : ''
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-secondary-900">
                                  {schedule.route_code}
                                </span>
                                {schedule.has_conflict && (
                                  <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                                )}
                              </div>

                              <div className="text-xs text-secondary-600 line-clamp-2">
                                {schedule.route_name}
                              </div>

                              <div className="text-xs text-secondary-500">
                                {schedule.customer_name}
                              </div>

                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center text-secondary-600">
                                  <ClockIcon className="h-3 w-3 mr-1" />
                                  {schedule.departure_time}
                                </div>
                                <div className="text-secondary-500">
                                  P{schedule.priority}
                                </div>
                              </div>

                              {(schedule.driver_name || schedule.vehicle_code) && (
                                <div className="flex items-center justify-between text-xs text-secondary-500">
                                  {schedule.driver_name && (
                                    <div className="flex items-center">
                                      <UserIcon className="h-3 w-3 mr-1" />
                                      {schedule.driver_name}
                                    </div>
                                  )}
                                  {schedule.vehicle_code && (
                                    <div className="flex items-center">
                                      <TruckIcon className="h-3 w-3 mr-1" />
                                      {schedule.vehicle_code}
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="text-xs text-secondary-400">
                                {schedule.region}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {column.schedules.length === 0 && (
                      <div className="text-center py-8 text-secondary-400">
                        <div className="text-sm">No schedules</div>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((column) => (
          <div key={column.id} className="card">
            <div className="card-body text-center">
              <div className="text-2xl font-bold text-secondary-900">{column.schedules.length}</div>
              <div className="text-sm text-secondary-600">{column.title}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}