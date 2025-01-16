-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS post_delete_cascade_trigger ON posts;

-- Create a function to handle cascading deletes for posts
CREATE OR REPLACE FUNCTION handle_post_cascade_delete()
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
CREATE TRIGGER post_delete_cascade_trigger
  BEFORE DELETE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION handle_post_cascade_delete();

-- Update post policies
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
CREATE POLICY "Users can delete their own posts"
  ON posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_posts_thread_group_id ON posts(thread_group_id);
CREATE INDEX IF NOT EXISTS idx_posts_parent_id ON posts(parent_id);