/*
  # Update notifications table type constraint

  1. Changes
    - Add 'comment' to allowed notification types

  2. Details
    - Updates CHECK constraint for notification types
    - Maintains existing types while adding new one
*/

-- Update the notifications table type constraint
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('message', 'connection_request', 'connection_accepted', 'comment'));