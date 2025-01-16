-- Add new profile fields
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS occupation text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS website text;

-- Update RLS policies
CREATE POLICY "Users can update their own profile fields"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);