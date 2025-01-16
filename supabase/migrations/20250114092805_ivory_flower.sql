/*
  # Fix notifications table relationships

  1. Changes
    - Add proper foreign key relationships for sender_id and user_id
    - Add indexes for better performance
    - Update RLS policies

  2. Security
    - Enable RLS
    - Add policies for user access
*/

-- Drop existing table if it exists to recreate with proper relationships
DROP TABLE IF EXISTS notifications;

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('message', 'connection_request', 'connection_accepted')),
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Create indexes for better performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_sender_id ON notifications(sender_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);