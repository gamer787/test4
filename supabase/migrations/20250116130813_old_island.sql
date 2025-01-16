/*
  # Add sharing functionality

  1. Changes
    - Add sharing table for tracking shared content
    - Add sharing policies for connected users
    - Add external sharing capabilities

  2. Security
    - Enable RLS for sharing table
    - Ensure proper access control
*/

-- Create shares table
CREATE TABLE IF NOT EXISTS shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  shared_with_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  external_platform text CHECK (external_platform IN ('whatsapp', 'telegram', 'messenger')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT share_type_check CHECK (
    (shared_with_id IS NOT NULL AND external_platform IS NULL) OR
    (shared_with_id IS NULL AND external_platform IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create shares"
  ON shares
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    (
      -- Allow sharing with connected users
      (shared_with_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM connections
        WHERE (
          (user_id = auth.uid() AND connected_user_id = shared_with_id) OR
          (user_id = shared_with_id AND connected_user_id = auth.uid())
        )
        AND status = 'accepted'
      )) OR
      -- Allow external sharing
      (external_platform IS NOT NULL)
    )
  );

CREATE POLICY "Users can view shares"
  ON shares
  FOR SELECT
  USING (
    auth.uid() IN (user_id, shared_with_id)
  );

-- Create indexes
CREATE INDEX idx_shares_user ON shares(user_id);
CREATE INDEX idx_shares_post ON shares(post_id);
CREATE INDEX idx_shares_shared_with ON shares(shared_with_id) WHERE shared_with_id IS NOT NULL;
CREATE INDEX idx_shares_external ON shares(external_platform) WHERE external_platform IS NOT NULL;