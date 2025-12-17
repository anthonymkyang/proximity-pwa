-- Add message_type and metadata columns to messages table
ALTER TABLE messages
ADD COLUMN message_type TEXT DEFAULT NULL CHECK (message_type IN ('text', 'location')),
ADD COLUMN metadata JSONB DEFAULT NULL;

-- Add index on message_type for faster filtering
CREATE INDEX idx_messages_message_type ON messages(message_type);

-- Add comment
COMMENT ON COLUMN messages.message_type IS 'Type of message: text, location, etc.';
COMMENT ON COLUMN messages.metadata IS 'JSON metadata for non-text messages (location coordinates, etc.)';
