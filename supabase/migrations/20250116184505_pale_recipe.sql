-- Update notifications type check constraint
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('message', 'connection_request', 'connection_accepted', 'comment', 'share'));

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;

-- Create comprehensive notification policies
CREATE POLICY "notifications_select_policy"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_policy"
  ON notifications FOR INSERT
  WITH CHECK (
    -- Allow users to create notifications for others or themselves
    (auth.uid() = sender_id) AND
    -- Ensure user_id is either the sender or receiver
    (user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM connections
      WHERE (
        (user_id = auth.uid() AND connected_user_id = notifications.user_id) OR
        (user_id = notifications.user_id AND connected_user_id = auth.uid())
      )
    ))
  );

CREATE POLICY "notifications_update_policy"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for notifications by type
CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON notifications(type, created_at DESC);