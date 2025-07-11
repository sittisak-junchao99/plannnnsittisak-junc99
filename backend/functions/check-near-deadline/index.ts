import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface DeadlineCheckRequest {
  hours_ahead?: number
  notification_types?: string[]
}

interface ScheduleWithDeadline {
  id: string
  route_schedule_id: string
  schedule_date: string
  departure_time: string
  route_name: string
  route_code: string
  driver_name?: string
  vehicle_code?: string
  status: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const { hours_ahead = 2, notification_types = ['email', 'in_app'] }: DeadlineCheckRequest = 
      await req.json()

    // Calculate deadline threshold
    const now = new Date()
    const deadlineThreshold = new Date(now.getTime() + (hours_ahead * 60 * 60 * 1000))
    
    console.log(`Checking for schedules with deadlines within ${hours_ahead} hours`)
    console.log(`Current time: ${now.toISOString()}`)
    console.log(`Deadline threshold: ${deadlineThreshold.toISOString()}`)

    // Query for schedules approaching deadline
    const { data: nearDeadlineSchedules, error: queryError } = await supabaseClient
      .from('schedule_instances')
      .select(`
        id,
        route_schedule_id,
        schedule_date,
        departure_time,
        status,
        route_schedules!inner (
          route_id,
          routes!inner (
            name,
            route_code
          )
        ),
        drivers (
          name
        ),
        vehicles (
          vehicle_code
        )
      `)
      .eq('status', 'Scheduled')
      .gte('schedule_date', now.toISOString().split('T')[0])
      .lte('schedule_date', deadlineThreshold.toISOString().split('T')[0])

    if (queryError) {
      throw new Error(`Database query failed: ${queryError.message}`)
    }

    // Filter schedules that are actually within the time window
    const filteredSchedules: ScheduleWithDeadline[] = []
    
    for (const schedule of nearDeadlineSchedules || []) {
      if (!schedule.departure_time) continue

      // Combine date and time
      const departureDateTime = new Date(`${schedule.schedule_date}T${schedule.departure_time}`)
      
      // Check if departure is within our threshold
      if (departureDateTime <= deadlineThreshold && departureDateTime > now) {
        filteredSchedules.push({
          id: schedule.id,
          route_schedule_id: schedule.route_schedule_id,
          schedule_date: schedule.schedule_date,
          departure_time: schedule.departure_time,
          route_name: schedule.route_schedules?.routes?.name || 'Unknown Route',
          route_code: schedule.route_schedules?.routes?.route_code || 'N/A',
          driver_name: schedule.drivers?.name,
          vehicle_code: schedule.vehicles?.vehicle_code,
          status: schedule.status,
        })
      }
    }

    console.log(`Found ${filteredSchedules.length} schedules approaching deadline`)

    // Create notifications for each schedule
    const notifications = []
    
    for (const schedule of filteredSchedules) {
      const departureDateTime = new Date(`${schedule.schedule_date}T${schedule.departure_time}`)
      const hoursUntilDeparture = (departureDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      // Create alert record
      const alertData = {
        schedule_instance_id: schedule.id,
        alert_type: 'Reminder',
        title: `Departure Reminder: ${schedule.route_code}`,
        message: `Route ${schedule.route_name} is scheduled to depart in ${hoursUntilDeparture.toFixed(1)} hours at ${schedule.departure_time}`,
        severity: hoursUntilDeparture <= 1 ? 'High' : 'Medium',
        created_for_user: null, // Will be set based on route responsibility
      }

      const { data: alert, error: alertError } = await supabaseClient
        .from('route_alerts')
        .insert(alertData)
        .select()
        .single()

      if (alertError) {
        console.error(`Failed to create alert for schedule ${schedule.id}:`, alertError)
        continue
      }

      notifications.push({
        schedule_id: schedule.id,
        alert_id: alert.id,
        route_code: schedule.route_code,
        departure_time: schedule.departure_time,
        hours_until_departure: hoursUntilDeparture,
        notification_types,
      })
    }

    // Log the check
    await supabaseClient
      .from('audit_logs')
      .insert({
        table_name: 'schedule_instances',
        record_id: 'deadline_check',
        operation: 'SELECT',
        new_values: {
          check_type: 'near_deadline',
          hours_ahead,
          schedules_found: filteredSchedules.length,
          notifications_created: notifications.length,
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deadline check completed. Found ${filteredSchedules.length} schedules approaching deadline.`,
        data: {
          schedules_checked: nearDeadlineSchedules?.length || 0,
          schedules_near_deadline: filteredSchedules.length,
          notifications_created: notifications.length,
          notifications,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in check-near-deadline function:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})