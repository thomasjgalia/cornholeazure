-- Cornhole Tournament Manager Database Schema
-- Note: This schema uses the existing 'players' table shared with the golf app
-- Cornhole-specific tables are prefixed with 'cornhole_' to avoid conflicts

-- Cornhole Events table
CREATE TABLE cornhole_events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  champion_gets_bye BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cornhole Event Teams table
CREATE TABLE cornhole_event_teams (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES cornhole_events(id) ON DELETE CASCADE,
  player1_id INTEGER NOT NULL REFERENCES players(playerid),
  player2_id INTEGER NOT NULL REFERENCES players(playerid),
  is_reigning_champion BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT different_players CHECK (player1_id != player2_id),
  CONSTRAINT unique_team_per_event UNIQUE (event_id, player1_id, player2_id)
);

-- Create unique index to ensure only one reigning champion per event
CREATE UNIQUE INDEX unique_champion_per_cornhole_event
  ON cornhole_event_teams(event_id)
  WHERE is_reigning_champion = TRUE;

-- Cornhole Event Matches table
CREATE TABLE cornhole_event_matches (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES cornhole_events(id) ON DELETE CASCADE,
  round INTEGER NOT NULL, -- positive = Winners Bracket, negative = Losers Bracket
  match_number INTEGER NOT NULL, -- for ordering matches within a round
  team1_id INTEGER REFERENCES cornhole_event_teams(id),
  team2_id INTEGER REFERENCES cornhole_event_teams(id),
  winner_id INTEGER REFERENCES cornhole_event_teams(id),
  loser_id INTEGER REFERENCES cornhole_event_teams(id),
  is_bye BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT positive_match_number CHECK (match_number >= 0)
);

-- Create indexes for better query performance
CREATE INDEX idx_cornhole_event_teams_event_id ON cornhole_event_teams(event_id);
CREATE INDEX idx_cornhole_event_teams_player1 ON cornhole_event_teams(player1_id);
CREATE INDEX idx_cornhole_event_teams_player2 ON cornhole_event_teams(player2_id);
CREATE INDEX idx_cornhole_event_matches_event_id ON cornhole_event_matches(event_id);
CREATE INDEX idx_cornhole_event_matches_round ON cornhole_event_matches(event_id, round);

-- Enable Row Level Security
ALTER TABLE cornhole_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cornhole_event_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE cornhole_event_matches ENABLE ROW LEVEL SECURITY;

-- For public access (no auth), create permissive policies
CREATE POLICY "Allow all operations on cornhole_events" ON cornhole_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on cornhole_event_teams" ON cornhole_event_teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on cornhole_event_matches" ON cornhole_event_matches FOR ALL USING (true) WITH CHECK (true);
