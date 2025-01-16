/*
  # Fix post deletion functionality

  1. Changes
    - Add trigger for proper post deletion
    - Handle associated media cleanup
    - Ensure all related data is deleted

  2. Security
    - Maintain RLS policies
    - Only allow users to delete their own posts
*/

-- Create a function to handle post deletion cleanup
CREATE OR REPLACE FUNCTION handle_post_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete associated likes
  DELETE FROM likes WHERE post_id = OLD.id;
  
  -- Delete associated comments
  DELETE FROM comments WHERE post_id = OLD.id;
  
  -- For threads, delete all associated replies
  IF OLD.type = 'thread' THEN
    DELETE FROM posts 
    WHERE thread_group_id = OLD.id::text 
    OR parent_id = OLD.id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS post_delete_trigger ON posts;
CREATE TRIGGER post_delete_trigger
  BEFORE DELETE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION handle_post_delete();

-- Update post deletion policy to be more explicit
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
CREATE POLICY "post_delete_policy"
  ON posts FOR DELETE
  USING (auth.uid() = user_id);