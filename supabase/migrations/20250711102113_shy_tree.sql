/*
  # Enhanced Schedule System for Cross-day Departure and Large Scale Operations
  
  This migration enhances the existing schema to support:
  1. Cross-day departure handling (standby_date/time vs departure_date/time)
  2. Override system for schedule instances
  3. Performance optimizations for 400+ routes/day
  4. Enhanced materialized views for large scale operations
*/

-- Add new columns to schedule_instances for cross-day departure support
ALTER TABLE schedule_instances 
ADD COLUMN IF NOT EXISTS standby_date DATE,
ADD COLUMN IF NOT EXISTS standby_time TIME,
ADD COLUMN IF NOT EXISTS departure_date DATE,
ADD COLUMN IF NOT EXISTS is_override BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS override_fields TEXT[] DEFAULT '{}';

-- Update existing data to populate new fields
UPDATE schedule_instances 
SET 
  standby_date = schedule_date,
  departure_date = schedule_date,
  is_override = FALSE
WHERE standby_date IS NULL OR departure_date IS NULL;

-- Add constraints and indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedule_instances_standby_date ON schedule_instances(standby_date);
CREATE INDEX IF NOT EXISTS idx_schedule_instances_departure_date ON schedule_instances(departure_date);
CREATE INDEX IF NOT EXISTS idx_schedule_instances_is_override ON schedule_instances(is_override);
CREATE INDEX IF NOT EXISTS idx_schedule_instances_composite ON schedule_instances(departure_date, status, driver_id, vehicle_id);

-- Enhanced materialized view for large scale operations
DROP MATERIALIZED VIEW IF EXISTS schedule_overview;

CREATE MATERIALIZED VIEW schedule_overview AS
WITH schedule_base AS (
  SELECT 
    rs.id AS route_schedule_id,
    rs.route_id,
    rs.schedule_name,
    rs.schedule_type,
    rs.days_of_week,
    rs.start_date,
    rs.end_date,
    rs.standby_time AS default_standby_time,
    rs.departure_time AS default_departure_time,
    rs.default_driver_id,
    rs.default_vehicle_id,
    rs.priority,
    rs.status AS schedule_status,
    rs.created_by,
    rs.created_at,
    r.route_code,
    r.name AS route_name,
    r.region,
    r.subcontractor,
    r.customer_id,
    c.name AS customer_name,
    d.driver_code AS default_driver_code,
    d.name AS default_driver_name,
    v.vehicle_code AS default_vehicle_code,
    v.plate_number AS default_plate_number
  FROM route_schedules rs
  JOIN routes r ON rs.route_id = r.id
  LEFT JOIN customers c ON r.customer_id = c.id
  LEFT JOIN drivers d ON rs.default_driver_id = d.id
  LEFT JOIN vehicles v ON rs.default_vehicle_id = v.id
  WHERE rs.status = 'Active'
),
date_series AS (
  SELECT 
    sb.*,
    schedule_date::DATE AS schedule_date
  FROM schedule_base sb
  CROSS JOIN generate_series(
    sb.start_date, 
    COALESCE(sb.end_date, sb.start_date + INTERVAL '1 year'), 
    '1 day'::interval
  ) AS schedule_date
  WHERE EXTRACT(DOW FROM schedule_date) = ANY(
    CASE 
      WHEN sb.days_of_week IS NULL OR array_length(sb.days_of_week, 1) IS NULL 
      THEN ARRAY[1,2,3,4,5,6,7]
      ELSE sb.days_of_week
    END
  )
)
SELECT 
  ds.route_schedule_id,
  ds.route_id,
  ds.route_code,
  ds.route_name,
  ds.customer_name,
  ds.region,
  ds.subcontractor,
  ds.schedule_date,
  
  -- Handle overrides vs defaults
  COALESCE(si.standby_date, ds.schedule_date) AS standby_date,
  COALESCE(si.standby_time, ds.default_standby_time) AS standby_time,
  COALESCE(si.departure_date, ds.schedule_date) AS departure_date,
  COALESCE(si.departure_time, ds.default_departure_time) AS departure_time,
  
  -- Driver and vehicle info (override or default)
  COALESCE(si_d.driver_code, ds.default_driver_code) AS driver_code,
  COALESCE(si_d.name, ds.default_driver_name) AS driver_name,
  COALESCE(si_v.vehicle_code, ds.default_vehicle_code) AS vehicle_code,
  COALESCE(si_v.plate_number, ds.default_plate_number) AS plate_number,
  
  -- Status and override info
  COALESCE(si.status, 'Scheduled') AS status,
  COALESCE(si.is_override, FALSE) AS is_override,
  si.override_reason,
  si.notes,
  
  -- Instance info
  si.id AS instance_id,
  si.actual_departure_time,
  si.actual_arrival_time,
  
  -- Schedule metadata
  ds.priority,
  ds.schedule_status,
  ds.created_at AS schedule_created_at,
  si.created_at AS instance_created_at,
  
  -- Cross-day departure indicator
  CASE 
    WHEN COALESCE(si.departure_date, ds.schedule_date) != COALESCE(si.standby_date, ds.schedule_date)
    THEN TRUE 
    ELSE FALSE 
  END AS is_cross_day_departure

