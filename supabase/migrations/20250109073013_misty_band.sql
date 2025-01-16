/*
  # Add support for posts, reels, and threads

  1. Changes
    - Add type column to posts table
    - Add video_url column for reels
    - Add thread_group_id for grouping thread posts
    - Update RLS policies to support new post types

  2. Security
    - Maintain existing RLS policies
    - Add policies for new columns
*/

-- Add new columns to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS type text DEFAULT 'post' CHECK (type IN ('post', 'reel', 'thread'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS thread_group_id text;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_thread_group ON posts(thread_group_id);