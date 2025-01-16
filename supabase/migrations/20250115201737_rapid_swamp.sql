/*
  # Fix storage access and policies
  
  1. Changes
    - Create storage buckets with proper configuration
    - Set up unified storage policies
    - Enable public read access
    - Configure secure upload paths
  
  2. Security
    - Public read access for media and avatars
    - Authenticated users can upload to their folders
    - Users can only delete their own files
*/

-- Create storage buckets if they don't exist
DO $$ 
BEGIN
  -- Create buckets
  INSERT INTO storage.buckets (id, name, public)
  VALUES 
    ('media', 'media', true),
    ('avatars', 'avatars', true)
  ON CONFLICT (id) DO UPDATE
  SET public = true;

  -- Drop any existing policies to avoid conflicts
  DROP POLICY IF EXISTS "Media items are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
  DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Public Read" ON storage.objects;
  DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
  DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;
  DROP POLICY IF EXISTS "storage_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "storage_auth_upload" ON storage.objects;
  DROP POLICY IF EXISTS "storage_owner_delete" ON storage.objects;

  -- Create new storage policies with proper configuration
  CREATE POLICY "allow_public_read"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id IN ('media', 'avatars'));

  CREATE POLICY "allow_authenticated_upload"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id IN ('media', 'avatars')
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  CREATE POLICY "allow_authenticated_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id IN ('media', 'avatars')
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  -- Enable RLS
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
END $$;