/*
  # Add comments functionality

  1. Tables
    - Add comments table with:
      - id (uuid)
      - post_id (uuid)
      - user_id (uuid)
      - content (text)
      - created_at (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for:
      - Viewing comments (public)
      - Creating comments (authenticated users)
      - Deleting own comments

  3. Notifications
    - Add trigger for comment notifications
*/

-- Create comments table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'comments') THEN
    CREATE TABLE comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
      user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
      content text NOT NULL,
      created_at timestamptz DEFAULT now(),
      CONSTRAINT content_length CHECK (char_length(content) <= 500)
    );

    -- Enable RLS
    ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "comments_view_policy"
      ON comments FOR SELECT
      USING (true);

    CREATE POLICY "comments_create_policy"
      ON comments FOR INSERT
      WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
          SELECT 1 FROM posts p
          WHERE p.id = post_id
          AND EXISTS (
            SELECT 1 FROM connections c
            WHERE (
              (c.user_id = auth.uid() AND c.connected_user_id = p.user_id) OR
              (c.user_id = p.user_id AND c.connected_user_id = auth.uid())
            )
            AND c.status = 'accepted'
          )
        )
      );

    CREATE POLICY "comments_delete_policy"
      ON comments FOR DELETE
      USING (auth.uid() = user_id);

    -- Create indexes
    CREATE INDEX idx_comments_post_id ON comments(post_id);
    CREATE INDEX idx_comments_user_id ON comments(user_id);
    CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
  END IF;
END $$;

-- Create notification function if it doesn't exist
CREATE OR REPLACE FUNCTION handle_comment_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't create notification if user is commenting on their own post
  IF NEW.user_id != (SELECT user_id FROM posts WHERE id = NEW.post_id) THEN
    INSERT INTO notifications (
      user_id,
      sender_id,
      type,
      content,
      created_at,
      read
    ) VALUES (
      (SELECT user_id FROM posts WHERE id = NEW.post_id),
      NEW.user_id,
      'comment',
      'commented on your post',
      now(),
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'comment_notification_trigger'
  ) THEN
    CREATE TRIGGER comment_notification_trigger
      AFTER INSERT ON comments
      FOR EACH ROW
      EXECUTE FUNCTION handle_comment_notification();
  END IF;
END $$;