/*
  # Fix Messaging Functionality

  1. Changes
    - Drop materialized view and related objects
    - Update message policies
    - Add proper indexes
  
  2. Security
    - Ensure proper access control
    - Maintain connection-based restrictions
*/

-- Drop materialized view and related objects
DROP MATERIALIZED VIEW IF EXISTS recent_messages;
DROP TRIGGER IF EXISTS refresh_recent_messages_trigger ON messages;
DROP FUNCTION IF EXISTS refresh_recent_messages();

-- Ensure RLS is enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "messages_view_policy_v2" ON messages;
  DROP POLICY IF EXISTS "messages_create_policy_v2" ON messages;
  DROP POLICY IF EXISTS "messages_select_policy" ON messages;
  DROP POLICY IF EXISTS "messages_insert_policy" ON messages;
EXCEPTION 
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies
CREATE POLICY "messages_read_policy" ON messages
FOR SELECT USING (
  auth.uid() IN (sender_id, receiver_id)
);

CREATE POLICY "messages_insert_policy" ON messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM connections
    WHERE (
      (user_id = auth.uid() AND connected_user_id = receiver_id) OR
      (user_id = receiver_id AND connected_user_id = auth.uid())
    )
    AND status = 'accepted'
  )
);

-- Create efficient indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation
ON messages(sender_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_media_type
ON messages(media_type) WHERE media_type IS NOT NULL;