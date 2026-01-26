-- Add profile_secret field to existing players table
-- This allows players to claim their profile with a simple secret code

ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_secret TEXT;

-- Optional: Create an index for faster lookups when validating secrets
CREATE INDEX IF NOT EXISTS idx_players_profile_secret ON players(profile_secret) WHERE profile_secret IS NOT NULL;

-- Example: Update existing players with secrets
-- You can run queries like this to set secrets for your players:
-- UPDATE players SET profile_secret = '1234' WHERE playerid = 1;
-- UPDATE players SET profile_secret = 'golf' WHERE playerid = 2;
