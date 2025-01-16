/*
  # Add Media Support to Messages

  1. Changes
    - Add media support columns
    - Add performance indexes
  
  2. Security
    - Ensure proper column constraints
*/

-- Add media support to messages
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'video'));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_media 
ON messages(media_type, created_at DESC) 
WHERE media_type IS NOT NULL;

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_messages_recent
ON messages(sender_id, receiver_id, created_at DESC);