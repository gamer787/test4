/*
  # Fix connections table and dependent policies

  1. Changes
    - Update dependent policies to handle connections properly
    - Recreate connections table with proper constraints
    - Add cascading deletes for better cleanup
    
  2. Security
    - Enable RLS
    - Add policies for proper connection management
*/

-- First, update the messages policies to remove dependencies
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can share posts with connections" ON messages;

-- Create new messages policies that will work with the new connections structure
CREATE POLICY "messages_send_policy" ON messages
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

-- Now we can safely handle the connections table
CREATE TABLE IF NOT EXISTS connections_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connected_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'provider')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, connected_user_id)
);

-- Copy existing data
INSERT INTO connections_new (id, user_id, connected_user_id, status, created_at)
SELECT id, user_id, connected_user_id, status, created_at
FROM connections;

-- Drop old table and rename new one
DROP TABLE IF EXISTS connections CASCADE;
ALTER TABLE connections_new RENAME TO connections;

-- Enable RLS
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "connections_select_policy"
  ON connections FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = connected_user_id);

CREATE POLICY "connections_insert_policy"
  ON connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "connections_delete_policy"
  ON connections FOR DELETE
  USING (auth.uid() IN (user_id, connected_user_id));

CREATE POLICY "connections_update_policy"
  ON connections FOR UPDATE
  USING (auth.uid() IN (user_id, connected_user_id))
  WITH CHECK (
    CASE
      WHEN auth.uid() = connected_user_id THEN
        status = 'accepted'
      WHEN auth.uid() = user_id THEN
        status = 'provider'
      ELSE
        false
    END
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_connected_user_id ON connections(connected_user_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);