/*
  # Update Messages RLS Policies

  1. Changes
    - Add comprehensive RLS policies for messages table
    - Allow sending messages with media between connected users
    - Ensure proper access control for message viewing and creation
  
  2. Security
    - Only connected users can send messages to each other
    - Users can only view messages they sent or received
    - Messages are protected by connection status check
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "messages_send_policy" ON messages;

-- Create new comprehensive policies
CREATE POLICY "messages_select_policy" ON messages
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

-- Add index for faster connection checks
CREATE INDEX IF NOT EXISTS idx_messages_participants 
ON messages(sender_id, receiver_id);