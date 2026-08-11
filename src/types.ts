// Database table types
// Note: Players table is shared with golf app
export interface PlayerRow {
  playerid: number
  firstname: string
  lastname: string
  email?: string
  handicap?: number
  phone?: string
  // Write-only: sent on create/update, never returned by the API.
  profile_secret?: string
  // Returned by the API instead of profile_secret, so the UI can show
  // whether a secret is set without ever seeing its value.
  has_secret?: boolean
  created_at?: string
  updated_at?: string
}

export interface EventRow {
  id: number
  name: string
  date: string
  champion_gets_bye: boolean
  created_at?: string
}

export interface EventTeamRow {
  id: number
  event_id: number
  player1_id: number
  player2_id: number
  is_reigning_champion: boolean
  created_at?: string
}

export interface EventMatchRow {
  id: number
  event_id: number
  round: number // positive = Winners Bracket, negative = Losers Bracket
  match_number: number
  team1_id: number | null
  team2_id: number | null
  winner_id: number | null
  loser_id: number | null
  is_bye: boolean
  created_at?: string
}

// Extended types with joined data
export interface TeamWithPlayers extends EventTeamRow {
  player1?: PlayerRow
  player2?: PlayerRow
}

export interface MatchWithTeams extends EventMatchRow {
  team1?: TeamWithPlayers
  team2?: TeamWithPlayers
  winner?: TeamWithPlayers
}
