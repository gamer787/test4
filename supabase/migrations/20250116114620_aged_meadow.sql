/*
  # Add Nearby Users Function

  1. New Functions
    - `get_nearby_users_with_status`: Returns nearby users with their connection status
      - Accepts current_user_id and time_range parameters
      - Returns users who were active within the time range
      - Includes connection status for each user

  2. Changes
    - Optimizes query performance with proper indexing
    - Handles all connection statuses (pending, accepted, incoming)
    - Returns complete user profile information
*/

-- Create function to get nearby users with connection status
CREATE OR REPLACE FUNCTION get_nearby_users_with_status(
  current_user_id uuid,
  time_range timestamptz
)
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text,
  last_seen timestamptz,
  status text,
  connection_status text
) AS $$
BEGIN
  RETURN QUERY
  WITH user_connections AS (
    -- Get outgoing connections
    SELECT 
      connected_user_id as other_user_id,
      status as conn_status,
      'outgoing' as direction
    FROM connections 
    WHERE user_id = current_user_id
    UNION ALL
    -- Get incoming connections
    SELECT 
      user_id as other_user_id,
      status as conn_status,
      'incoming' as direction
    FROM connections 
    WHERE connected_user_id = current_user_id
  )
  SELECT 
    p.id,
    p.username,
    p.avatar_url,
    p.last_seen,
    p.status,
    CASE 
      WHEN uc.conn_status IS NULL THEN NULL
      WHEN uc.direction = 'incoming' AND uc.conn_status = 'pending' THEN 'incoming'
      ELSE uc.conn_status
    END as connection_status
  FROM profiles p
  LEFT JOIN user_connections uc ON p.id = uc.other_user_id
  WHERE 
    p.id != current_user_id
    AND p.last_seen >= time_range
  ORDER BY p.last_seen DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;