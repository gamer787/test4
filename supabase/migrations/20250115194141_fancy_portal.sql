/*
  # Fix posts table constraints

  1. Changes
    - Make image_url nullable to support different post types
    - Add check constraint to ensure at least one media type is present
    - Add check constraint to validate media URLs match post type

  2. Security
    - Existing RLS policies remain unchanged
*/

-- Make image_url nullable
ALTER TABLE posts ALTER COLUMN image_url DROP NOT NULL;

-- Add check constraint to ensure at least one media type is present
ALTER TABLE posts ADD CONSTRAINT posts_media_check
  CHECK (
    CASE
      WHEN type = 'post' THEN image_url IS NOT NULL AND video_url IS NULL
      WHEN type = 'reel' THEN video_url IS NOT NULL AND image_url IS NULL
      WHEN type = 'thread' THEN caption IS NOT NULL
      ELSE false
    END
  );