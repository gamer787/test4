/*
  # Add messages table and policies

  1. New Tables
    - `messages`
      - `id` (uuid, primary key)
      - `sender_id` (uuid, references profiles)
      - `receiver_id` (uuid, references profiles)
      - `content` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on messages table
    - Add policies for message creation and viewing
*/

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages they sent or received
CREATE POLICY "Users can view their own messages"
  ON messages
  FOR SELECT
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id
  );

-- Users can send messages
CREATE POLICY "Users can send messages"
  ON messages
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

-- Create indexes for better performance
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);