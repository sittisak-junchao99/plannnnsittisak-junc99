import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type ScheduleInstance = Database['public']['Tables']['schedule_instances']['Insert']

const scheduleInstanceSchema = z.object({
  route_schedule_id: z.string().uuid('Please select a route schedule'),
  schedule_date: z.string().min(1, 'Schedule date is required'),
  driver_id: z.string().uuid().optional().or(z.literal('')),
  vehicle_id: z.string().uuid().optional().or(z.literal('')),
  standby_time: z.string().optional().or(z.literal('')),
  departure_time: z.string().optional().or(z.literal('')),
  override_reason: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled']),
})

type ScheduleInstanceForm = z.infer<typeof scheduleInstanceSchema>

export default function CreateScheduleInstancePage() {
  const navigate = useNavigate()
  const { scheduleId } = useParams()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  // Fetch route schedules for dropdown
  const { data: routeSchedules } = useQuery({
    queryKey: ['route-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_schedules')
        .select(`
          id,
          schedule_name,
          routes (
            name,
            route_code
          )
        `)
        .eq('status', 'Active')
        .order('schedule_name')

      if (error) throw error
      return data
    },
  })

  // Fetch drivers for dropdown
  const { data: drivers } = useQuery({
    queryKey: ['drivers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, name, driver_code')
        .eq('status', 'Active')
        .order('name')

      if (error) throw error
      return data
    },
  })

  // Fetch vehicles for dropdown
  const { data: vehicles } = useQuery({
    queryKey: ['vehicles-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, vehicle_code, plate_number')
        .eq('status', 'Active')
        .order('vehicle_code')

      if (error) throw error
      return data
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ScheduleInstanceForm>({
    resolver: zodResolver(scheduleInstanceSchema),
    defaultValues: {
      route_schedule_id: scheduleId || '',
      schedule_date: format(new Date(), 'yyyy-MM-dd'),
      status: 'Scheduled',
    },
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: ScheduleInstanceForm) => {
      const instanceData: ScheduleInstance = {
        ...data,
        driver_id: data.driver_id || null,
        vehicle_id: data.vehicle_id || null,
        standby_time: data.standby_time || null,
        departure_time: data.departure_time || null,
        override_reason: data.override_reason || null,
        notes: data.notes || null,
      }

      const { data: result, error } = await supabase
        .from('schedule_instances')
        .insert(instanceData)
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-instances'] })
      toast.success('Schedule instance created successfully!')
      navigate('/instances')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create schedule instance')
    },
  })

  const onSubmit = async (data: ScheduleInstanceForm) => {
    setLoading(true)
    try {
      await createMutation.mutateAsync(data)
    } finally {
      setLoading(false)
    }
  }

  const selectedScheduleId = watch('route_schedule_id')
  const selectedSchedule = routeSchedules?.find(s => s.id === selectedScheduleId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">Create Schedule Instance</h1>
        <button
          onClick={() => navigate('/instances')}
          className="btn-outline"
        >
          Cancel
        </button>
      </div>

      <div className="card max-w-2xl">
        <div className="card-header">
          <h3 className="text-lg font-medium text-secondary-900">
            Schedule Instance Details
          </h3>
          {selectedSchedule && (
            <p className="text-sm text-secondary-600 mt-1">
              Route: {selectedSchedule.routes?.route_code} - {selectedSchedule.routes?.name}
            </p>
          )}
        </div>
        
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Route Schedule Selection */}
            <div className="form-group">
              <label htmlFor="route_schedule_id" className="form-label">
                Route Schedule *
              </label>
              <select
                {...register('route_schedule_id')}
                id="route_schedule_id"
                className={`input ${errors.route_schedule_id ? 'input-error' : ''}`}
              >
                <option value="">Select a route schedule</option>
                {routeSchedules?.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.routes?.route_code} - {schedule.schedule_name}
                  </option>
                ))}
              </select>
              {errors.route_schedule_id && (
                <p className="form-error">{errors.route_schedule_id.message}</p>
              )}
            </div>

            {/* Schedule Date */}
            <div className="form-group">
              <label htmlFor="schedule_date" className="form-label">
                Schedule Date *
              </label>
              <input
                {...register('schedule_date')}
                type="date"
                id="schedule_date"
                className={`input ${errors.schedule_date ? 'input-error' : ''}`}
              />
              {errors.schedule_date && (
                <p className="form-error">{errors.schedule_date.message}</p>
              )}
            </div>

            {/* Driver Selection */}
            <div className="form-group">
              <label htmlFor="driver_id" className="form-label">
                Driver
              </label>
              <select
                {...register('driver_id')}
                id="driver_id"
                className="input"
              >
                <option value="">Select a driver</option>
                {drivers?.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.driver_code} - {driver.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Vehicle Selection */}
            <div className="form-group">
              <label htmlFor="vehicle_id" className="form-label">
                Vehicle
              </label>
              <select
                {...register('vehicle_id')}
                id="vehicle_id"
                className="input"
              >
                <option value="">Select a vehicle</option>
                {vehicles?.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_code} - {vehicle.plate_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor="standby_time" className="form-label">
                  Standby Time
                </label>
                <input
                  {...register('standby_time')}
                  type="time"
                  id="standby_time"
                  className="input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="departure_time" className="form-label">
                  Departure Time
                </label>
                <input
                  {...register('departure_time')}
                  type="time"
                  id="departure_time"
                  className="input"
                />
              </div>
            </div>

            {/* Status */}
            <div className="form-group">
              <label htmlFor="status" className="form-label">
                Status *
              </label>
              <select
                {...register('status')}
                id="status"
                className={`input ${errors.status ? 'input-error' : ''}`}
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Confirmed">Confirmed</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              {errors.status && (
                <p className="form-error">{errors.status.message}</p>
              )}
            </div>

            {/* Override Reason */}
            <div className="form-group">
              <label htmlFor="override_reason" className="form-label">
                Override Reason
              </label>
              <input
                {...register('override_reason')}
                type="text"
                id="override_reason"
                className="input"
                placeholder="Reason for schedule override"
              />
              <p className="form-help">
                Explain why this instance differs from the master schedule
              </p>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="notes" className="form-label">
                Notes
              </label>
              <textarea
                {...register('notes')}
                id="notes"
                rows={3}
                className="input"
                placeholder="Additional notes..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => navigate('/instances')}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || createMutation.isPending}
                className="btn-primary"
              >
                {loading || createMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="loading-spinner h-4 w-4 mr-2"></div>
                    Creating...
                  </div>
                ) : (
                  'Create Schedule Instance'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}