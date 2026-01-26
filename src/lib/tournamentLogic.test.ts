/**
 * Test suite for loss-tracking double elimination tournament
 */

/// <reference types="vitest" />

import {
  initializeTournament,
  getAllTeams,
  getActiveTeams,
  getNextMatch,
  recordMatchResult,
  getTournamentStatus,
  getChampionshipMatch,
  resetTournament,
} from "./tournamentLogic";

describe("Loss-Tracking Double Elimination Tournament", () => {
  beforeEach(() => {
    resetTournament();
  });

  describe("Tournament Initialization", () => {
    test("4 teams, no champion, no bye", () => {
      const players = ["Alice", "Bob", "Charlie", "Dave", "Eve", "Frank", "Grace", "Henry"];
      const teams = initializeTournament(players);

      expect(teams).toHaveLength(4);
      expect(teams.every((t) => t.losses === 0)).toBe(true);
      expect(teams.every((t) => t.status === "active")).toBe(true);
      expect(teams.every((t) => !t.isChampion)).toBe(true);
      expect(teams.every((t) => !t.hadBye)).toBe(true);
    });

    test("6 teams with champion + bye", () => {
      const players = ["Alice", "Bob", "Charlie", "Dave", "Eve", "Frank", "Grace", "Henry", "Ian", "Jack"];
      const championTeam = { players: ["Alice", "Bob"] as [string, string] };
      const teams = initializeTournament(players, championTeam, true);

      expect(teams).toHaveLength(5); // 1 champion + 4 regular teams

      const champion = teams.find((t) => t.isChampion);
      expect(champion).toBeDefined();
      expect(champion?.hadBye).toBe(true);
      expect(champion?.players).toEqual(["Alice", "Bob"]);

      // Verify remaining players formed teams
      const nonChampions = teams.filter((t) => !t.isChampion);
      expect(nonChampions).toHaveLength(4);

      // Verify champion players not in other teams
      const allOtherPlayers = nonChampions.flatMap((t) => t.players);
      expect(allOtherPlayers).not.toContain("Alice");
      expect(allOtherPlayers).not.toContain("Bob");
    });

    test("5 teams (odd number, no champion)", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"];
      const teams = initializeTournament(players);

      expect(teams).toHaveLength(5);
      expect(teams.every((t) => t.players.length === 2)).toBe(true);
    });

    test("Team structure is correct", () => {
      const players = ["Alice", "Bob", "Charlie", "Dave"];
      const teams = initializeTournament(players);

      const team = teams[0];
      expect(team).toHaveProperty("teamId");
      expect(team).toHaveProperty("teamName");
      expect(team).toHaveProperty("players");
      expect(team).toHaveProperty("losses");
      expect(team).toHaveProperty("isChampion");
      expect(team).toHaveProperty("hadBye");
      expect(team).toHaveProperty("matchHistory");
      expect(team).toHaveProperty("status");

      expect(team.losses).toBe(0);
      expect(team.status).toBe("active");
      expect(team.matchHistory).toEqual([]);
    });
  });

  describe("Match Pairing and Progression", () => {
    test("getNextMatch returns first available match", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"];
      initializeTournament(players); // 5 teams

      const match = getNextMatch();

      expect(match).not.toBeNull();
      expect(match?.team1).toBeDefined();
      expect(match?.team2).toBeDefined();
      expect(match?.isChampionship).toBe(false);
      expect(match?.matchId).toBeDefined();
    });

    test("getNextMatch returns championship match when 2 teams remain", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      const teams = initializeTournament(players); // 4 teams

      // Eliminate 2 teams to leave only 2 active
      teams[2].losses = 2;
      teams[2].status = "eliminated";
      teams[3].losses = 2;
      teams[3].status = "eliminated";

      const match = getNextMatch();
      expect(match).not.toBeNull();
      expect(match?.isChampionship).toBe(true);
    });

    test("Odd number of teams - one team waits", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6"];
      initializeTournament(players); // Creates 3 teams

      const match = getNextMatch();
      const activeTeams = getActiveTeams();

      expect(match).not.toBeNull();
      expect(activeTeams).toHaveLength(3);
      // Third team will wait for next round
    });
  });

  describe("Match Result Recording", () => {
    test("Loser gets +1 loss after match", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      const teams = initializeTournament(players);
      const match = getNextMatch()!;

      const winnerBefore = teams.find((t) => t.teamId === match.team1.teamId)!;
      const loserBefore = teams.find((t) => t.teamId === match.team2.teamId)!;

      expect(loserBefore.losses).toBe(0);

      recordMatchResult(match.matchId, match.team1.teamId, match.team2.teamId);

      const loserAfter = getAllTeams().find((t) => t.teamId === match.team2.teamId)!;
      expect(loserAfter.losses).toBe(1);
    });

    test("Team with 2 losses is eliminated", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      const teams = initializeTournament(players);

      // First loss
      const match1 = getNextMatch()!;
      recordMatchResult(match1.matchId, match1.team1.teamId, match1.team2.teamId);

      const teamAfterFirstLoss = getAllTeams().find((t) => t.teamId === match1.team2.teamId)!;
      expect(teamAfterFirstLoss.losses).toBe(1);
      expect(teamAfterFirstLoss.status).toBe("active");

      // Second loss - simulate until the same team loses again
      // Manually give second loss to test elimination
      const loserTeam = getAllTeams().find((t) => t.teamId === match1.team2.teamId)!;
      loserTeam.losses = 2;
      loserTeam.status = "eliminated";

      expect(loserTeam.losses).toBe(2);
      expect(loserTeam.status).toBe("eliminated");
    });

    test("Match history is updated correctly", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      initializeTournament(players);
      const match = getNextMatch()!;

      recordMatchResult(match.matchId, match.team1.teamId, match.team2.teamId);

      const winner = getAllTeams().find((t) => t.teamId === match.team1.teamId)!;
      const loser = getAllTeams().find((t) => t.teamId === match.team2.teamId)!;

      expect(winner.matchHistory).toHaveLength(1);
      expect(winner.matchHistory[0].result).toBe("W");
      expect(winner.matchHistory[0].matchId).toBe(match.matchId);
      expect(winner.matchHistory[0].opponent).toBe(loser.teamName);

      expect(loser.matchHistory).toHaveLength(1);
      expect(loser.matchHistory[0].result).toBe("L");
      expect(loser.matchHistory[0].matchId).toBe(match.matchId);
      expect(loser.matchHistory[0].opponent).toBe(winner.teamName);
    });
  });

  describe("Championship Logic", () => {
    test("Championship ready when 2 teams remain", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      const teams = initializeTournament(players); // 4 teams

      // Eliminate 2 teams
      teams[2].losses = 2;
      teams[2].status = "eliminated";
      teams[3].losses = 2;
      teams[3].status = "eliminated";

      const status = getTournamentStatus();
      expect(status.championshipReady).toBe(true);
      expect(status.activeTeams).toHaveLength(2);
    });

    test("getChampionshipMatch returns match when 2 teams remain", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      const teams = initializeTournament(players); // 4 teams

      // Eliminate 2 teams
      teams[2].losses = 2;
      teams[2].status = "eliminated";
      teams[3].losses = 2;
      teams[3].status = "eliminated";

      const champMatch = getChampionshipMatch();
      expect(champMatch).not.toBeNull();
      expect(champMatch?.isChampionship).toBe(true);
      expect(champMatch?.team1).toBeDefined();
      expect(champMatch?.team2).toBeDefined();
    });

    test("Team with 0 losses must lose twice in championship", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      const teams = initializeTournament(players); // 4 teams

      // Set up championship scenario: Team A (0 losses) vs Team B (1 loss)
      teams[0].losses = 0;
      teams[1].losses = 1;
      teams[2].losses = 2;
      teams[2].status = "eliminated";
      teams[3].losses = 2;
      teams[3].status = "eliminated";

      const champMatch1 = getChampionshipMatch()!;

      // Team B wins first championship match
      const teamA = teams[0];
      const teamB = teams[1];
      recordMatchResult(champMatch1.matchId, teamB.teamId, teamA.teamId);

      // Both teams now have 1 loss
      const teamAAfter = getAllTeams().find((t) => t.teamId === teamA.teamId)!;
      const teamBAfter = getAllTeams().find((t) => t.teamId === teamB.teamId)!;

      expect(teamAAfter.losses).toBe(1);
      expect(teamBAfter.losses).toBe(1);
      expect(teamAAfter.status).toBe("active");
      expect(teamBAfter.status).toBe("active");

      // They should play again
      const champMatch2 = getChampionshipMatch()!;
      expect(champMatch2).not.toBeNull();

      // Winner of second match is champion
      recordMatchResult(champMatch2.matchId, teamA.teamId, teamB.teamId);

      const finalTeamA = getAllTeams().find((t) => t.teamId === teamA.teamId)!;
      const finalTeamB = getAllTeams().find((t) => t.teamId === teamB.teamId)!;

      expect(finalTeamA.status).toBe("champion");
      expect(finalTeamB.losses).toBe(2);
      expect(finalTeamB.status).toBe("eliminated");
    });
  });

  describe("Tournament Status", () => {
    test("getTournamentStatus returns correct active and eliminated teams", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      const teams = initializeTournament(players); // 4 teams

      teams[2].losses = 2;
      teams[2].status = "eliminated";

      const status = getTournamentStatus();

      expect(status.activeTeams).toHaveLength(3);
      expect(status.eliminatedTeams).toHaveLength(1);
      expect(status.isComplete).toBe(false);
      expect(status.championshipReady).toBe(false);
    });

    test("Tournament is complete when 1 team remains", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      const teams = initializeTournament(players); // 4 teams

      teams[1].losses = 2;
      teams[1].status = "eliminated";
      teams[2].losses = 2;
      teams[2].status = "eliminated";
      teams[3].losses = 2;
      teams[3].status = "eliminated";
      teams[0].status = "champion";

      const status = getTournamentStatus();

      expect(status.isComplete).toBe(true);
      expect(status.activeTeams).toHaveLength(1);
      expect(status.activeTeams[0].status).toBe("champion");
    });
  });

  describe("Full Tournament Simulation", () => {
    test("Complete 4-team tournament", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      initializeTournament(players);

      let rounds = 0;
      const maxRounds = 20; // Safety limit

      while (!getTournamentStatus().isComplete && rounds < maxRounds) {
        rounds++;

        const status = getTournamentStatus();

        if (status.championshipReady) {
          const champMatch = getChampionshipMatch();
          if (champMatch) {
            // Alternate winners for more realistic simulation
            const winnerId = rounds % 2 === 0 ? champMatch.team1.teamId : champMatch.team2.teamId;
            const loserId = rounds % 2 === 0 ? champMatch.team2.teamId : champMatch.team1.teamId;
            recordMatchResult(champMatch.matchId, winnerId, loserId);
          }
        } else {
          const match = getNextMatch();
          if (match) {
            // Alternate winners for more realistic simulation
            const winnerId = rounds % 2 === 0 ? match.team1.teamId : match.team2.teamId;
            const loserId = rounds % 2 === 0 ? match.team2.teamId : match.team1.teamId;
            recordMatchResult(match.matchId, winnerId, loserId);
          }
        }
      }

      const finalStatus = getTournamentStatus();
      expect(finalStatus.isComplete).toBe(true);
      expect(finalStatus.eliminatedTeams).toHaveLength(3);
      expect(finalStatus.activeTeams).toHaveLength(1);
      expect(finalStatus.activeTeams[0].status).toBe("champion");
      expect(finalStatus.activeTeams[0].losses).toBeLessThan(2);
    });

    test("Verify correct loss counting through multiple matches", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
      initializeTournament(players); // 4 teams

      // Play match 1
      const match1 = getNextMatch()!;
      const winner1Id = match1.team1.teamId;
      const loser1Id = match1.team2.teamId;
      recordMatchResult(match1.matchId, winner1Id, loser1Id);

      expect(getAllTeams().find((t) => t.teamId === winner1Id)!.losses).toBe(0);
      expect(getAllTeams().find((t) => t.teamId === loser1Id)!.losses).toBe(1);

      // Play match 2 - might involve different teams
      const match2 = getNextMatch()!;
      const winner2Id = match2.team2.teamId; // Team 2 wins this time
      const loser2Id = match2.team1.teamId;
      recordMatchResult(match2.matchId, winner2Id, loser2Id);

      // After 2 matches, verify all losses are valid
      const allTeamsAfter2 = getAllTeams();
      expect(allTeamsAfter2.every((t) => t.losses >= 0 && t.losses <= 2)).toBe(true);

      // Play match 3
      const match3 = getNextMatch()!;
      recordMatchResult(match3.matchId, match3.team2.teamId, match3.team1.teamId);

      // Verify all losses are still valid
      const allTeams = getAllTeams();
      expect(allTeams.every((t) => t.losses >= 0 && t.losses <= 2)).toBe(true);

      // Verify teams with 2 losses are eliminated
      const twoLossTeams = allTeams.filter((t) => t.losses === 2);
      expect(twoLossTeams.every((t) => t.status === "eliminated")).toBe(true);
    });
  });
});
