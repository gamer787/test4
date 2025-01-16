/*
  # Add thread structure and sharing functionality

  1. Thread Structure
    - Add parent_id and thread_level columns to posts table
    - Add constraints to ensure proper thread hierarchy
    
  2. Sharing Updates
    - Add sharing fields to messages table
    - Update policies for shared content access
*/

-- Add thread structure to posts if not exists
DO $$ 
BEGIN
  -- Add parent_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'posts' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE posts ADD COLUMN parent_id uuid REFERENCES posts(id) ON DELETE CASCADE;
  END IF;

  -- Add thread_level if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'posts' AND column_name = 'thread_level'
  ) THEN
    ALTER TABLE posts ADD COLUMN thread_level integer DEFAULT 0;
  END IF;
END $$;

-- Create indexes for thread queries if they don't exist
CREATE INDEX IF NOT EXISTS idx_posts_parent_id ON posts(parent_id);
CREATE INDEX IF NOT EXISTS idx_posts_thread_level ON posts(thread_level);

-- Add thread level constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'thread_level_limit'
  ) THEN
    ALTER TABLE posts
    ADD CONSTRAINT thread_level_limit
    CHECK (thread_level <= 2);
  END IF;
END $$;

-- Add sharing fields to messages if they don't exist
DO $$ 
BEGIN
  -- Add shared_post_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'shared_post_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN shared_post_id uuid REFERENCES posts(id) ON DELETE SET NULL;
  END IF;

  -- Add shared_post_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'shared_post_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN shared_post_type text;
  END IF;
END $$;

-- Create index for shared posts if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_messages_shared_post ON messages(shared_post_id);

-- Update messages policies
DO $$ 
BEGIN
  -- Drop the policy if it exists
  DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
  
  -- Create new policy
  CREATE POLICY "Users can view their own messages"
    ON messages
    FOR SELECT
    USING (
      auth.uid() = sender_id OR 
      auth.uid() = receiver_id OR
      EXISTS (
        SELECT 1 FROM posts 
        WHERE id = messages.shared_post_id 
        AND user_id = auth.uid()
      )
    );
END $$;