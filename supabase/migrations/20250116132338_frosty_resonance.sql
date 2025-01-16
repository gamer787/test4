-- Update notifications type check constraint
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('message', 'connection_request', 'connection_accepted', 'comment', 'share'));

-- Create index for notifications by type
CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON notifications(type, created_at DESC);