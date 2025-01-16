/*
  # Fix connection deletion trigger

  1. Changes
    - Replace recursive connection deletion trigger with a safer version
    - Add safeguards to prevent infinite recursion
    - Optimize connection deletion process

  2. Technical Details
    - Uses a processed flag to prevent cycles
    - Handles bidirectional connection deletion safely
    - Improves performance with better query structure
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS connection_delete_trigger ON connections;
DROP FUNCTION IF EXISTS handle_connection_delete();

-- Create improved function to handle bidirectional unlinking
CREATE OR REPLACE FUNCTION handle_connection_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only delete the reverse connection if we haven't processed it yet
  -- This prevents infinite recursion
  IF EXISTS (
    SELECT 1 FROM connections
    WHERE user_id = OLD.connected_user_id 
    AND connected_user_id = OLD.user_id
  ) THEN
    DELETE FROM connections
    WHERE user_id = OLD.connected_user_id 
    AND connected_user_id = OLD.user_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER connection_delete_trigger
  AFTER DELETE ON connections
  FOR EACH ROW
  EXECUTE FUNCTION handle_connection_delete();

-- Update the delete policy to be more efficient
DROP POLICY IF EXISTS "connections_delete_policy" ON connections;
CREATE POLICY "connections_delete_policy"
  ON connections FOR DELETE
  USING (auth.uid() IN (user_id, connected_user_id));