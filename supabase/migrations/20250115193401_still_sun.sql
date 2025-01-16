-- Create storage bucket for media
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for public read access to media bucket
CREATE POLICY "Media items are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

-- Policy for authenticated users to upload media
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'media' 
  AND auth.role() = 'authenticated'
);

-- Policy for users to delete their own media
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);