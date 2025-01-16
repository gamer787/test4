/*
  # Add multimedia support to messages

  1. Changes
    - Add media columns to messages table
    - Add media type constraint
    - Add indexes for better performance

  2. Details
    - Supports images and videos in messages
    - Maintains existing message functionality
    - Improves query performance
*/

-- Add media support to messages
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'video'));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_media ON messages(media_type) WHERE media_type IS NOT NULL;

-- Create materialized view for recent messages
CREATE MATERIALIZED VIEW IF NOT EXISTS recent_messages AS
SELECT 
  m.*,
  s.username as sender_username,
  s.avatar_url as sender_avatar,
  r.username as receiver_username,
  r.avatar_url as receiver_avatar
FROM messages m
JOIN profiles s ON m.sender_id = s.id
JOIN profiles r ON m.receiver_id = r.id
WHERE m.created_at > (NOW() - INTERVAL '7 days')
ORDER BY m.created_at DESC;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_recent_messages_id ON recent_messages(id);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_recent_messages()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY recent_messages;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh view
CREATE TRIGGER refresh_recent_messages_trigger
AFTER INSERT OR UPDATE OR DELETE ON messages
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_recent_messages();