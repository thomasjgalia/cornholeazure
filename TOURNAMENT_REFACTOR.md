# Tournament System Refactor - Migration Guide

## Overview

The cornhole tournament system has been refactored from a complex bracket-based system to a simple loss-tracking double elimination tournament.

## What Changed

### Old System ([bracketLogic.ts](src/lib/bracketLogic.ts))
- Complex bracket structure with winners/losers brackets
- Round-based match numbering
- Complicated bye handling and match progression logic
- Difficult to debug and maintain
- ~437 lines of complex code

### New System ([tournamentLogic.ts](src/lib/tournamentLogic.ts))
- Simple loss counting (0, 1, or 2 losses per team)
- No bracket structure - just pair up active teams
- Easy to understand and maintain
- ~280 lines of clean, readable code

## Core Concepts

### Team Structure
```typescript
interface Team {
  teamId: string;
  teamName: string;
  players: [string, string];
  losses: number;  // 0, 1, or 2
  isChampion: boolean;
  hadBye: boolean;
  matchHistory: Array<{
    matchId: string;
    result: "W" | "L";
    opponent: string;
  }>;
  status: "active" | "eliminated" | "champion";
}
```

### Tournament Rules
1. Each team can have 0, 1, or 2 losses
2. A team with 2 losses is eliminated
3. Tournament continues until only 2 teams remain
4. Championship: team with 0 losses must lose twice to be eliminated

## API Reference

### Initialize Tournament
```typescript
initializeTournament(
  enrolledPlayers: string[],
  championTeam?: { players: [string, string] },
  championGetsBye: boolean = false
): Team[]
```

**Example:**
```typescript
// 4 teams, no champion
const teams = initializeTournament([
  "Alice", "Bob", "Charlie", "Dave",
  "Eve", "Frank", "Grace", "Henry"
]);

// With reigning champion
const teams = initializeTournament(
  ["Alice", "Bob", "Charlie", "Dave", "Eve", "Frank"],
  { players: ["Alice", "Bob"] },
  true  // champion gets bye
);
```

### Get Next Match
```typescript
getNextMatch(): Match | null
```

Returns the next match to play, or `null` if only 2 teams remain (championship ready).

**Example:**
```typescript
const match = getNextMatch();
if (match) {
  console.log(`${match.team1.teamName} vs ${match.team2.teamName}`);
}
```

### Get Championship Match
```typescript
getChampionshipMatch(): Match | null
```

Returns championship match when exactly 2 teams remain.

**Example:**
```typescript
const champMatch = getChampionshipMatch();
if (champMatch) {
  console.log("Championship time!");
}
```

### Record Match Result
```typescript
recordMatchResult(
  matchId: string,
  winnerTeamId: string,
  loserTeamId: string
): void
```

Records match outcome and updates team states.

**Example:**
```typescript
const match = getNextMatch()!;
recordMatchResult(
  match.matchId,
  match.team1.teamId,  // winner
  match.team2.teamId   // loser
);
```

### Get Tournament Status
```typescript
getTournamentStatus(): TournamentStatus

interface TournamentStatus {
  activeTeams: Team[];
  eliminatedTeams: Team[];
  isComplete: boolean;
  championshipReady: boolean;
}
```

**Example:**
```typescript
const status = getTournamentStatus();
console.log(`Active: ${status.activeTeams.length}`);
console.log(`Eliminated: ${status.eliminatedTeams.length}`);
console.log(`Championship ready: ${status.championshipReady}`);
```

### Other Utility Functions
```typescript
getAllTeams(): Team[]          // Get all teams
getActiveTeams(): Team[]       // Get teams with < 2 losses
resetTournament(): void        // Reset state (for testing)
```

## Usage Example

```typescript
import {
  initializeTournament,
  getNextMatch,
  getChampionshipMatch,
  recordMatchResult,
  getTournamentStatus,
} from './lib/tournamentLogic';

// 1. Initialize tournament
const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
const teams = initializeTournament(players);

// 2. Run tournament
while (!getTournamentStatus().isComplete) {
  const status = getTournamentStatus();

  if (status.championshipReady) {
    // Championship match
    const champMatch = getChampionshipMatch();
    if (champMatch) {
      console.log("CHAMPIONSHIP MATCH!");
      console.log(`${champMatch.team1.teamName} vs ${champMatch.team2.teamName}`);

      // Record result (simulate match)
      recordMatchResult(
        champMatch.matchId,
        champMatch.team1.teamId,
        champMatch.team2.teamId
      );
    }
  } else {
    // Regular match
    const match = getNextMatch();
    if (match) {
      console.log(`${match.team1.teamName} vs ${match.team2.teamName}`);

      // Record result (simulate match)
      recordMatchResult(
        match.matchId,
        match.team1.teamId,
        match.team2.teamId
      );
    }
  }
}

// 3. Get final results
const finalStatus = getTournamentStatus();
console.log("Tournament complete!");
console.log(`Champion: ${finalStatus.activeTeams[0].teamName}`);
```

## Testing

### Install Test Runner (Vitest)
```bash
npm install -D vitest @vitest/ui
```

### Add Test Script to package.json
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run"
  }
}
```

### Run Tests
```bash
npm test              # Run in watch mode
npm run test:run      # Run once
npm run test:ui       # Run with UI
```

### Test Coverage
The test file [tournamentLogic.test.ts](src/lib/tournamentLogic.test.ts) includes:

- ✅ 4 teams, no champion, no bye
- ✅ 6 teams with champion + bye
- ✅ 5 teams (odd number, no champion)
- ✅ Team with 2 losses is eliminated
- ✅ Championship requires team with 0 losses to lose twice
- ✅ Multiple matches with correct loss counting
- ✅ Full tournament simulation
- ✅ Match history tracking
- ✅ Status updates

## Migration Steps

1. **Install test runner** (optional but recommended):
   ```bash
   npm install -D vitest @vitest/ui
   ```

2. **Update imports** in your application:
   ```typescript
   // Old
   import { generateInitialBracket, updateBracketAfterMatch } from './lib/bracketLogic';

   // New
   import { initializeTournament, recordMatchResult } from './lib/tournamentLogic';
   ```

3. **Replace bracket logic** with simple tournament flow:
   - Use `initializeTournament()` instead of `generateInitialBracket()`
   - Use `getNextMatch()` for regular matches
   - Use `getChampionshipMatch()` for final match
   - Use `recordMatchResult()` instead of `updateBracketAfterMatch()`

4. **Update UI components** to display:
   - Active teams with loss count
   - Eliminated teams
   - Championship status
   - Match history per team

5. **Test thoroughly** with the provided test suite

## Benefits of New System

✅ **Simplicity**: No complex bracket structure or round calculations
✅ **Maintainability**: Easy to understand and modify
✅ **Flexibility**: Works with any number of teams (3-8+)
✅ **Reliability**: Simple logic = fewer bugs
✅ **Testability**: Comprehensive test coverage included
✅ **Readability**: Clear, self-documenting code

## Questions?

The new system is intentionally simple and straightforward. If you need to understand how something works, just read the code in [tournamentLogic.ts](src/lib/tournamentLogic.ts) - it's designed to be obvious and easy to follow.

## Next Steps

1. Install Vitest and run the tests
2. Update your application to use the new tournament logic
3. Remove or archive the old [bracketLogic.ts](src/lib/bracketLogic.ts) file
4. Update your UI components to display loss counts and tournament status

Good luck with your cornhole tournament! 🎯
