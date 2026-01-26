/**
 * Simple Loss-Tracking Double Elimination Tournament
 *
 * Core concept: Track losses per team (0, 1, or 2)
 * - 2 losses = eliminated
 * - Continue until 2 teams remain for championship
 * - Team with 0 losses must lose twice to be eliminated in championship
 */

// ============================================================================
// Types
// ============================================================================

export interface Team {
  teamId: string;
  teamName: string;
  players: [string, string];
  losses: number; // 0, 1, or 2
  isChampion: boolean;
  hadBye: boolean;
  matchHistory: Array<{
    matchId: string;
    result: "W" | "L";
    opponent: string;
  }>;
  status: "active" | "eliminated" | "champion";
}

export interface Match {
  matchId: string;
  team1: Team;
  team2: Team;
  isChampionship: boolean;
}

export interface TournamentStatus {
  activeTeams: Team[];
  eliminatedTeams: Team[];
  isComplete: boolean;
  championshipReady: boolean;
}

// ============================================================================
// State Management
// ============================================================================

let teams: Team[] = [];
let matchCounter = 0;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Initialize tournament with optional champion team and enrolled players
 */
export function initializeTournament(
  enrolledPlayers: string[],
  championTeam?: { players: [string, string] },
  championGetsBye: boolean = false
): Team[] {
  teams = [];
  matchCounter = 0;

  // Create champion team if provided
  if (championTeam) {
    const champTeam: Team = {
      teamId: generateTeamId(),
      teamName: `${championTeam.players[0]} & ${championTeam.players[1]}`,
      players: championTeam.players,
      losses: 0,
      isChampion: true,
      hadBye: championGetsBye,
      matchHistory: [],
      status: "active",
    };
    teams.push(champTeam);
  }

  // Randomly assign remaining players into teams of 2
  const remainingPlayers = championTeam
    ? enrolledPlayers.filter(
        (p) => !championTeam.players.includes(p)
      )
    : [...enrolledPlayers];

  // Shuffle players for random team assignment
  const shuffled = shuffleArray(remainingPlayers);

  // Create teams from pairs
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      const player1 = shuffled[i]!;
      const player2 = shuffled[i + 1]!;
      const team: Team = {
        teamId: generateTeamId(),
        teamName: `${player1} & ${player2}`,
        players: [player1, player2],
        losses: 0,
        isChampion: false,
        hadBye: false,
        matchHistory: [],
        status: "active",
      };
      teams.push(team);
    }
  }

  return teams;
}

/**
 * Get all teams with their current state
 */
export function getAllTeams(): Team[] {
  return [...teams];
}

/**
 * Get active teams (losses < 2 and not eliminated)
 */
export function getActiveTeams(): Team[] {
  return teams.filter((t) => t.status !== "eliminated" && t.losses < 2);
}

/**
 * Get next match to play, or null if tournament is over
 * Returns match for any active teams (including championship scenarios)
 */
export function getNextMatch(): Match | null {
  const active = getActiveTeams();

  // If 1 or fewer teams remain, tournament is over
  if (active.length <= 1) {
    return null;
  }

  // Pair up teams - take first 2 active teams
  // (In odd number scenario, remaining team waits for next round)
  const team1 = active[0]!;
  const team2 = active[1]!;

  // Check if this is a championship match (only 2 teams left)
  const isChampionship = active.length === 2;

  return {
    matchId: generateMatchId(),
    team1,
    team2,
    isChampionship,
  };
}

/**
 * Get championship match (when only 2 teams remain)
 */
export function getChampionshipMatch(): Match | null {
  const active = getActiveTeams();

  if (active.length !== 2) {
    return null;
  }

  return {
    matchId: generateMatchId(),
    team1: active[0]!,
    team2: active[1]!,
    isChampionship: true,
  };
}

/**
 * Record match outcome and update team states
 */
export function recordMatchResult(
  matchId: string,
  winnerTeamId: string,
  loserTeamId: string
): void {
  const winner = teams.find((t) => t.teamId === winnerTeamId);
  const loser = teams.find((t) => t.teamId === loserTeamId);

  if (!winner || !loser) {
    throw new Error("Invalid team IDs");
  }

  // Update loser's losses
  loser.losses += 1;

  // Check if loser is eliminated
  if (loser.losses === 2) {
    loser.status = "eliminated";
  }

  // Update match history for winner
  winner.matchHistory.push({
    matchId,
    result: "W",
    opponent: loser.teamName,
  });

  // Update match history for loser
  loser.matchHistory.push({
    matchId,
    result: "L",
    opponent: winner.teamName,
  });

  // Check if tournament is complete
  const active = getActiveTeams();
  if (active.length === 1 && active[0]) {
    active[0].status = "champion";
  }
}

/**
 * Get tournament status
 */
export function getTournamentStatus(): TournamentStatus {
  const active = getActiveTeams();
  const eliminated = teams.filter((t) => t.status === "eliminated");
  const isComplete = active.length <= 1;
  const championshipReady = active.length === 2;

  return {
    activeTeams: active,
    eliminatedTeams: eliminated,
    isComplete,
    championshipReady,
  };
}

/**
 * Reset tournament state (useful for testing)
 */
export function resetTournament(): void {
  teams = [];
  matchCounter = 0;
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateTeamId(): string {
  return `team_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function generateMatchId(): string {
  matchCounter += 1;
  return `match_${matchCounter}_${Date.now()}`;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}
