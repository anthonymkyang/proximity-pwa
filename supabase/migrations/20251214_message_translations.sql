-- Add translation storage to messages table
-- This stores client-side translations so they persist across sessions

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS translation JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN messages.translation IS 'Stores client-side translation data in format: {"translatedText": "...", "detectedLanguage": "...", "targetLanguage": "..."}';

-- Create an index for faster queries on translated messages
CREATE INDEX IF NOT EXISTS idx_messages_translation ON messages USING GIN (translation);
