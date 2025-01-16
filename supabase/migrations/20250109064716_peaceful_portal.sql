/*
  # Initial Schema for Instagram Clone

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key)
      - `username` (text, unique)
      - `avatar_url` (text)
      - `created_at` (timestamp)
    - `posts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `image_url` (text)
      - `caption` (text)
      - `created_at` (timestamp)
    - `likes`
      - `id` (uuid, primary key)
      - `post_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `created_at` (timestamp)
    - `comments`
      - `id` (uuid, primary key)
      - `post_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `content` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  username text UNIQUE NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  image_url text NOT NULL,
  caption text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts are viewable by everyone"
  ON posts
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own posts"
  ON posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Likes table
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes are viewable by everyone"
  ON likes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own likes"
  ON likes
  FOR ALL
  USING (auth.uid() = user_id);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone"
  ON comments
  FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own comments"
  ON comments
  FOR ALL
  USING (auth.uid() = user_id);