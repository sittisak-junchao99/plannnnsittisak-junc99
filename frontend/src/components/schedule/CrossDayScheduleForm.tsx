/**
 * Cross-Day Schedule Form Component
 * Handles creation and editing of schedules with cross-day departure support
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, addDays, parseISO } from 'date-fns'
import { 
  ClockIcon, 
  CalendarIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const crossDayScheduleSchema = z.object({
  route_schedule_id: z.string().uuid('Please select a route schedule'),
  schedule_date: z.string().min(1, 'Schedule date is required'),
  standby_date: z.string().min(1, 'Standby date is required'),
  standby_time: z.string().min(1, 'Standby time is required'),
  departure_time: z.string().min(1, 'Departure time is required'),
  driver_id: z.string().uuid().optional().or(z.literal('')),
  vehicle_id: z.string().uuid().optional().or(z.literal('')),
  override_reason: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled']),
})

type CrossDayScheduleForm = z.infer<typeof crossDayScheduleSchema>

interface CrossDayScheduleFormProps {
  routeScheduleId?: string
  scheduleDate?: string
  existingInstance?: any
  onSuccess?: () => void
  onCancel?: () => void
}

export default function CrossDayScheduleForm({
  routeScheduleId,
  scheduleDate,
  existingInstance,
  onSuccess,
  onCancel
}: CrossDayScheduleFormProps) {
  const [isCrossDayDeparture, setIsCrossDayDeparture] = useState(false)
  const [departureDate, setDepartureDate] = useState<string>('')
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset
  } = useForm<CrossDayScheduleForm>({
    resolver: zodResolver(crossDayScheduleSchema),
    defaultValues: {
      route_schedule_id: routeScheduleId || '',
      schedule_date: scheduleDate || format(new Date(), 'yyyy-MM-dd'),
      standby_date: scheduleDate || format(new Date(), 'yyyy-MM-dd'),
      standby_time: '19:00',
      departure_time: '06:00',
      status: 'Scheduled',
    },
  })

  const watchedStandbyDate = watch('standby_date')
  const watchedStandbyTime = watch('standby_time')
  const watchedDepartureTime = watch('departure_time')

  // Calculate departure date based on times
  useEffect(() => {
    if (watchedStandbyDate && watchedStandbyTime && watchedDepartureTime) {
      const standbyTime = watchedStandbyTime
      const departureTime = watchedDepartureTime
      
      // If departure time is earlier than standby time, it's next day
      const isCrossDay = departureTime < standbyTime
      setIsCrossDayDeparture(isCrossDay)
      
      if (isCrossDay) {
        const nextDay = addDays(parseISO(watchedStandbyDate), 1)
        setDepartureDate(format(nextDay, 'yyyy-MM-dd'))
      } else {
        setDepartureDate(watchedStandbyDate)
      }
    }
  }, [watchedStandbyDate, watchedStandbyTime, watchedDepartureTime])

  // Load existing instance data
  useEffect(() => {
    if (existingInstance) {
      reset({
        route_schedule_id: existingInstance.route_schedule_id,
        schedule_date: existingInstance.schedule_date,
        standby_date: existingInstance.standby_date || existingInstance.schedule_date,
        standby_time: existingInstance.standby_time || '19:00',
        departure_time: existingInstance.departure_time || '06:00',
        driver_id: existingInstance.driver_id || '',
        vehicle_id: existingInstance.vehicle_id || '',
        override_reason: existingInstance.override_reason || '',
        notes: existingInstance.notes || '',
        status: existingInstance.status || 'Scheduled',
      })
    }
  }, [existingInstance, reset])

  // Fetch route schedules
  const { data: routeSchedules } = useQuery({
    queryKey: ['route-schedules-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_schedules')
        .select(`
          id,
          schedule_name,
          standby_time,
          departure_time,
          routes (
            name,
            route_code,
            region
          )
        `)
        .eq('status', 'Active')
        .order('schedule_name')

      if (error) throw error
      return data
    },
  })

  // Fetch drivers
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

  // Fetch vehicles
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

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: CrossDayScheduleForm) => {
      const { error } = await supabase.rpc('create_schedule_instance_with_override', {
        p_route_schedule_id: data.route_schedule_id,
        p_schedule_date: data.schedule_date,
        p_standby_date: data.standby_date,
        p_standby_time: data.standby_time,
        p_departure_time: data.departure_time,
        p_driver_id: data.driver_id || null,
        p_vehicle_id: data.vehicle_id || null,
        p_override_reason: data.override_reason || null,
        p_notes: data.notes || null,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-instances'] })
      queryClient.invalidateQueries({ queryKey: ['schedule-overview'] })
      toast.success('Schedule saved successfully!')
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(`Failed to save schedule: ${error.message}`)
    },
  })

  const onSubmit = (data: CrossDayScheduleForm) => {
    saveMutation.mutate(data)
  }

  const selectedSchedule = routeSchedules?.find(rs => rs.id === watch('route_schedule_id'))

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-secondary-900">
            {existingInstance ? 'Edit Schedule Instance' : 'Create Schedule Instance'}
          </h3>
          {selectedSchedule && (
            <p className="text-sm text-secondary-600 mt-1">
              Route: {selectedSchedule.routes?.route_code} - {selectedSchedule.routes?.name}
              {selectedSchedule.routes?.region && ` (${selectedSchedule.routes.region})`}
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
                onChange={(e) => {
                  setValue('route_schedule_id', e.target.value)
                  // Auto-fill times from selected schedule
                  const schedule = routeSchedules?.find(rs => rs.id === e.target.value)
                  if (schedule) {
                    setValue('standby_time', schedule.standby_time || '19:00')
                    setValue('departure_time', schedule.departure_time || '06:00')
                  }
                }}
              >
                <option value="">Select a route schedule</option>
                {routeSchedules?.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.routes?.route_code} - {schedule.schedule_name}
                    {schedule.routes?.region && ` (${schedule.routes.region})`}
                  </option>
                ))}
              </select>
              {errors.route_schedule_id && (
                <p className="form-error">{errors.route_schedule_id.message}</p>
              )}
            </div>

            {/* Date Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="form-group">
                <label htmlFor="standby_date" className="form-label">
                  Standby Date *
                </label>
                <input
                  {...register('standby_date')}
                  type="date"
                  id="standby_date"
                  className={`input ${errors.standby_date ? 'input-error' : ''}`}
                />
                {errors.standby_date && (
                  <p className="form-error">{errors.standby_date.message}</p>
                )}
              </div>
            </div>

            {/* Time Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label htmlFor="standby_time" className="form-label">
                  Standby Time *
                </label>
                <input
                  {...register('standby_time')}
                  type="time"
                  id="standby_time"
                  className={`input ${errors.standby_time ? 'input-error' : ''}`}
                />
                {errors.standby_time && (
                  <p className="form-error">{errors.standby_time.message}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="departure_time" className="form-label">
                  Departure Time *
                </label>
                <input
                  {...register('departure_time')}
                  type="time"
                  id="departure_time"
                  className={`input ${errors.departure_time ? 'input-error' : ''}`}
                />
                {errors.departure_time && (
                  <p className="form-error">{errors.departure_time.message}</p>
                )}
              </div>
            </div>

            {/* Cross-day Departure Warning */}
            {isCrossDayDeparture && (
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                <div className="flex items-start">
                  <ExclamationTriangleIcon className="h-5 w-5 text-warning-600 mt-0.5 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-warning-900">Cross-Day Departure Detected</h4>
                    <p className="text-sm text-warning-700 mt-1">
                      Standby: {watchedStandbyDate} {watchedStandbyTime} → 
                      Departure: {departureDate} {watchedDepartureTime}
                    </p>
                    <p className="text-xs text-warning-600 mt-1">
                      This schedule will be categorized under departure date: {departureDate}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Resource Assignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onCancel}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="btn-primary"
              >
                {saveMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="loading-spinner h-4 w-4 mr-2"></div>
                    Saving...
                  </div>
                ) : (
                  existingInstance ? 'Update Schedule' : 'Create Schedule'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Help Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Cross-Day Departure Guide</h4>
            <ul className="text-sm text-blue-700 mt-1 space-y-1">
              <li>• <strong>Same Day:</strong> Standby 08:00 → Depart 10:00 (same date)</li>
              <li>• <strong>Cross Day:</strong> Standby 20:00 → Depart 00:01 (next date)</li>
              <li>• Schedule will be categorized under the departure date</li>
              <li>• Override fields are automatically detected and tracked</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}