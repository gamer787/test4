-- Drop existing notification policies
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;

-- Create improved notification policies
CREATE POLICY "notifications_select_policy"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_policy"
  ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND (
      -- Allow notifications for connection-related activities without requiring an existing connection
      (type IN ('connection_request', 'connection_accepted')) OR
      -- For other notification types, require an existing connection
      EXISTS (
        SELECT 1 FROM connections
        WHERE (
          (user_id = auth.uid() AND connected_user_id = notifications.user_id) OR
          (user_id = notifications.user_id AND connected_user_id = auth.uid())
        )
        AND status = 'accepted'
      )
    )
  );

CREATE POLICY "notifications_update_policy"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_sender 
ON notifications(user_id, sender_id);