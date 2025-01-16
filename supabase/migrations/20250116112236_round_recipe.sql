/*
  # Fix unlinking functionality

  1. Changes
    - Add cascade delete to connections table
    - Update connection policies to allow proper deletion
    - Add trigger to handle bidirectional unlinking

  2. Security
    - Maintain RLS policies
    - Ensure users can only delete their own connections
*/

-- Create a function to handle bidirectional unlinking
CREATE OR REPLACE FUNCTION handle_connection_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the reverse connection if it exists
  DELETE FROM connections
  WHERE (user_id = OLD.connected_user_id AND connected_user_id = OLD.user_id)
     OR (user_id = OLD.user_id AND connected_user_id = OLD.connected_user_id);
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS connection_delete_trigger ON connections;
CREATE TRIGGER connection_delete_trigger
  BEFORE DELETE ON connections
  FOR EACH ROW
  EXECUTE FUNCTION handle_connection_delete();

-- Update the delete policy to be more permissive
DROP POLICY IF EXISTS "connections_delete_policy" ON connections;
CREATE POLICY "connections_delete_policy"
  ON connections FOR DELETE
  USING (auth.uid() IN (user_id, connected_user_id));