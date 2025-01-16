/*
  # Add connections and presence tracking

  1. New Tables
    - `connections`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `connected_user_id` (uuid, references profiles)
      - `status` (text, either 'pending' or 'accepted')
      - `created_at` (timestamp)

  2. Changes to Existing Tables
    - Add to `profiles`:
      - `last_seen` (timestamp)
      - `status` (text)
      - `bluetooth_id` (text)

  3. Security
    - Enable RLS on connections table
    - Add policies for managing connections
*/

-- Add presence fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'offline';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bluetooth_id text;

-- Create connections table
CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  connected_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, connected_user_id)
);

-- Enable RLS
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Policies for connections
CREATE POLICY "Users can view their own connections"
  ON connections
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    auth.uid() = connected_user_id
  );

CREATE POLICY "Users can create connection requests"
  ON connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Recipients can accept connections"
  ON connections
  FOR UPDATE
  USING (auth.uid() = connected_user_id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_connected_user_id ON connections(connected_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen);