
import { EventMatchRow, TeamWithPlayers } from '@/types';

export interface BracketMatch extends EventMatchRow {
  team1?: TeamWithPlayers;
  team2?: TeamWithPlayers;
}

/* ---------------------------------------------------------
 * Utility to create an insert match (no id)
 * --------------------------------------------------------- */
function buildInsertMatch(
  partial: Omit<EventMatchRow, 'id' | 'created_at'>
): Omit<EventMatchRow, 'id' | 'created_at'> {
  return partial;
}

/* ---------------------------------------------------------
 * Round‑1 bye progression → feed to Round 2
 * --------------------------------------------------------- */
function processByeMatches(matches: Omit<EventMatchRow, 'id' | 'created_at'>[]) {
  const byeMatches = matches.filter(
    (m) => m.round === 1 && m.is_bye && m.winner_id
  );

  for (const bye of byeMatches) {
    const nextRound = 2;
    const nextMatchNumber = Math.floor(bye.match_number / 2);
    const isTopSlot = bye.match_number % 2 === 0;

    const nextMatch = matches.find(
      (m) => m.round === nextRound && m.match_number === nextMatchNumber
    );

    if (nextMatch) {
      if (isTopSlot) nextMatch.team1_id = bye.winner_id;
      else nextMatch.team2_id = bye.winner_id;
    }
  }
}

/* ---------------------------------------------------------
 * Generate Initial Bracket
 * --------------------------------------------------------- */
export function generateInitialBracket(
  eventId: number,
  teams: TeamWithPlayers[],
  championGetsBye: boolean
): Omit<EventMatchRow, 'id' | 'created_at'>[] {
  const matches: Omit<EventMatchRow, 'id' | 'created_at'>[] = [];
  const totalTeams = teams.length;

  const isOdd = totalTeams % 2 === 1;

  // Champion gets bye ONLY when enabled AND odd team count
  const championTeam =
    championGetsBye && isOdd
      ? teams.find((t) => t.is_reigning_champion)
      : undefined;

  const nonChampTeams = championTeam
    ? teams.filter((t) => t.id !== championTeam.id)
    : teams;

  const actualMatchCount = Math.ceil(nonChampTeams.length / 2);

  /* ---------------- Winners Round 1 ---------------- */
  let teamIndex = 0;

  for (let i = 0; i < actualMatchCount; i++) {
    const matchNumber = i;

    if (teamIndex + 1 < nonChampTeams.length) {
      const t1 = nonChampTeams[teamIndex++]!;
      const t2 = nonChampTeams[teamIndex++]!;

      matches.push({
        event_id: eventId,
        round: 1,
        match_number: matchNumber,
        team1_id: t1.id,
        team2_id: t2.id,
        winner_id: null,
        loser_id: null,
        is_bye: false,
      });
    } else if (teamIndex < nonChampTeams.length) {
      // Single-team bye
      const t1 = nonChampTeams[teamIndex++]!;

      matches.push({
        event_id: eventId,
        round: 1,
        match_number: matchNumber,
        team1_id: t1.id,
        team2_id: null,
        winner_id: t1.id,
        loser_id: null,
        is_bye: true,
      });
    }
  }

  /* ---------------- Winners R2+ ---------------- */
  let remaining = actualMatchCount + (championTeam ? 1 : 0);

  for (let round = 2; remaining > 1; round++) {
    const numMatches = Math.ceil(remaining / 2);

    for (let i = 0; i < numMatches; i++) {
      matches.push({
        event_id: eventId,
        round,
        match_number: i,
        team1_id: null,
        team2_id: null,
        winner_id: null,
        loser_id: null,
        is_bye: false,
      });
    }

    remaining = numMatches;
  }

  /* Feed Round‑1 byes */
  processByeMatches(matches);

  /* Champion inserted into Round 2 */
  if (championTeam) {
    const lastR1MatchNumber = actualMatchCount - 1;
    const championTarget = Math.floor(lastR1MatchNumber / 2);

    const r2Match = matches.find(
      (m) => m.round === 2 && m.match_number === championTarget
    );

    if (r2Match) {
      r2Match.team2_id = championTeam.id;
    }
  }

  /* ---------------- Pre‑create LB‑1 ---------------- */
  const lb1Matches = Math.floor(actualMatchCount / 2);

  for (let i = 0; i < lb1Matches; i++) {
    matches.push({
      event_id: eventId,
      round: -1,
      match_number: i,
      team1_id: null,
      team2_id: null,
      winner_id: null,
      loser_id: null,
      is_bye: false,
    });
  }

  /* ---------------- Grand Final ---------------- */
  matches.push({
    event_id: eventId,
    round: 0,
    match_number: 0,
    team1_id: null,
    team2_id: null,
    winner_id: null,
    loser_id: null,
    is_bye: false,
  });

  return matches;
}

/* ---------------------------------------------------------
 * Auto‑advance REAL byes (never champion)
 * --------------------------------------------------------- */
function autoAdvanceWinnersByes(
  matches: BracketMatch[],
  teams: TeamWithPlayers[]
): Partial<EventMatchRow>[] {
  const updates: Partial<EventMatchRow>[] = [];

  const champion = teams.find((t) => t.is_reigning_champion);
  const championId = champion?.id;

  const pending = matches.filter(
    (m) =>
      m.round > 0 &&
      !m.winner_id &&
      !m.is_bye &&
      ((m.team1_id && !m.team2_id) || (!m.team1_id && m.team2_id))
  );

  for (const m of pending) {
    // DO NOT auto‑advance champion
    if (m.team1_id === championId || m.team2_id === championId) continue;

    const winner_id = m.team1_id ?? m.team2_id!;
    updates.push({ id: m.id!, is_bye: true, winner_id });

    const nextRound = m.round + 1;
    const nextMatchNumber = Math.floor(m.match_number / 2);

    const next = matches.find(
      (n) => n.round === nextRound && n.match_number === nextMatchNumber
    );

    if (next) {
      if (!next.team1_id) updates.push({ id: next.id!, team1_id: winner_id });
      else if (!next.team2_id)
        updates.push({ id: next.id!, team2_id: winner_id });
    } else {
      const grandFinal = matches.find((n) => n.round === 0);
      if (grandFinal)
        updates.push({ id: grandFinal.id!, team1_id: winner_id });
    }
  }

  return updates;
}

/* ---------------------------------------------------------
 * Main Match Progression
 * --------------------------------------------------------- */
