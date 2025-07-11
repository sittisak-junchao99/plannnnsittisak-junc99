export interface Database {
  public: {
    Tables: {
      drivers: {
        Row: {
          id: string
          driver_code: string
          name: string
          phone: string | null
          email: string | null
          license_number: string | null
          status: 'Active' | 'Inactive' | 'Suspended'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          driver_code?: string
          name: string
          phone?: string | null
          email?: string | null
          license_number?: string | null
          status?: 'Active' | 'Inactive' | 'Suspended'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          driver_code?: string
          name?: string
          phone?: string | null
          email?: string | null
          license_number?: string | null
          status?: 'Active' | 'Inactive' | 'Suspended'
          created_at?: string
          updated_at?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          vehicle_code: string
          plate_number: string
          vehicle_type_id: string | null
          brand: string | null
          model: string | null
          year: number | null
          status: 'Active' | 'Inactive' | 'Maintenance'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vehicle_code?: string
          plate_number: string
          vehicle_type_id?: string | null
          brand?: string | null
          model?: string | null
          year?: number | null
          status?: 'Active' | 'Inactive' | 'Maintenance'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vehicle_code?: string
          plate_number?: string
          vehicle_type_id?: string | null
          brand?: string | null
          model?: string | null
          year?: number | null
          status?: 'Active' | 'Inactive' | 'Maintenance'
          created_at?: string
          updated_at?: string
        }
      }
      vehicle_types: {
        Row: {
          id: string
          name: string
          description: string | null
          capacity: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          capacity?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          capacity?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          customer_code: string
          name: string
          contact_person: string | null
          phone: string | null
          email: string | null
          address: string | null
          status: 'Active' | 'Inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_code?: string
          name: string
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          status?: 'Active' | 'Inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_code?: string
          name?: string
          contact_person?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          status?: 'Active' | 'Inactive'
          created_at?: string
          updated_at?: string
        }
      }
      routes: {
        Row: {
          id: string
          route_code: string
          name: string
          description: string | null
          customer_id: string | null
          origin_name: string | null
          destination_name: string | null
          origin_coordinates: unknown | null
          destination_coordinates: unknown | null
          estimated_distance_km: number | null
          estimated_duration_minutes: number | null
          default_standby_time: string | null
          default_departure_time: string | null
          region: string | null
          subcontractor: string | null
          status: 'Active' | 'Inactive' | 'Suspended'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          route_code?: string
          name: string
          description?: string | null
          customer_id?: string | null
          origin_name?: string | null
          destination_name?: string | null
          origin_coordinates?: unknown | null
          destination_coordinates?: unknown | null
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          default_standby_time?: string | null
          default_departure_time?: string | null
          region?: string | null
          subcontractor?: string | null
          status?: 'Active' | 'Inactive' | 'Suspended'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          route_code?: string
          name?: string
          description?: string | null
          customer_id?: string | null
          origin_name?: string | null
          destination_name?: string | null
          origin_coordinates?: unknown | null
          destination_coordinates?: unknown | null
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          default_standby_time?: string | null
          default_departure_time?: string | null
          region?: string | null
          subcontractor?: string | null
          status?: 'Active' | 'Inactive' | 'Suspended'
          created_at?: string
          updated_at?: string
        }
      }
      route_schedules: {
        Row: {
          id: string
          route_id: string
          schedule_name: string
          schedule_type: 'Single' | 'Recurring'
          days_of_week: number[] | null
          start_date: string
          end_date: string | null
          standby_time: string | null
          departure_time: string | null
          default_driver_id: string | null
          default_vehicle_id: string | null
          priority: number | null
          status: 'Active' | 'Inactive' | 'Draft'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          route_id: string
          schedule_name: string
          schedule_type?: 'Single' | 'Recurring'
          days_of_week?: number[] | null
          start_date: string
          end_date?: string | null
          standby_time?: string | null
          departure_time?: string | null
          default_driver_id?: string | null
          default_vehicle_id?: string | null
          priority?: number | null
          status?: 'Active' | 'Inactive' | 'Draft'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          route_id?: string
          schedule_name?: string
          schedule_type?: 'Single' | 'Recurring'
          days_of_week?: number[] | null
          start_date?: string
          end_date?: string | null
          standby_time?: string | null
          departure_time?: string | null
          default_driver_id?: string | null
          default_vehicle_id?: string | null
          priority?: number | null
          status?: 'Active' | 'Inactive' | 'Draft'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      schedule_instances: {
        Row: {
          id: string
          route_schedule_id: string
          schedule_date: string
          driver_id: string | null
          vehicle_id: string | null
          standby_time: string | null
          departure_time: string | null
          actual_departure_time: string | null
          actual_arrival_time: string | null
          status: 'Scheduled' | 'Confirmed' | 'In Progress' | 'Completed' | 'Cancelled'
          override_reason: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          route_schedule_id: string
          schedule_date: string
          driver_id?: string | null
          vehicle_id?: string | null
          standby_time?: string | null
          departure_time?: string | null
          actual_departure_time?: string | null
          actual_arrival_time?: string | null
          status?: 'Scheduled' | 'Confirmed' | 'In Progress' | 'Completed' | 'Cancelled'
          override_reason?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          route_schedule_id?: string
          schedule_date?: string
          driver_id?: string | null
          vehicle_id?: string | null
          standby_time?: string | null
          departure_time?: string | null
          actual_departure_time?: string | null
          actual_arrival_time?: string | null
          status?: 'Scheduled' | 'Confirmed' | 'In Progress' | 'Completed' | 'Cancelled'
          override_reason?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          user_code: string
          name: string
          email: string
          phone: string | null
          role: 'Admin' | 'Planner' | 'Viewer'
          status: 'Active' | 'Inactive' | 'Suspended'
          last_login: string | null
          password_hash: string | null
          avatar_url: string | null
          preferences: any | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_code?: string
          name: string
          email: string
          phone?: string | null
          role?: 'Admin' | 'Planner' | 'Viewer'
          status?: 'Active' | 'Inactive' | 'Suspended'
          last_login?: string | null
          password_hash?: string | null
          avatar_url?: string | null
          preferences?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_code?: string
          name?: string
          email?: string
          phone?: string | null
          role?: 'Admin' | 'Planner' | 'Viewer'
          status?: 'Active' | 'Inactive' | 'Suspended'
          last_login?: string | null
          password_hash?: string | null
          avatar_url?: string | null
          preferences?: any | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      schedule_overview: {
        Row: {
          schedule_id: string
          route_code: string
          route_name: string
          region: string | null
          schedule_date: string
          standby_time: string | null
          departure_time: string | null
          driver_code: string | null
          driver_name: string | null
          vehicle_code: string | null
          plate_number: string | null
          status: string
          created_at: string
          customer_name: string | null
          has_override: boolean
        }
      }
    }
    Functions: {
      detect_schedule_conflicts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_schedule_overview: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      set_user_context: {
        Args: {
          user_id: string
          user_email: string
        }
        Returns: undefined
      }
    }
  }
}