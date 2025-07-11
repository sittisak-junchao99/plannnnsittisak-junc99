/*
  # Create User Context Function
  
  This function allows setting user context for RLS policies.
  It sets session variables that can be used in RLS policies.
*/

-- Function to set user context for RLS
CREATE OR REPLACE FUNCTION set_user_context(user_id UUID, user_email TEXT DEFAULT '')
RETURNS VOID AS $$
BEGIN
  -- Set the current user ID for RLS policies
  PERFORM set_config('app.current_user_id', user_id::text, true);
  
  -- Set the current user email for audit logging
  IF user_email != '' THEN
    PERFORM set_config('app.current_user_email', user_email, true);
  END IF;
  
  -- Set client IP if available (for audit logging)
  -- This would typically be set by the application
  -- PERFORM set_config('app.client_ip', client_ip, true);
  
  -- Set user agent if available (for audit logging)
  -- This would typically be set by the application
  -- PERFORM set_config('app.user_agent', user_agent, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_user_context(UUID, TEXT) TO authenticated, anon;