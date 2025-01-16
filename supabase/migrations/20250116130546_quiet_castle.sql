/*
  # Fix media messages

  1. Changes
    - Add storage policies for media access
    - Update message policies to include media access
    - Add indexes for media queries

  2. Security
    - Enable public read access for media files
    - Ensure proper RLS for message media
*/

-- Create storage bucket for messages if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('messages', 'messages', true)
ON CONFLICT (id) DO NOTHING;

-- Enable public read access for message media
CREATE POLICY "Public read access for messages media"
ON storage.objects FOR SELECT
USING (bucket_id = 'messages');

-- Allow authenticated users to upload message media
CREATE POLICY "Authenticated users can upload message media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'messages' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own message media
CREATE POLICY "Users can delete their own message media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'messages'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Update message policies to handle media
DROP POLICY IF EXISTS "messages_read_policy" ON messages;
CREATE POLICY "messages_read_policy" ON messages
FOR SELECT USING (
  auth.uid() IN (sender_id, receiver_id)
);

-- Add indexes for media queries if they don't exist
CREATE INDEX IF NOT EXISTS idx_messages_media_type_url
ON messages(media_type, media_url)
WHERE media_type IS NOT NULL;

-- Grant storage access to authenticated users
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;