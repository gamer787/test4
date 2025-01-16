/*
  # Update Message Policies

  1. Changes
    - Update RLS policies for messages
    - Add performance indexes
  
  2. Security
    - Ensure proper access control
    - Maintain connection-based restrictions
*/

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Attempt to drop each policy individually
  BEGIN
    DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
  EXCEPTION 
    WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can send messages" ON messages;
  EXCEPTION 
    WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "messages_send_policy" ON messages;
  EXCEPTION 
    WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "messages_select_policy" ON messages;
  EXCEPTION 
    WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "messages_insert_policy" ON messages;
  EXCEPTION 
    WHEN undefined_object THEN NULL;
  END;
END $$;

-- Create new comprehensive policies with unique names
CREATE POLICY "messages_view_policy_v2" ON messages
FOR SELECT USING (
  auth.uid() IN (sender_id, receiver_id)
);

CREATE POLICY "messages_create_policy_v2" ON messages
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

-- Add index for faster connection checks if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_messages_participants_v2
ON messages(sender_id, receiver_id);