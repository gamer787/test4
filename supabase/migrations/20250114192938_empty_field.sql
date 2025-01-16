/*
  # Add provider status to connections table

  1. Changes
    - Add provider as valid connection status
    - Add policy for upgrading connections to provider status
*/

-- Update status check to include provider status
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_status_check;
ALTER TABLE connections ADD CONSTRAINT connections_status_check 
  CHECK (status IN ('pending', 'accepted', 'provider'));

-- Add policy for upgrading to provider status
CREATE POLICY "Users can upgrade their connections to provider"
  ON connections
  FOR UPDATE
  USING (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM connections
      WHERE id = connections.id
      AND status = 'accepted'
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    status = 'provider'
  );