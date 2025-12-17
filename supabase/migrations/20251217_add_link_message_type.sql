-- Add 'link' to message_type enum
ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE messages
ADD CONSTRAINT messages_message_type_check
CHECK (message_type IN ('text', 'location', 'link'));

-- Update comment
COMMENT ON COLUMN messages.message_type IS 'Type of message: text, location, link, etc.';
