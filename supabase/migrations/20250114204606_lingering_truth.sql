/*
  # Add bio field to profiles table

  1. Changes
    - Add bio column to profiles table
    - Set default value to empty string
    - Make it nullable
*/

-- Add bio column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bio text DEFAULT '';
  END IF;
END $$;