export function updateBracketAfterMatch(
  matches: BracketMatch[],
  completedMatchId: number,
  teams: TeamWithPlayers[]
): Partial<EventMatchRow>[] {
  const updates: Partial<EventMatchRow>[] = [];

  const completed = matches.find((m) => m.id === completedMatchId);
  if (!completed || !completed.winner_id) return updates;

  const {
    event_id,
    round,
    match_number,
    winner_id,
    team1_id,
    team2_id,
    is_bye,
  } = completed;

  const loser_id = winner_id === team1_id ? team2_id : team1_id;
  updates.push({ id: completedMatchId, loser_id });

  /* ---------------- Bye behavior ---------------- */
  if (!loser_id && is_bye) {
    if (round > 0) {
      const nextRound = round + 1;
      const nextMatch = matches.find(
        (m) =>
          m.round === nextRound &&
          m.match_number === Math.floor(match_number / 2)
      );

      if (nextMatch) {
        const isTop = match_number % 2 === 0;
        updates.push({
          id: nextMatch.id!,
          ...(isTop ? { team1_id: winner_id } : { team2_id: winner_id }),
        });
      } else {
        const gf = matches.find((m) => m.round === 0);
        if (gf) updates.push({ id: gf.id!, team1_id: winner_id });
      }
    }
    return updates;
  }

  /* ---------------- WINNERS BRACKET ---------------- */
  if (round > 0) {
    const nextRound = round + 1;

    const currCount = matches.filter((m) => m.round === round).length;
    const nextCount = matches.filter((m) => m.round === nextRound).length;

    // R1 → R2 correct distribution
    const nextMatchNumber =
      round === 1 && currCount > 0 && nextCount > 0
        ? Math.floor((match_number * nextCount) / currCount)
        : Math.floor(match_number / 2);

    const nextMatch = matches.find(
      (m) => m.round === nextRound && m.match_number === nextMatchNumber
    );

    if (nextMatch) {
      if (!nextMatch.team1_id)
        updates.push({ id: nextMatch.id!, team1_id: winner_id });
      else if (!nextMatch.team2_id)
        updates.push({ id: nextMatch.id!, team2_id: winner_id });
    } else {
      const gf = matches.find((m) => m.round === 0);
      if (gf) updates.push({ id: gf.id!, team1_id: winner_id });
    }

    /* ---- Send loser to losers bracket ---- */
    let lbRound: number;
    if (round === 1) lbRound = -1;
    else if (round === 2) lbRound = -4;
    else lbRound = -(2 * round - 2);

    const lbMatchNumber =
      round === 2 ? 0 : Math.floor(match_number / 2);

    const existingLB = matches.find(
      (m) => m.round === lbRound && m.match_number === lbMatchNumber
    );

    const placeTop = match_number % 2 === 0;

    if (!existingLB) {
      updates.push(
        buildInsertMatch({
          event_id,
          round: lbRound,
          match_number: lbMatchNumber,
          team1_id: placeTop ? loser_id : null,
          team2_id: placeTop ? null : loser_id,
          winner_id: null,
          loser_id: null,
          is_bye: false,
        })
      );
    } else {
      if (placeTop && !existingLB.team1_id)
        updates.push({ id: existingLB.id!, team1_id: loser_id });
      else if (!placeTop && !existingLB.team2_id)
        updates.push({ id: existingLB.id!, team2_id: loser_id });
    }
  }

  /* ---------------- LOSERS BRACKET ---------------- */
  if (round < 0) {
    const nextLBRound = round - 1;
    const nextLBMatchNo = Math.floor(match_number / 2);

    const abs = Math.abs(round);
    const isOddLB = abs % 2 === 1;
    const placeTop = match_number % 2 === 0;

    const nextLB = matches.find(
      (m) => m.round === nextLBRound && m.match_number === nextLBMatchNo
    );

    if (!nextLB) {
      const gf = matches.find((m) => m.round === 0);

      if (gf && !matches.some((m) => m.round === nextLBRound)) {
        updates.push({ id: gf.id!, team2_id: winner_id });
      } else {
        updates.push(
          buildInsertMatch({
            event_id,
            round: nextLBRound,
            match_number: nextLBMatchNo,
            team1_id: isOddLB
              ? winner_id
              : placeTop
              ? winner_id
              : null,
            team2_id: isOddLB
              ? null
              : placeTop
              ? null
              : winner_id,
            winner_id: null,
            loser_id: null,
            is_bye: false,
          })
        );
      }
    } else {
      if (isOddLB) {
        updates.push({ id: nextLB.id!, team1_id: winner_id });
      } else {
        updates.push({
          id: nextLB.id!,
          ...(placeTop
            ? { team1_id: winner_id }
            : { team2_id: winner_id }),
        });
      }
    }
  }

  /* ---------------- Auto‑advance REAL byes ---------------- */
  const byeAdvances = autoAdvanceWinnersByes(matches, teams);
  updates.push(...byeAdvances);

  return updates;
}

/* ---------------------------------------------------------
 * Organize for UI
 * --------------------------------------------------------- */
export function organizeBracket(matches: BracketMatch[]) {
  const winners = matches
    .filter((m) => m.round > 0)
    .sort(
      (a, b) =>
        a.round - b.round || a.match_number - b.match_number
    );

  const losers = matches
    .filter((m) => m.round < 0)
    .sort(
      (a, b) =>
        b.round - a.round || a.match_number - b.match_number
    );

  const finals = matches.filter((m) => m.round === 0);

  const winnersByRound: Record<string, BracketMatch[]> = {};
  const losersByRound: Record<string, BracketMatch[]> = {};

  for (const m of winners) {
    const k = `round_${m.round}`;
    if (!winnersByRound[k]) winnersByRound[k] = [];
    winnersByRound[k].push(m);
  }

  for (const m of losers) {
    const k = `round_${Math.abs(m.round)}`;
    if (!losersByRound[k]) losersByRound[k] = [];
    losersByRound[k].push(m);
  }

  return {
    winnersByRound,
    losersByRound,
    finals,
  };
}
