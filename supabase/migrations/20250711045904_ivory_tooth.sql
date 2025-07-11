/*
  # Complete Transport Planner Database Schema
  
  This script creates the complete database schema for the Team-Based Transport Planner system.
  It combines all migration files into a single, comprehensive script.
  
  ## Tables Created:
  
  ### Core Tables:
  - drivers - Driver information and management
  - vehicles - Vehicle fleet management
  - vehicle_types - Vehicle type definitions
  - customers - Customer information
  - routes - Route definitions with coordinates
  - route_schedules - Master schedule templates
  - schedule_instances - Daily schedule instances and overrides
  
  ### Management Tables:
  - users - User authentication and authorization
  - route_responsibility - Route ownership assignments
  - support_offer - Team collaboration and resource sharing
  - route_alerts - Notification system
  - conflict_checks - Automated conflict detection
  - smart_suggestions - Route optimization suggestions
  - route_distance_cache - Performance optimization cache
  
  ### Configuration Tables:
  - app_settings - Global application settings
  - suggestion_config - AI suggestion parameters
  - audit_logs - Complete audit trail
  
  ## Features:
  - Row Level Security (RLS) enabled on all tables
  - Comprehensive audit logging
  - Automated conflict detection
  - Smart route suggestions
  - Team collaboration features
  - Performance optimization with indexes and materialized views
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create sequences for human-readable IDs
CREATE SEQUENCE IF NOT EXISTS seq_driver_num START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_vehicle_num START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_customer_num START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_route_num START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_user_num START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_support_offer_num START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_route_responsibility_num START 1 INCREMENT 1;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Vehicle types table
CREATE TABLE IF NOT EXISTS vehicle_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_code TEXT UNIQUE NOT NULL DEFAULT 'DRV' || LPAD(nextval('seq_driver_num')::text, 6, '0'),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  license_number TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_code TEXT UNIQUE NOT NULL DEFAULT 'VEH' || LPAD(nextval('seq_vehicle_num')::text, 6, '0'),
  plate_number TEXT NOT NULL UNIQUE,
  vehicle_type_id UUID REFERENCES vehicle_types(id),
  brand TEXT,
  model TEXT,
  year INTEGER,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Maintenance')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code TEXT UNIQUE NOT NULL DEFAULT 'CST' || LPAD(nextval('seq_customer_num')::text, 6, '0'),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Routes table
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_code TEXT UNIQUE NOT NULL DEFAULT 'RTE' || LPAD(nextval('seq_route_num')::text, 6, '0'),
  name TEXT NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES customers(id),
  origin_name TEXT,
  destination_name TEXT,
  origin_coordinates POINT,
  destination_coordinates POINT,
  estimated_distance_km DECIMAL(10,2),
  estimated_duration_minutes INTEGER,
  default_standby_time TIME,
  default_departure_time TIME,
  region TEXT,
  subcontractor TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Route schedules (master templates)
CREATE TABLE IF NOT EXISTS route_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  schedule_name TEXT NOT NULL,
  schedule_type TEXT NOT NULL DEFAULT 'Recurring' CHECK (schedule_type IN ('Single', 'Recurring')),
  days_of_week INTEGER[] DEFAULT '{1,2,3,4,5,6,7}', -- 1=Monday, 7=Sunday
  start_date DATE NOT NULL,
  end_date DATE,
  standby_time TIME,
  departure_time TIME,
  default_driver_id UUID REFERENCES drivers(id),
  default_vehicle_id UUID REFERENCES vehicles(id),
  priority INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Draft')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Schedule instances (daily overrides)
CREATE TABLE IF NOT EXISTS schedule_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_schedule_id UUID NOT NULL REFERENCES route_schedules(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  driver_id UUID REFERENCES drivers(id),
  vehicle_id UUID REFERENCES vehicles(id),
  standby_time TIME,
  departure_time TIME,
  actual_departure_time TIMESTAMPTZ,
  actual_arrival_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled')),
  override_reason TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(route_schedule_id, schedule_date)
);

-- =============================================================================
-- USER MANAGEMENT TABLES
-- =============================================================================

-- Users table for authentication and authorization
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_code TEXT UNIQUE NOT NULL DEFAULT 'USR' || LPAD(nextval('seq_user_num')::text, 6, '0'),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Viewer' CHECK (role IN ('Admin', 'Planner', 'Viewer')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
  last_login TIMESTAMPTZ,
  password_hash TEXT, -- For custom auth if needed
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Route responsibility for assigning route ownership
CREATE TABLE IF NOT EXISTS route_responsibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  responsibility_code TEXT UNIQUE NOT NULL DEFAULT 'RRP' || LPAD(nextval('seq_route_responsibility_num')::text, 6, '0'),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Primary', 'Backup', 'Observer')),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(route_id, user_id, role)
);

-- Support offer table for team collaboration
CREATE TABLE IF NOT EXISTS support_offer (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_code TEXT UNIQUE NOT NULL DEFAULT 'SOF' || LPAD(nextval('seq_support_offer_num')::text, 6, '0'),
  route_schedule_id UUID REFERENCES route_schedules(id),
  schedule_instance_id UUID REFERENCES schedule_instances(id),
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  proposed_driver_id UUID REFERENCES drivers(id),
  proposed_vehicle_id UUID REFERENCES vehicles(id),
  offer_type TEXT NOT NULL DEFAULT 'Resource' CHECK (offer_type IN ('Resource', 'Takeover', 'Assistance')),
  message TEXT,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected', 'Expired')),
  expires_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- SYSTEM TABLES
-- =============================================================================

-- Route alerts
CREATE TABLE IF NOT EXISTS route_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_schedule_id UUID REFERENCES route_schedules(id),
  schedule_instance_id UUID REFERENCES schedule_instances(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('Reminder', 'Conflict', 'Change', 'Cancellation', 'Delay')),
  title TEXT NOT NULL,
  message TEXT,
  severity TEXT NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_for_user UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conflict checks
CREATE TABLE IF NOT EXISTS conflict_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_date DATE NOT NULL,
  driver_id UUID REFERENCES drivers(id),
  vehicle_id UUID REFERENCES vehicles(id),
  conflicting_schedules UUID[] NOT NULL,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('Driver Overlap', 'Vehicle Overlap', 'Time Conflict')),
  severity TEXT NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low', 'Medium', 'High')),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Resolved', 'Ignored')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Smart suggestions
CREATE TABLE IF NOT EXISTS smart_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_route_id UUID NOT NULL REFERENCES routes(id),
  to_route_id UUID NOT NULL REFERENCES routes(id),
  suggestion_date DATE NOT NULL,
  time_gap_minutes INTEGER,
  distance_km DECIMAL(10,2),
  travel_time_minutes INTEGER,
  efficiency_score DECIMAL(5,2),
  cost_savings_estimate DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_route_id, to_route_id, suggestion_date)
);

-- Route distance cache
CREATE TABLE IF NOT EXISTS route_distance_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_route_id UUID NOT NULL REFERENCES routes(id),
  to_route_id UUID NOT NULL REFERENCES routes(id),
  distance_km DECIMAL(10,2),
  travel_time_minutes INTEGER,
  traffic_factor DECIMAL(3,2) DEFAULT 1.0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(from_route_id, to_route_id)
);

-- App settings for global configuration
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type TEXT NOT NULL DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  is_editable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Suggestion config for AI parameters
CREATE TABLE IF NOT EXISTS suggestion_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT UNIQUE NOT NULL,
  config_value DECIMAL(10,4) NOT NULL,
  config_type TEXT NOT NULL DEFAULT 'number' CHECK (config_type IN ('number', 'percentage', 'time', 'distance')),
  min_value DECIMAL(10,4),
  max_value DECIMAL(10,4),
  unit TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Audit logs for tracking all changes
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  user_id UUID REFERENCES users(id),
  user_email TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_name ON drivers(name);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_region ON routes(region);
CREATE INDEX IF NOT EXISTS idx_routes_customer ON routes(customer_id);

-- Schedule table indexes
CREATE INDEX IF NOT EXISTS idx_route_schedules_date_range ON route_schedules(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_route_schedules_route_id ON route_schedules(route_id);
CREATE INDEX IF NOT EXISTS idx_route_schedules_status ON route_schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedule_instances_date ON schedule_instances(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedule_instances_route_schedule ON schedule_instances(route_schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_instances_driver ON schedule_instances(driver_id);
CREATE INDEX IF NOT EXISTS idx_schedule_instances_vehicle ON schedule_instances(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_schedule_instances_status ON schedule_instances(status);

-- User management indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_route_responsibility_route ON route_responsibility(route_id);
CREATE INDEX IF NOT EXISTS idx_route_responsibility_user ON route_responsibility(user_id);
CREATE INDEX IF NOT EXISTS idx_route_responsibility_active ON route_responsibility(is_active);
CREATE INDEX IF NOT EXISTS idx_support_offer_from_user ON support_offer(from_user_id);
CREATE INDEX IF NOT EXISTS idx_support_offer_to_user ON support_offer(to_user_id);
CREATE INDEX IF NOT EXISTS idx_support_offer_status ON support_offer(status);
CREATE INDEX IF NOT EXISTS idx_support_offer_created ON support_offer(created_at);

-- System table indexes
CREATE INDEX IF NOT EXISTS idx_route_alerts_unread ON route_alerts(is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_route_alerts_user ON route_alerts(created_for_user);
CREATE INDEX IF NOT EXISTS idx_conflict_checks_date ON conflict_checks(check_date);
CREATE INDEX IF NOT EXISTS idx_conflict_checks_status ON conflict_checks(status);
CREATE INDEX IF NOT EXISTS idx_smart_suggestions_date ON smart_suggestions(suggestion_date);
CREATE INDEX IF NOT EXISTS idx_smart_suggestions_status ON smart_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_route_distance_cache_from_route ON route_distance_cache(from_route_id);
CREATE INDEX IF NOT EXISTS idx_route_distance_cache_to_route ON route_distance_cache(to_route_id);

-- Configuration table indexes
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_app_settings_category ON app_settings(category);
CREATE INDEX IF NOT EXISTS idx_suggestion_config_key ON suggestion_config(config_key);
CREATE INDEX IF NOT EXISTS idx_suggestion_config_category ON suggestion_config(category);
CREATE INDEX IF NOT EXISTS idx_suggestion_config_active ON suggestion_config(is_active);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation);

-- =============================================================================
-- MATERIALIZED VIEWS
-- =============================================================================

-- Materialized view for schedule overview
CREATE MATERIALIZED VIEW IF NOT EXISTS schedule_overview AS
SELECT 
  rs.id AS schedule_id,
  r.route_code,
  r.name AS route_name,
  r.region,
  schedule_date::DATE AS schedule_date,
  rs.standby_time,
  rs.departure_time,
  d.driver_code,
  d.name AS driver_name,
  v.vehicle_code,
  v.plate_number,
  rs.status,
  rs.created_at,
  c.name AS customer_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM schedule_instances si 
      WHERE si.route_schedule_id = rs.id 
      AND si.schedule_date = schedule_date::DATE
    ) THEN TRUE 
    ELSE FALSE 
  END AS has_override
FROM route_schedules rs
JOIN routes r ON rs.route_id = r.id
LEFT JOIN customers c ON r.customer_id = c.id
LEFT JOIN drivers d ON rs.default_driver_id = d.id
LEFT JOIN vehicles v ON rs.default_vehicle_id = v.id
CROSS JOIN generate_series(rs.start_date, COALESCE(rs.end_date, rs.start_date + INTERVAL '1 year'), '1 day'::interval) AS schedule_date
WHERE rs.status = 'Active'
AND EXTRACT(DOW FROM schedule_date) = ANY(
  CASE 
    WHEN rs.days_of_week IS NULL THEN ARRAY[1,2,3,4,5,6,7]
    ELSE rs.days_of_week
  END
);

-- Indexes for materialized view
CREATE INDEX IF NOT EXISTS idx_schedule_overview_date ON schedule_overview(schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedule_overview_route ON schedule_overview(route_code);
CREATE INDEX IF NOT EXISTS idx_schedule_overview_driver ON schedule_overview(driver_code);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_schedule_overview()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY schedule_overview;
END;
$$ LANGUAGE plpgsql;

-- Enhanced audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_record_id TEXT;
  v_changed_fields TEXT[] := '{}';
  v_field_name TEXT;
BEGIN
  -- Get current user info
  BEGIN
    v_user_id := COALESCE(current_setting('app.current_user_id', true)::UUID, NULL);
    v_user_email := COALESCE(current_setting('app.current_user_email', true), NULL);
  EXCEPTION
    WHEN OTHERS THEN
      v_user_id := NULL;
      v_user_email := NULL;
  END;

  -- Get record ID based on table structure
  CASE TG_TABLE_NAME
    WHEN 'drivers' THEN v_record_id := COALESCE(NEW.id::text, OLD.id::text);
    WHEN 'vehicles' THEN v_record_id := COALESCE(NEW.id::text, OLD.id::text);
    WHEN 'customers' THEN v_record_id := COALESCE(NEW.id::text, OLD.id::text);
    WHEN 'routes' THEN v_record_id := COALESCE(NEW.id::text, OLD.id::text);
    WHEN 'route_schedules' THEN v_record_id := COALESCE(NEW.id::text, OLD.id::text);
    WHEN 'schedule_instances' THEN v_record_id := COALESCE(NEW.id::text, OLD.id::text);
    WHEN 'users' THEN v_record_id := COALESCE(NEW.id::text, OLD.id::text);
    WHEN 'support_offer' THEN v_record_id := COALESCE(NEW.id::text, OLD.id::text);
    WHEN 'route_responsibility' THEN v_record_id := COALESCE(NEW.id::text, OLD.id::text);
    WHEN 'app_settings' THEN v_record_id := COALESCE(NEW.id::text, OLD.id::text);
    WHEN 'suggestion_config' THEN v_record_id := COALESCE(NEW.id::text, OLD.id::text);
    ELSE v_record_id := 'unknown';
  END CASE;

  -- For UPDATE operations, identify changed fields
  IF TG_OP = 'UPDATE' THEN
    FOR v_field_name IN 
      SELECT key FROM jsonb_each(to_jsonb(NEW)) 
      WHERE to_jsonb(NEW) -> key != to_jsonb(OLD) -> key
    LOOP
      v_changed_fields := array_append(v_changed_fields, v_field_name);
    END LOOP;
  END IF;

  -- Insert audit record
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      table_name, record_id, operation, new_values, 
      user_id, user_email, ip_address, user_agent
    ) VALUES (
      TG_TABLE_NAME, v_record_id, 'INSERT', to_jsonb(NEW),
      v_user_id, v_user_email,
      COALESCE(current_setting('app.client_ip', true)::INET, NULL),
      COALESCE(current_setting('app.user_agent', true), NULL)
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      table_name, record_id, operation, old_values, new_values, changed_fields,
      user_id, user_email, ip_address, user_agent
    ) VALUES (
      TG_TABLE_NAME, v_record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_changed_fields,
      v_user_id, v_user_email,
      COALESCE(current_setting('app.client_ip', true)::INET, NULL),
      COALESCE(current_setting('app.user_agent', true), NULL)
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      table_name, record_id, operation, old_values,
      user_id, user_email, ip_address, user_agent
    ) VALUES (
      TG_TABLE_NAME, v_record_id, 'DELETE', to_jsonb(OLD),
      v_user_id, v_user_email,
      COALESCE(current_setting('app.client_ip', true)::INET, NULL),
      COALESCE(current_setting('app.user_agent', true), NULL)
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to detect schedule conflicts
CREATE OR REPLACE FUNCTION detect_schedule_conflicts()
RETURNS VOID AS $$
BEGIN
  -- Clear existing conflicts
  DELETE FROM conflict_checks WHERE check_date = CURRENT_DATE;
  
  -- Detect driver conflicts
  INSERT INTO conflict_checks (check_date, driver_id, conflicting_schedules, conflict_type)
  SELECT 
    CURRENT_DATE,
    driver_id,
    array_agg(id),
    'Driver Overlap'
  FROM schedule_instances
  WHERE schedule_date = CURRENT_DATE
    AND driver_id IS NOT NULL
    AND status IN ('Scheduled', 'Confirmed')
  GROUP BY driver_id, schedule_date
  HAVING COUNT(*) > 1;
  
  -- Detect vehicle conflicts
  INSERT INTO conflict_checks (check_date, vehicle_id, conflicting_schedules, conflict_type)
  SELECT 
    CURRENT_DATE,
    vehicle_id,
    array_agg(id),
    'Vehicle Overlap'
  FROM schedule_instances
  WHERE schedule_date = CURRENT_DATE
    AND vehicle_id IS NOT NULL
    AND status IN ('Scheduled', 'Confirmed')
  GROUP BY vehicle_id, schedule_date
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql;

-- Business logic functions
CREATE OR REPLACE FUNCTION get_user_routes(p_user_id UUID)
RETURNS TABLE(route_id UUID, route_code TEXT, route_name TEXT, role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.route_code, r.name, rr.role
  FROM routes r
  JOIN route_responsibility rr ON r.id = rr.route_id
  WHERE rr.user_id = p_user_id AND rr.is_active = true;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assign_route_responsibility(
  p_route_id UUID,
  p_user_id UUID,
  p_role TEXT,
  p_assigned_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_responsibility_id UUID;
BEGIN
  INSERT INTO route_responsibility (route_id, user_id, role, assigned_by)
  VALUES (p_route_id, p_user_id, p_role, p_assigned_by)
  ON CONFLICT (route_id, user_id, role) 
  DO UPDATE SET 
    is_active = true,
    assigned_at = now(),
    assigned_by = p_assigned_by
  RETURNING id INTO v_responsibility_id;
  
  RETURN v_responsibility_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_support_offer(
  p_route_schedule_id UUID,
  p_from_user_id UUID,
  p_to_user_id UUID DEFAULT NULL,
  p_proposed_driver_id UUID DEFAULT NULL,
  p_proposed_vehicle_id UUID DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_offer_type TEXT DEFAULT 'Resource'
) RETURNS UUID AS $$
DECLARE
  v_offer_id UUID;
BEGIN
  INSERT INTO support_offer (
    route_schedule_id, from_user_id, to_user_id,
    proposed_driver_id, proposed_vehicle_id,
    message, offer_type,
    expires_at
  ) VALUES (
    p_route_schedule_id, p_from_user_id, p_to_user_id,
    p_proposed_driver_id, p_proposed_vehicle_id,
    p_message, p_offer_type,
    now() + INTERVAL '24 hours'
  ) RETURNING id INTO v_offer_id;
  
  RETURN v_offer_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- AUDIT TRIGGERS
-- =============================================================================

-- Create audit triggers for all tables
CREATE TRIGGER audit_drivers AFTER INSERT OR UPDATE OR DELETE ON drivers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_vehicles AFTER INSERT OR UPDATE OR DELETE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_customers AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_routes AFTER INSERT OR UPDATE OR DELETE ON routes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_route_schedules AFTER INSERT OR UPDATE OR DELETE ON route_schedules
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_schedule_instances AFTER INSERT OR UPDATE OR DELETE ON schedule_instances
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_support_offer AFTER INSERT OR UPDATE OR DELETE ON support_offer
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_route_responsibility AFTER INSERT OR UPDATE OR DELETE ON route_responsibility
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_app_settings AFTER INSERT OR UPDATE OR DELETE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_suggestion_config AFTER INSERT OR UPDATE OR DELETE ON suggestion_config
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_responsibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_offer ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_distance_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Basic policies for core tables (authenticated users can access all)
CREATE POLICY "Enable all for authenticated users" ON drivers FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON vehicles FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON vehicle_types FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON customers FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON routes FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON route_schedules FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON schedule_instances FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON route_alerts FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON conflict_checks FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON smart_suggestions FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON route_distance_cache FOR ALL TO authenticated USING (true);

-- User management policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR auth.jwt() ->> 'role' IN ('Admin', 'Planner'));

CREATE POLICY "Admins can manage all users" ON users
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'Admin');

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Support offer policies
CREATE POLICY "Users can view offers involving them" ON support_offer
  FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR auth.jwt() ->> 'role' IN ('Admin', 'Planner'));

CREATE POLICY "Users can create support offers" ON support_offer
  FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Users can respond to offers directed to them" ON support_offer
  FOR UPDATE TO authenticated
  USING (to_user_id = auth.uid() OR from_user_id = auth.uid() OR auth.jwt() ->> 'role' IN ('Admin', 'Planner'));

-- Route responsibility policies
CREATE POLICY "Users can view route responsibilities" ON route_responsibility
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR auth.jwt() ->> 'role' IN ('Admin', 'Planner'));

CREATE POLICY "Admins and Planners can manage route responsibilities" ON route_responsibility
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Planner'));

-- App settings policies
CREATE POLICY "Public settings are viewable by all" ON app_settings
  FOR SELECT TO authenticated
  USING (is_public = true OR auth.jwt() ->> 'role' IN ('Admin', 'Planner'));

CREATE POLICY "Only admins can modify settings" ON app_settings
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'Admin');

-- Suggestion config policies
CREATE POLICY "Config is viewable by planners and admins" ON suggestion_config
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Planner'));

CREATE POLICY "Only admins can modify config" ON suggestion_config
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'Admin');

-- Audit logs policies
CREATE POLICY "Users can view their own audit logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'Admin');

-- =============================================================================
-- SAMPLE DATA
-- =============================================================================

-- Insert sample vehicle types
INSERT INTO vehicle_types (name, description, capacity) VALUES
('Van', 'Standard delivery van', 8),
('Truck', 'Heavy duty truck', 2),
('Bus', 'Passenger bus', 50),
('Pickup', 'Pickup truck', 4),
('SUV', 'Sport utility vehicle', 7)
ON CONFLICT DO NOTHING;

-- Insert default app settings
INSERT INTO app_settings (setting_key, setting_value, setting_type, category, description, is_public) VALUES
('app_name', 'Team-Based Transport Planner', 'string', 'general', 'Application name', true),
('app_version', '1.0.0', 'string', 'general', 'Application version', true),
('timezone', 'Asia/Bangkok', 'string', 'general', 'Default timezone', true),
('date_format', 'DD/MM/YYYY', 'string', 'general', 'Default date format', true),
('time_format', '24h', 'string', 'general', 'Time format (12h/24h)', true),
('currency', 'THB', 'string', 'general', 'Default currency', true),
('language', 'th', 'string', 'general', 'Default language', true),
('max_routes_per_driver', '5', 'number', 'business', 'Maximum routes per driver per day', false),
('conflict_check_enabled', 'true', 'boolean', 'business', 'Enable automatic conflict checking', false),
('suggestion_enabled', 'true', 'boolean', 'business', 'Enable smart suggestions', false),
('notification_enabled', 'true', 'boolean', 'notification', 'Enable notifications', false),
('email_notifications', 'true', 'boolean', 'notification', 'Enable email notifications', false),
('audit_retention_days', '365', 'number', 'security', 'Audit log retention period in days', false)
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default suggestion config
INSERT INTO suggestion_config (config_key, config_value, config_type, min_value, max_value, unit, description, category) VALUES
('min_gap_minutes', 30.0000, 'time', 0.0000, 480.0000, 'minutes', 'Minimum time gap between routes', 'timing'),
('max_gap_minutes', 240.0000, 'time', 30.0000, 1440.0000, 'minutes', 'Maximum time gap between routes', 'timing'),
('max_distance_km', 50.0000, 'distance', 1.0000, 200.0000, 'km', 'Maximum distance for route suggestions', 'distance'),
('distance_weight', 0.4000, 'percentage', 0.0000, 1.0000, 'ratio', 'Weight factor for distance in scoring', 'scoring'),
('time_weight', 0.6000, 'percentage', 0.0000, 1.0000, 'ratio', 'Weight factor for time in scoring', 'scoring'),
('traffic_factor', 1.2000, 'number', 1.0000, 3.0000, 'multiplier', 'Traffic congestion factor', 'calculation'),
('fuel_cost_per_km', 8.5000, 'number', 5.0000, 20.0000, 'THB/km', 'Fuel cost per kilometer', 'cost'),
('driver_hourly_rate', 150.0000, 'number', 100.0000, 500.0000, 'THB/hour', 'Driver hourly rate', 'cost'),
('efficiency_threshold', 0.7000, 'percentage', 0.5000, 0.9000, 'ratio', 'Minimum efficiency score for suggestions', 'scoring'),
('max_suggestions_per_route', 5.0000, 'number', 1.0000, 20.0000, 'count', 'Maximum suggestions per route', 'limits')
ON CONFLICT (config_key) DO NOTHING;

-- =============================================================================
-- PERMISSIONS
-- =============================================================================

-- Grant permissions to anon role for public access
GRANT SELECT ON TABLE schedule_overview TO anon;
GRANT SELECT ON TABLE route_alerts TO anon;
GRANT SELECT ON TABLE conflict_checks TO anon;
GRANT SELECT ON TABLE drivers TO anon;
GRANT SELECT ON TABLE vehicles TO anon;
GRANT SELECT ON TABLE vehicle_types TO anon;
GRANT SELECT ON TABLE customers TO anon;
GRANT SELECT ON TABLE routes TO anon;
GRANT SELECT ON TABLE users TO anon;
GRANT SELECT ON TABLE support_offer TO anon;
GRANT SELECT ON TABLE route_responsibility TO anon;
GRANT SELECT ON TABLE app_settings TO anon;
GRANT SELECT ON TABLE suggestion_config TO anon;
GRANT SELECT ON TABLE audit_logs TO anon;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION detect_schedule_conflicts() TO anon;
GRANT EXECUTE ON FUNCTION get_user_routes(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION assign_route_responsibility(UUID, UUID, TEXT, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_support_offer(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION refresh_schedule_overview() TO authenticated, anon;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

-- Output completion message
DO $$
BEGIN
    RAISE NOTICE 'Transport Planner Database Schema Created Successfully!';
    RAISE NOTICE 'Tables: % ', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE');
    RAISE NOTICE 'Indexes: % ', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public');
    RAISE NOTICE 'Functions: % ', (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION');
    RAISE NOTICE 'Triggers: % ', (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public');
    RAISE NOTICE 'Ready for use!';
END $$;