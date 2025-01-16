/*
  # Fix profiles table RLS policies

  1. Changes
    - Add policy for users to insert their own profile
    - Update existing policies for better security

  2. Security
    - Users can only insert their own profile
    - Users can only update their own profile
    - Everyone can view profiles
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Recreate policies with proper permissions
CREATE POLICY "Users can create their own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles
  FOR SELECT
  USING (true);