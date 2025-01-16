/*
  # Add sharing functionality
  
  1. Changes
    - Add shared_post_id and shared_post_type to messages table
    - Update RLS policies for shared content
    - Add indexes for performance
*/

-- Add sharing fields to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS shared_post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS shared_post_type text;

-- Create index for shared posts
CREATE INDEX IF NOT EXISTS idx_messages_shared_post ON messages(shared_post_id);

-- Update messages policies
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;

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