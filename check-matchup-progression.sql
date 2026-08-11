-- Diagnostic query: shows every match in an event in the order it was
-- played, with each team's win/loss/game count *before* that match.
-- Use this to visually confirm the matchmaking fix is prioritizing
-- teams with fewer games played, and not immediately re-pairing the
-- team that just won.
--
-- Edit the event name below, then run the whole script.

DECLARE @EventName NVARCHAR(200) = '8.11';
DECLARE @EventId INT = (SELECT TOP 1 id FROM cornhole_events WHERE CAST(name AS NVARCHAR(200)) = @EventName);

;WITH team_names AS (
  SELECT
    t.id AS team_id,
    CAST(p1.firstname AS NVARCHAR(50)) + ' ' + LEFT(CAST(p1.lastname AS NVARCHAR(50)), 1) + './' +
    CAST(p2.firstname AS NVARCHAR(50)) + ' ' + LEFT(CAST(p2.lastname AS NVARCHAR(50)), 1) + '.' AS team_name,
    t.is_reigning_champion
  FROM cornhole_event_teams t
  JOIN players p1 ON t.player1_id = p1.playerid
  JOIN players p2 ON t.player2_id = p2.playerid
  WHERE t.event_id = @EventId
)

-- 1) Match-by-match progression, in play order.
-- Ordered by id (auto-incrementing), NOT created_at -- created_at isn't
-- reliably populated in this DB (comes back NULL), so the app itself
-- also uses id to determine play order. created_at is still shown below
-- for reference, but don't trust it for ordering.
SELECT
  ROW_NUMBER() OVER (ORDER BY m.id) AS match_seq,
  m.id,
  m.created_at,
  w.team_name AS winner,
  l.team_name AS loser,
  (SELECT COUNT(*) FROM cornhole_event_matches m2
    WHERE m2.event_id = @EventId AND (m2.winner_id = m.winner_id OR m2.loser_id = m.winner_id)
      AND m2.id < m.id) AS winner_games_before,
  (SELECT COUNT(*) FROM cornhole_event_matches m2
    WHERE m2.event_id = @EventId AND m2.loser_id = m.winner_id
      AND m2.id < m.id) AS winner_losses_before,
  (SELECT COUNT(*) FROM cornhole_event_matches m2
    WHERE m2.event_id = @EventId AND (m2.winner_id = m.loser_id OR m2.loser_id = m.loser_id)
      AND m2.id < m.id) AS loser_games_before,
  (SELECT COUNT(*) FROM cornhole_event_matches m2
    WHERE m2.event_id = @EventId AND m2.loser_id = m.loser_id
      AND m2.id < m.id) AS loser_losses_before
FROM cornhole_event_matches m
JOIN team_names w ON w.team_id = m.winner_id
JOIN team_names l ON l.team_id = m.loser_id
WHERE m.event_id = @EventId
ORDER BY m.id;

-- 2) Final standings as of right now
;WITH team_names AS (
  SELECT
    t.id AS team_id,
    CAST(p1.firstname AS NVARCHAR(50)) + ' ' + LEFT(CAST(p1.lastname AS NVARCHAR(50)), 1) + './' +
    CAST(p2.firstname AS NVARCHAR(50)) + ' ' + LEFT(CAST(p2.lastname AS NVARCHAR(50)), 1) + '.' AS team_name,
    t.is_reigning_champion
  FROM cornhole_event_teams t
  JOIN players p1 ON t.player1_id = p1.playerid
  JOIN players p2 ON t.player2_id = p2.playerid
  WHERE t.event_id = @EventId
)
SELECT
  tn.team_name,
  tn.is_reigning_champion,
  COUNT(CASE WHEN m.winner_id = tn.team_id THEN 1 END) AS wins,
  COUNT(CASE WHEN m.loser_id = tn.team_id THEN 1 END) AS losses,
  COUNT(m.id) AS games_played
FROM team_names tn
LEFT JOIN cornhole_event_matches m
  ON m.event_id = @EventId AND (m.winner_id = tn.team_id OR m.loser_id = tn.team_id)
GROUP BY tn.team_name, tn.is_reigning_champion, tn.team_id
ORDER BY losses ASC, wins DESC;
