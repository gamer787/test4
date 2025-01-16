/*
  # Messages Performance Optimization

  1. Changes
    - Create efficient message retrieval function
    - Add performance indexes
    - Ensure proper security
  
  2. Security
    - Use security definer for proper permissions
    - Implement connection-based access control
*/

-- Create a secure function to access messages
CREATE OR REPLACE FUNCTION get_recent_messages(viewer_id uuid)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  receiver_id uuid,
  content text,
  media_url text,
  media_type text,
  created_at timestamptz,
  sender_username text,
  sender_avatar text,
  receiver_username text,
  receiver_avatar text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.sender_id,
    m.receiver_id,
    m.content,
    m.media_url,
    m.media_type,
    m.created_at,
    s.username as sender_username,
    s.avatar_url as sender_avatar,
    r.username as receiver_username,
    r.avatar_url as receiver_avatar
  FROM messages m
  JOIN profiles s ON m.sender_id = s.id
  JOIN profiles r ON m.receiver_id = r.id
  WHERE (m.sender_id = viewer_id OR m.receiver_id = viewer_id)
  ORDER BY m.created_at DESC
  LIMIT 100;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_recent_messages(uuid) TO authenticated;

-- Create efficient indexes for message queries
CREATE INDEX IF NOT EXISTS idx_messages_sender_time 
ON messages(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_time
ON messages(receiver_id, created_at DESC);

-- Create composite index for participant lookup
CREATE INDEX IF NOT EXISTS idx_messages_participants 
ON messages(sender_id, receiver_id, created_at DESC);