FROM date_series ds
LEFT JOIN schedule_instances si ON si.route_schedule_id = ds.route_schedule_id 
  AND si.schedule_date = ds.schedule_date
LEFT JOIN drivers si_d ON si.driver_id = si_d.id
LEFT JOIN vehicles si_v ON si.vehicle_id = si_v.id;

-- Indexes for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_overview_unique ON schedule_overview(route_schedule_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_schedule_overview_departure_date ON schedule_overview(departure_date);
CREATE INDEX IF NOT EXISTS idx_schedule_overview_standby_date ON schedule_overview(standby_date);
CREATE INDEX IF NOT EXISTS idx_schedule_overview_region ON schedule_overview(region);
CREATE INDEX IF NOT EXISTS idx_schedule_overview_driver ON schedule_overview(driver_code);
CREATE INDEX IF NOT EXISTS idx_schedule_overview_vehicle ON schedule_overview(vehicle_code);
CREATE INDEX IF NOT EXISTS idx_schedule_overview_status ON schedule_overview(status);
CREATE INDEX IF NOT EXISTS idx_schedule_overview_override ON schedule_overview(is_override);
CREATE INDEX IF NOT EXISTS idx_schedule_overview_cross_day ON schedule_overview(is_cross_day_departure);
CREATE INDEX IF NOT EXISTS idx_schedule_overview_composite_filter ON schedule_overview(departure_date, region, status);

-- Function to handle cross-day departure logic
CREATE OR REPLACE FUNCTION calculate_departure_date(
  p_standby_date DATE,
  p_standby_time TIME,
  p_departure_time TIME
) RETURNS DATE AS $$
BEGIN
  -- If departure time is earlier than standby time, it's next day
  IF p_departure_time < p_standby_time THEN
    RETURN p_standby_date + INTERVAL '1 day';
  ELSE
    RETURN p_standby_date;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to create schedule instance with override handling
CREATE OR REPLACE FUNCTION create_schedule_instance_with_override(
  p_route_schedule_id UUID,
  p_schedule_date DATE,
  p_standby_date DATE DEFAULT NULL,
  p_standby_time TIME DEFAULT NULL,
  p_departure_time TIME DEFAULT NULL,
  p_driver_id UUID DEFAULT NULL,
  p_vehicle_id UUID DEFAULT NULL,
  p_override_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_instance_id UUID;
  v_departure_date DATE;
  v_override_fields TEXT[] := '{}';
  v_route_schedule RECORD;
BEGIN
  -- Get the route schedule defaults
  SELECT * INTO v_route_schedule
  FROM route_schedules 
  WHERE id = p_route_schedule_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Route schedule not found: %', p_route_schedule_id;
  END IF;
  
  -- Set defaults if not provided
  p_standby_date := COALESCE(p_standby_date, p_schedule_date);
  p_standby_time := COALESCE(p_standby_time, v_route_schedule.standby_time);
  p_departure_time := COALESCE(p_departure_time, v_route_schedule.departure_time);
  
  -- Calculate departure date (handle cross-day)
  v_departure_date := calculate_departure_date(p_standby_date, p_standby_time, p_departure_time);
  
  -- Determine which fields are overridden
  IF p_standby_time != v_route_schedule.standby_time THEN
    v_override_fields := array_append(v_override_fields, 'standby_time');
  END IF;
  
  IF p_departure_time != v_route_schedule.departure_time THEN
    v_override_fields := array_append(v_override_fields, 'departure_time');
  END IF;
  
  IF p_driver_id != v_route_schedule.default_driver_id THEN
    v_override_fields := array_append(v_override_fields, 'driver_id');
  END IF;
  
  IF p_vehicle_id != v_route_schedule.default_vehicle_id THEN
    v_override_fields := array_append(v_override_fields, 'vehicle_id');
  END IF;
  
  -- Insert or update the schedule instance
  INSERT INTO schedule_instances (
    route_schedule_id,
    schedule_date,
    standby_date,
    standby_time,
    departure_date,
    departure_time,
    driver_id,
    vehicle_id,
    is_override,
    override_fields,
    override_reason,
    notes,
    created_by
  ) VALUES (
    p_route_schedule_id,
    p_schedule_date,
    p_standby_date,
    p_standby_time,
    v_departure_date,
    p_departure_time,
    p_driver_id,
    p_vehicle_id,
    array_length(v_override_fields, 1) > 0,
    v_override_fields,
    p_override_reason,
    p_notes,
    p_created_by
  )
  ON CONFLICT (route_schedule_id, schedule_date)
  DO UPDATE SET
    standby_date = EXCLUDED.standby_date,
    standby_time = EXCLUDED.standby_time,
    departure_date = EXCLUDED.departure_date,
    departure_time = EXCLUDED.departure_time,
    driver_id = EXCLUDED.driver_id,
    vehicle_id = EXCLUDED.vehicle_id,
    is_override = EXCLUDED.is_override,
    override_fields = EXCLUDED.override_fields,
    override_reason = EXCLUDED.override_reason,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_instance_id;
  
  RETURN v_instance_id;
END;
$$ LANGUAGE plpgsql;

-- Function to bulk generate schedule instances for a date range
CREATE OR REPLACE FUNCTION generate_schedule_instances_bulk(
  p_start_date DATE,
  p_end_date DATE,
  p_route_schedule_ids UUID[] DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_route_schedule RECORD;
  v_date_cursor DATE;
BEGIN
  FOR v_route_schedule IN 
    SELECT * FROM route_schedules 
    WHERE status = 'Active'
    AND (p_route_schedule_ids IS NULL OR id = ANY(p_route_schedule_ids))
    AND start_date <= p_end_date
    AND (end_date IS NULL OR end_date >= p_start_date)
  LOOP
    v_date_cursor := GREATEST(p_start_date, v_route_schedule.start_date);
    
    WHILE v_date_cursor <= LEAST(p_end_date, COALESCE(v_route_schedule.end_date, p_end_date)) LOOP
      -- Check if this day of week is included
      IF EXTRACT(DOW FROM v_date_cursor) = ANY(
        COALESCE(v_route_schedule.days_of_week, ARRAY[1,2,3,4,5,6,7])
      ) THEN
        -- Only create if not already exists
        IF NOT EXISTS (
          SELECT 1 FROM schedule_instances 
          WHERE route_schedule_id = v_route_schedule.id 
          AND schedule_date = v_date_cursor
        ) THEN
          PERFORM create_schedule_instance_with_override(
            v_route_schedule.id,
            v_date_cursor,
            v_date_cursor, -- standby_date
            v_route_schedule.standby_time,
            v_route_schedule.departure_time,
            v_route_schedule.default_driver_id,
            v_route_schedule.default_vehicle_id,
            NULL, -- override_reason
            NULL, -- notes
            v_route_schedule.created_by
          );
          v_count := v_count + 1;
        END IF;
      END IF;
      
      v_date_cursor := v_date_cursor + INTERVAL '1 day';
    END LOOP;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Enhanced conflict detection for cross-day departures
CREATE OR REPLACE FUNCTION detect_schedule_conflicts_enhanced()
RETURNS TABLE(
  conflict_date DATE,
  conflict_type TEXT,
  driver_id UUID,
  vehicle_id UUID,
  conflicting_instances UUID[],
  severity TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Driver conflicts (same driver, overlapping times)
  WITH driver_conflicts AS (
    SELECT 
      si1.departure_date as conflict_date,
      'Driver Overlap' as conflict_type,
      si1.driver_id,
      NULL::UUID as vehicle_id,
      array_agg(DISTINCT si1.id) as conflicting_instances,
      CASE 
        WHEN COUNT(*) > 3 THEN 'High'
        WHEN COUNT(*) > 1 THEN 'Medium'
        ELSE 'Low'
      END as severity
    FROM schedule_instances si1
    JOIN schedule_instances si2 ON si1.driver_id = si2.driver_id 
      AND si1.id != si2.id
      AND si1.departure_date = si2.departure_date
      AND si1.status IN ('Scheduled', 'Confirmed')
      AND si2.status IN ('Scheduled', 'Confirmed')
    WHERE si1.driver_id IS NOT NULL
    GROUP BY si1.departure_date, si1.driver_id
    HAVING COUNT(*) > 1
  ),
  -- Vehicle conflicts
  vehicle_conflicts AS (
    SELECT 
      si1.departure_date as conflict_date,
      'Vehicle Overlap' as conflict_type,
      NULL::UUID as driver_id,
      si1.vehicle_id,
      array_agg(DISTINCT si1.id) as conflicting_instances,
      CASE 
        WHEN COUNT(*) > 3 THEN 'High'
        WHEN COUNT(*) > 1 THEN 'Medium'
        ELSE 'Low'
      END as severity
    FROM schedule_instances si1
    JOIN schedule_instances si2 ON si1.vehicle_id = si2.vehicle_id 
      AND si1.id != si2.id
      AND si1.departure_date = si2.departure_date
      AND si1.status IN ('Scheduled', 'Confirmed')
      AND si2.status IN ('Scheduled', 'Confirmed')
    WHERE si1.vehicle_id IS NOT NULL
    GROUP BY si1.departure_date, si1.vehicle_id
    HAVING COUNT(*) > 1
  )
  SELECT * FROM driver_conflicts
  UNION ALL
  SELECT * FROM vehicle_conflicts;
END;
$$ LANGUAGE plpgsql;

-- Performance optimization: Partitioning for large scale (if needed)
-- Note: This would require manual setup in production for very large datasets

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_departure_date(DATE, TIME, TIME) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_schedule_instance_with_override(UUID, DATE, DATE, TIME, TIME, UUID, UUID, TEXT, TEXT, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_schedule_instances_bulk(DATE, DATE, UUID[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION detect_schedule_conflicts_enhanced() TO authenticated, anon;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW schedule_overview;

-- Add helpful comments
COMMENT ON COLUMN schedule_instances.standby_date IS 'Date when standby begins (may differ from departure_date for cross-day operations)';
COMMENT ON COLUMN schedule_instances.departure_date IS 'Date when actual departure occurs (calculated from standby_date + time logic)';
COMMENT ON COLUMN schedule_instances.is_override IS 'TRUE if this instance overrides the master schedule template';
COMMENT ON COLUMN schedule_instances.override_fields IS 'Array of field names that were overridden from the master schedule';

COMMENT ON FUNCTION calculate_departure_date(DATE, TIME, TIME) IS 'Calculates departure date based on standby date/time and departure time, handling cross-day scenarios';
COMMENT ON FUNCTION create_schedule_instance_with_override(UUID, DATE, DATE, TIME, TIME, UUID, UUID, TEXT, TEXT, UUID) IS 'Creates schedule instance with automatic override detection and cross-day departure handling';
COMMENT ON FUNCTION generate_schedule_instances_bulk(DATE, DATE, UUID[]) IS 'Bulk generates schedule instances for a date range, optimized for large scale operations';