// Database table types
// Note: player identity comes from SOLDelco's shared `members` table --
// this app has no player records of its own (see /api/players).
export interface PlayerRow {
  playerid: number
  firstname: string
  lastname: string
}

export interface EventRow {
  id: number
  name: string
  date: string
  champion_gets_bye: boolean
  created_at?: string
  // Link to a SOLDelco event/competition -- set once the tournament's
  // champion should be reflected on soldelco.com/records. See BracketPage's
  // sync UI; not every tournament needs to be linked.
  soldelco_event_id?: number | null
  soldelco_competition_id?: number | null
}

export interface SoldelcoEventRow {
  id: number
  title: string
  slug: string
  starts_at: string | null
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
