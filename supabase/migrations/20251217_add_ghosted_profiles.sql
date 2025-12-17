-- Create ghosted_profiles table to track users who have ghosted the current user
-- This allows users to mark profiles that have stopped responding/ghosted them

CREATE TABLE IF NOT EXISTS ghosted_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ghosted_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  notes text,
  UNIQUE(user_id, ghosted_profile_id)
);

-- Index for faster lookups
CREATE INDEX idx_ghosted_profiles_user_id ON ghosted_profiles(user_id);
CREATE INDEX idx_ghosted_profiles_ghosted_profile_id ON ghosted_profiles(ghosted_profile_id);

-- RLS policies
ALTER TABLE ghosted_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see their own ghosted profiles
CREATE POLICY "Users can view their own ghosted profiles"
  ON ghosted_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can mark profiles as ghosted
CREATE POLICY "Users can mark profiles as ghosted"
  ON ghosted_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can unmark profiles as ghosted
CREATE POLICY "Users can unmark profiles as ghosted"
  ON ghosted_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their ghosted profile notes
CREATE POLICY "Users can update their ghosted profile notes"
  ON ghosted_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Comment on table
COMMENT ON TABLE ghosted_profiles IS 'Tracks profiles that users have marked as having ghosted them';
COMMENT ON COLUMN ghosted_profiles.user_id IS 'The user who is marking someone as ghosted';
COMMENT ON COLUMN ghosted_profiles.ghosted_profile_id IS 'The profile that ghosted the user';
COMMENT ON COLUMN ghosted_profiles.notes IS 'Optional notes about why/when they were ghosted';
