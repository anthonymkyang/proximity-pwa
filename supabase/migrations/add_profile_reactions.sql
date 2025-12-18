-- Profile reactions table
-- Stores emoji reactions from users to other users' profiles
CREATE TABLE IF NOT EXISTS public.profile_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('heart', 'fire', 'imp', 'peeking')),
  context TEXT DEFAULT 'profile:react',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Each user can only have one reaction per profile
  UNIQUE(from_user_id, to_user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_reactions_from_user ON public.profile_reactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_reactions_to_user ON public.profile_reactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_reactions_created_at ON public.profile_reactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.profile_reactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view reactions on any profile
CREATE POLICY "Users can view all profile reactions"
  ON public.profile_reactions
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Users can insert their own reactions
CREATE POLICY "Users can insert their own reactions"
  ON public.profile_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

-- Policy: Users can update their own reactions
CREATE POLICY "Users can update their own reactions"
  ON public.profile_reactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = from_user_id)
  WITH CHECK (auth.uid() = from_user_id);

-- Policy: Users can delete their own reactions
CREATE POLICY "Users can delete their own reactions"
  ON public.profile_reactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = from_user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_profile_reactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_profile_reactions_updated_at
  BEFORE UPDATE ON public.profile_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_reactions_updated_at();

-- Grant permissions
GRANT SELECT ON public.profile_reactions TO authenticated;
GRANT INSERT ON public.profile_reactions TO authenticated;
GRANT UPDATE ON public.profile_reactions TO authenticated;
GRANT DELETE ON public.profile_reactions TO authenticated;
