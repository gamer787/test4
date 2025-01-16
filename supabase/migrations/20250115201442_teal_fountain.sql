/*
  # Fix storage policies for media and avatars
  
  1. Changes
    - Create storage buckets if they don't exist
    - Set up unified policies for both buckets
    - Enable public read access
    - Secure write/delete access
  
  2. Security
    - Public read access for all media
    - Authenticated users can upload to their folders
    - Users can only delete their own files
*/

-- Create buckets if they don't exist
DO $$ 
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES 
    ('media', 'media', true),
    ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

  -- Drop existing policies to avoid conflicts
  DROP POLICY IF EXISTS "Media items are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
  DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Public Read" ON storage.objects;
  DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
  DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;

  -- Create new unified policies
  CREATE POLICY "storage_public_read" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id IN ('media', 'avatars'));

  CREATE POLICY "storage_auth_upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id IN ('media', 'avatars')
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  CREATE POLICY "storage_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id IN ('media', 'avatars')
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;