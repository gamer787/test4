/*
  # Update storage policies for media access
  
  1. Storage Policies
    - Allow public read access to all media files
    - Allow authenticated users to upload media files
    - Allow users to delete their own media files
  
  2. Changes
    - Add policies for media bucket
    - Add policies for avatars bucket
*/

-- Update media bucket policies
DROP POLICY IF EXISTS "Media items are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;

CREATE POLICY "Media items are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id IN ('media', 'avatars'));

CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id IN ('media', 'avatars')
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
USING (
  bucket_id IN ('media', 'avatars')
  AND auth.uid()::text = (storage.foldername(name))[1]
);