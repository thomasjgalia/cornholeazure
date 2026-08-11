import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatTeamName } from '@/lib/utils'
import { EventRow, TeamWithPlayers } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { ArrowLeft, Trophy, X, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TeamWithLosses extends TeamWithPlayers {
  lossCount: number
  isEliminated: boolean
}

interface MatchResult {
  id: number
  winner_id: number
  loser_id: number
  created_at: string
}

export default function BracketPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { isProfileClaimed } = useAuth()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [teams, setTeams] = useState<TeamWithLosses[]>([])
  const [matchResults, setMatchResults] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTeams, setSelectedTeams] = useState<{ team1: TeamWithLosses | null; team2: TeamWithLosses | null }>({
    team1: null,
    team2: null,
  })
  const [tournamentComplete, setTournamentComplete] = useState(false)
  const [champion, setChampion] = useState<TeamWithLosses | null>(null)
  const [deleteMatchId, setDeleteMatchId] = useState<number | null>(null)
  const [pendingQuickResult, setPendingQuickResult] = useState<{
    match: { team1: TeamWithLosses; team2: TeamWithLosses }
    winnerId: number
    loserId: number
  } | null>(null)

  useEffect(() => {
    if (eventId) {
      loadTournament()
    }
  }, [eventId])

  async function loadTournament() {
    try {
      setLoading(true)

      const [eventData, teamsData, matchesData] = await Promise.all([
        api.get<EventRow>(`/events/${eventId}`),
        api.get<TeamWithPlayers[]>(`/teams?eventId=${eventId}`),
        api.get<MatchResult[]>(`/matches?eventId=${eventId}`),
      ])

      setEvent(eventData)
      setMatchResults(matchesData)

      // Calculate losses for each team
      const teamsWithLosses: TeamWithLosses[] = teamsData.map((team) => {
        const lossCount = matchesData.filter((m) => m.loser_id === team.id).length
        const isEliminated = lossCount >= 2
        return { ...team, lossCount, isEliminated }
      })

      setTeams(teamsWithLosses)

      // Check if tournament is complete
      const activeTeams = teamsWithLosses.filter((t) => !t.isEliminated)
      if (activeTeams.length === 1) {
        setTournamentComplete(true)
        setChampion(activeTeams[0] ?? null)
      } else if (activeTeams.length === 0 && teamsWithLosses.length > 0) {
        const sortedByLosses = [...teamsWithLosses].sort((a, b) => a.lossCount - b.lossCount)
        setTournamentComplete(true)
        setChampion(sortedByLosses[0] ?? null)
      } else {
        setTournamentComplete(false)
        setChampion(null)
      }
    } catch (error) {
      toast.error('Failed to load tournament')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  function getTeamMatchCount(teamId: number): number {
    return matchResults.filter((m) => m.winner_id === teamId || m.loser_id === teamId).length
  }

  function getTeamRecord(team: TeamWithLosses): string {
    const wins = matchResults.filter((m) => m.winner_id === team.id).length
    return `${wins}/${team.lossCount}`
  }

  function getSuggestedMatches(): Array<{ team1: TeamWithLosses; team2: TeamWithLosses }> {
    const activeTeams = teams.filter((t) => !t.isEliminated)
    const matches: Array<{ team1: TeamWithLosses; team2: TeamWithLosses }> = []

    if (activeTeams.length < 2) {
      return matches
    }

    // If only 2 teams left, that's the championship match
    if (activeTeams.length === 2) {
      return [{ team1: activeTeams[0]!, team2: activeTeams[1]! }]
    }

    // Check if champion should get a bye
    const championTeam = teams.find((t) => t.is_reigning_champion && !t.isEliminated)
    const championByeEnabled = event?.champion_gets_bye && championTeam

    // Check if all NON-CHAMPION teams have played at least once
    const teamsRequiringFirstMatch = activeTeams.filter((t) => {
      if (championByeEnabled && t.id === championTeam.id) {
        return false
      }
      const hasPlayed = matchResults.some(
        (m) => m.winner_id === t.id || m.loser_id === t.id
      )
      return !hasPlayed
    })
    const allNonChampionTeamsHavePlayed = teamsRequiringFirstMatch.length === 0

    const shouldExcludeChampion = championByeEnabled && !allNonChampionTeamsHavePlayed

    // Find the most recent match's winner so they can be kept out of the
    // next suggested matchup when there's any other valid pairing available
    // -- otherwise the team that just won keeps getting sent right back in.
    // The loser is deliberately NOT also rested: excluding the winner alone
    // already makes an instant rematch impossible, and also resting the
    // loser can unfairly bench a team with a low game count just because
    // they happened to lose their most recent (possibly very first) game.
    // Sort by id (auto-incrementing) rather than created_at -- created_at
    // isn't reliably populated in this DB, but id order always matches
    // insertion/play order.
    const mostRecentMatch = matchResults.length > 0
      ? [...matchResults].sort((a, b) => b.id - a.id)[0]!
      : null
    const recentWinnerId = mostRecentMatch?.winner_id

    const teamsExcludingWinner = activeTeams.filter(
      (t) =>
        !(shouldExcludeChampion && championTeam && t.id === championTeam.id) &&
        t.id !== recentWinnerId
    )

    const excludedTeamIds = new Set<number>()
    if (recentWinnerId != null && teamsExcludingWinner.length >= 2) {
      excludedTeamIds.add(recentWinnerId)
    }

    let undefeatedTeams = activeTeams.filter((t) => {
      if (shouldExcludeChampion && championTeam && t.id === championTeam.id) return false
      if (excludedTeamIds.has(t.id)) return false
      return t.lossCount === 0
    })
    let oneLossTeams = activeTeams.filter((t) => {
      if (excludedTeamIds.has(t.id)) return false
      return t.lossCount === 1
    })

    const sortTeams = (a: TeamWithLosses, b: TeamWithLosses) => {
      const aGames = getTeamMatchCount(a.id)
      const bGames = getTeamMatchCount(b.id)
      return aGames - bGames
    }

    undefeatedTeams.sort(sortTeams)
    oneLossTeams.sort(sortTeams)

    let remainingUndefeated = [...undefeatedTeams]
    for (let i = 0; i < remainingUndefeated.length - 1; i += 2) {
      matches.push({
        team1: remainingUndefeated[i]!,
        team2: remainingUndefeated[i + 1]!,
      })
    }

    if (remainingUndefeated.length % 2 === 1 && oneLossTeams.length > 0) {
      matches.push({
        team1: remainingUndefeated[remainingUndefeated.length - 1]!,
        team2: oneLossTeams[0]!,
      })

      if (allNonChampionTeamsHavePlayed && oneLossTeams.length > 1) {
        for (let i = 1; i < oneLossTeams.length - 1; i += 2) {
          matches.push({
            team1: oneLossTeams[i]!,
            team2: oneLossTeams[i + 1]!,
          })
        }
      }
    } else if (allNonChampionTeamsHavePlayed && oneLossTeams.length >= 2) {
      for (let i = 0; i < oneLossTeams.length - 1; i += 2) {
        matches.push({
          team1: oneLossTeams[i]!,
          team2: oneLossTeams[i + 1]!,
        })
      }
    }

    // Safety net: if the last winner still ended up in a matchup (no way to
    // avoid it), push that matchup to the bottom of the list rather than
    // leaving it at the top.
    if (recentWinnerId != null) {
      matches.sort((a, b) => {
        const aHasWinner = a.team1.id === recentWinnerId || a.team2.id === recentWinnerId
        const bHasWinner = b.team1.id === recentWinnerId || b.team2.id === recentWinnerId
        return Number(aHasWinner) - Number(bHasWinner)
      })
    }

    return matches
  }

  function openMatchDialog(match?: { team1: TeamWithLosses; team2: TeamWithLosses }) {
    if (match) {
      setSelectedTeams({ team1: match.team1, team2: match.team2 })
    } else {
      setSelectedTeams({ team1: null, team2: null })
    }
    setIsDialogOpen(true)
  }

  function selectTeam(team: TeamWithLosses) {
    if (selectedTeams.team1 === null) {
      setSelectedTeams({ ...selectedTeams, team1: team })
    } else if (selectedTeams.team2 === null && selectedTeams.team1.id !== team.id) {
      setSelectedTeams({ ...selectedTeams, team2: team })
    }
  }

  function clearTeamSelection(position: 'team1' | 'team2') {
    setSelectedTeams({ ...selectedTeams, [position]: null })
  }

  async function recordMatchResult(winnerId: number, loserId: number) {
    try {
      await api.post('/matches', {
        event_id: Number(eventId),
        winner_id: winnerId,
        loser_id: loserId,
        round: 0,
        match_number: matchResults.length,
        team1_id: selectedTeams.team1?.id,
        team2_id: selectedTeams.team2?.id,
        is_bye: false,
      })

      toast.success('Match result recorded')
      setIsDialogOpen(false)
      loadTournament()
    } catch (error) {
      toast.error('Failed to record match result')
      console.error(error)
    }
  }

  async function recordQuickMatchResult(
    match: { team1: TeamWithLosses; team2: TeamWithLosses },
    winnerId: number,
    loserId: number
  ) {
    try {
      await api.post('/matches', {
        event_id: Number(eventId),
        winner_id: winnerId,
        loser_id: loserId,
        round: 0,
        match_number: matchResults.length,
        team1_id: match.team1.id,
        team2_id: match.team2.id,
        is_bye: false,
      })

      toast.success('Match result recorded')
      loadTournament()
    } catch (error) {
      toast.error('Failed to record match result')
      console.error(error)
    }
  }

  async function confirmDeleteMatchResult() {
    if (deleteMatchId == null) return
    try {
      await api.del(`/matches/${deleteMatchId}`)
      toast.success('Match result deleted')
      loadTournament()
    } catch (error) {
      toast.error('Failed to delete match result')
      console.error(error)
    }
  }

  if (!eventId) {
    return <div>Event not found</div>
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(`/events/${eventId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{event?.name || 'Event'} - Tournament</h1>
          <p className="text-muted-foreground">Loss-tracking double elimination</p>
        </div>
        {isProfileClaimed && !tournamentComplete && teams.length >= 2 && (
          <Button variant="outline" onClick={() => openMatchDialog()}>
            Record Match
          </Button>
        )}
      </div>

      {loading ? (
        <div>Loading tournament...</div>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No teams added yet. Go to the Teams page to add teams.
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate(`/events/${eventId}/teams`)}
            >
              Manage Teams
            </Button>
          </CardContent>
        </Card>
      ) : tournamentComplete ? (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Trophy className="h-6 w-6 text-yellow-500" />
              Tournament Complete!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold mb-2">
              {champion && formatTeamName(champion)}
            </p>
            <p className="text-muted-foreground">
              {champion && `Final record: ${getTeamRecord(champion)}`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Current Matchups */}
          {getSuggestedMatches().length > 0 && (
            <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
              <CardContent className="p-0">
                <h3 className="text-sm font-semibold px-3 pt-3 pb-1">
                  Current Matchups ({getSuggestedMatches().length})
                </h3>
                <div className="divide-y divide-blue-200 dark:divide-blue-900">
                  {getSuggestedMatches().map((match, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <button
                        type="button"
                        disabled={!isProfileClaimed}
                        onClick={() =>
                          setPendingQuickResult({ match, winnerId: match.team1.id, loserId: match.team2.id })
                        }
                        className="flex-1 truncate text-left rounded px-1 -mx-1 enabled:hover:bg-blue-100 dark:enabled:hover:bg-blue-900/40 enabled:cursor-pointer disabled:cursor-default"
                      >
                        {formatTeamName(match.team1)}{' '}
                        <span className="text-muted-foreground">({getTeamRecord(match.team1)})</span>
                      </button>
                      <span className="text-xs font-bold text-muted-foreground shrink-0">vs</span>
                      <button
                        type="button"
                        disabled={!isProfileClaimed}
                        onClick={() =>
                          setPendingQuickResult({ match, winnerId: match.team2.id, loserId: match.team1.id })
                        }
                        className="flex-1 truncate text-right rounded px-1 -mx-1 enabled:hover:bg-blue-100 dark:enabled:hover:bg-blue-900/40 enabled:cursor-pointer disabled:cursor-default"
                      >
                        <span className="text-muted-foreground">({getTeamRecord(match.team2)})</span>{' '}
                        {formatTeamName(match.team2)}
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show champion bye message if applicable */}
          {(() => {
            const championTeam = teams.find((t) => t.is_reigning_champion && !t.isEliminated)
            if (!event?.champion_gets_bye || !championTeam) return null

            const championHasPlayed = matchResults.some(
              (m) => m.winner_id === championTeam.id || m.loser_id === championTeam.id
            )

            if (championHasPlayed) return null

            return (
              <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    <p className="font-semibold">
                      {formatTeamName(championTeam)} (Reigning Champions) have a bye until all other teams play
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* All Teams - sorted by loss count */}
          <Card>
            <CardContent className="p-0 divide-y">
              {[...teams]
                .sort((a, b) => {
                  if (a.lossCount !== b.lossCount) {
                    return a.lossCount - b.lossCount
                  }
                  const aWins = matchResults.filter((m) => m.winner_id === a.id).length
                  const bWins = matchResults.filter((m) => m.winner_id === b.id).length
                  return bWins - aWins
                })
                .map((team) => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    matchResults={matchResults}
                    isEliminated={team.isEliminated}
                  />
                ))}
            </CardContent>
          </Card>

          {/* Match History */}
          {matchResults.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Match History ({matchResults.length})
              </h3>
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {[...matchResults]
                      .sort((a, b) => b.id - a.id)
                      .map((match, index) => {
                        const winner = teams.find((t) => t.id === match.winner_id)
                        const loser = teams.find((t) => t.id === match.loser_id)
                        return (
                          <div key={match.id} className="flex items-center gap-2 text-sm py-2 border-b last:border-0">
                            <span className="text-muted-foreground w-16">Match {matchResults.length - index}</span>
                            <span className="font-semibold flex-1">
                              {winner && formatTeamName(winner)}
                            </span>
                            <span className="text-muted-foreground">def.</span>
                            <span className="flex-1">
                              {loser && formatTeamName(loser)}
                            </span>
                            {isProfileClaimed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteMatchId(match.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Match Result</DialogTitle>
            <DialogDescription>
              {selectedTeams.team1 && selectedTeams.team2
                ? 'Select the winning team or change the matchup below.'
                : 'Select two teams to play, then choose the winner.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Team 1 Selection */}
            <div>
              <p className="text-sm font-medium mb-2">Team 1</p>
              {selectedTeams.team1 ? (
                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <span className="flex-1">
                    {formatTeamName(selectedTeams.team1)}
                  </span>
                  <Badge variant="secondary">{getTeamRecord(selectedTeams.team1)}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearTeamSelection('team1')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2">
                  {teams
                    .filter((t) => !t.isEliminated && t.id !== selectedTeams.team2?.id)
                    .map((team) => (
                      <Button
                        key={team.id}
                        variant="outline"
                        className="w-full justify-start h-auto py-2"
                        onClick={() => selectTeam(team)}
                      >
                        <span className="flex-1 text-left">
                          {formatTeamName(team)}
                        </span>
                        <Badge variant="secondary" className="ml-2">{getTeamRecord(team)}</Badge>
                      </Button>
                    ))}
                </div>
              )}
            </div>

            {/* Team 2 Selection */}
            <div>
              <p className="text-sm font-medium mb-2">Team 2</p>
              {selectedTeams.team2 ? (
                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <span className="flex-1">
                    {formatTeamName(selectedTeams.team2)}
                  </span>
                  <Badge variant="secondary">{getTeamRecord(selectedTeams.team2)}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearTeamSelection('team2')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2">
                  {teams
                    .filter((t) => !t.isEliminated && t.id !== selectedTeams.team1?.id)
                    .map((team) => (
                      <Button
                        key={team.id}
                        variant="outline"
                        className="w-full justify-start h-auto py-2"
                        onClick={() => selectTeam(team)}
                      >
                        <span className="flex-1 text-left">
                          {formatTeamName(team)}
                        </span>
                        <Badge variant="secondary" className="ml-2">{getTeamRecord(team)}</Badge>
                      </Button>
                    ))}
                </div>
              )}
            </div>

            {/* Winner Selection */}
            {selectedTeams.team1 && selectedTeams.team2 && (
              <div>
                <p className="text-sm font-medium mb-2">Select Winner</p>
                <div className="space-y-2">
                  <Button
                    variant="default"
                    className="w-full h-auto py-3 flex flex-col items-start"
                    onClick={() =>
                      recordMatchResult(selectedTeams.team1!.id, selectedTeams.team2!.id)
                    }
                  >
                    <span className="font-semibold">
                      {formatTeamName(selectedTeams.team1)}
                    </span>
                    <span className="text-xs opacity-80">
                      Current record: {getTeamRecord(selectedTeams.team1)}
                    </span>
                  </Button>
                  <Button
                    variant="default"
                    className="w-full h-auto py-3 flex flex-col items-start"
                    onClick={() =>
                      recordMatchResult(selectedTeams.team2!.id, selectedTeams.team1!.id)
                    }
                  >
                    <span className="font-semibold">
                      {formatTeamName(selectedTeams.team2)}
                    </span>
                    <span className="text-xs opacity-80">
                      Current record: {getTeamRecord(selectedTeams.team2)}
                    </span>
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteMatchId != null}
        onOpenChange={(open) => !open && setDeleteMatchId(null)}
        title="Delete match result?"
        description="This will affect the tournament standings."
        confirmLabel="Delete"
        onConfirm={confirmDeleteMatchResult}
      />

      <ConfirmDialog
        open={pendingQuickResult != null}
        onOpenChange={(open) => !open && setPendingQuickResult(null)}
        title="Record match result"
        description={
          pendingQuickResult
            ? `Mark ${formatTeamName(
                pendingQuickResult.winnerId === pendingQuickResult.match.team1.id
                  ? pendingQuickResult.match.team1
                  : pendingQuickResult.match.team2
              )} winner of this match?`
            : ''
        }
        confirmLabel="Confirm"
        confirmVariant="default"
        onConfirm={() => {
          if (!pendingQuickResult) return
          recordQuickMatchResult(pendingQuickResult.match, pendingQuickResult.winnerId, pendingQuickResult.loserId)
        }}
      />
    </div>
  )
}

function TeamRow({
  team,
  matchResults,
  isEliminated = false,
}: {
  team: TeamWithLosses
  matchResults: MatchResult[]
  isEliminated?: boolean
}) {
  const wins = matchResults.filter((m) => m.winner_id === team.id).length

  // Color coding based on losses
  let rowClassName = ''
  if (isEliminated || team.lossCount >= 2) {
    rowClassName = 'bg-gray-900 text-white'
  } else if (team.lossCount === 1) {
    rowClassName = 'bg-red-50 dark:bg-red-950'
  } else {
    rowClassName = 'bg-green-50 dark:bg-green-950'
  }

  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${rowClassName}`}>
      <span className="truncate">{formatTeamName(team)}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className={isEliminated || team.lossCount >= 2 ? 'text-gray-400' : 'text-muted-foreground'}>
          {wins}/{team.lossCount}
        </span>
        {team.is_reigning_champion ? (
          <Badge variant="default" className="h-5 px-1.5">
            <Trophy className="h-3 w-3" />
          </Badge>
        ) : null}
      </div>
    </div>
  )
}
