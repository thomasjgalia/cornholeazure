import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatTeamName, shufflePairs } from '@/lib/utils'
import { EventRow, PlayerRow, TeamWithPlayers } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Trash2, ArrowLeft, Trophy, Shuffle } from 'lucide-react'

export default function TeamsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { isProfileClaimed } = useAuth()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [teams, setTeams] = useState<TeamWithPlayers[]>([])
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [matchCount, setMatchCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [reshuffling, setReshuffling] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    player1_id: '',
    player2_id: '',
    is_reigning_champion: false,
  })

  useEffect(() => {
    if (eventId) {
      loadEventAndTeams()
      loadPlayers()
    }
  }, [eventId])

  async function loadEventAndTeams() {
    try {
      setLoading(true)
      const [eventData, teamsData, matchesData] = await Promise.all([
        api.get<EventRow>(`/events/${eventId}`),
        api.get<TeamWithPlayers[]>(`/teams?eventId=${eventId}`),
        api.get<{ id: number }[]>(`/matches?eventId=${eventId}`),
      ])
      setEvent(eventData)
      setTeams(teamsData)
      setMatchCount(matchesData.length)
    } catch (error) {
      toast.error('Failed to load event and teams')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function loadPlayers() {
    try {
      const data = await api.get<PlayerRow[]>('/players')
      setPlayers(data)
    } catch (error) {
      toast.error('Failed to load players')
      console.error(error)
    }
  }

  function openAddDialog() {
    setFormData({
      player1_id: '',
      player2_id: '',
      is_reigning_champion: false,
    })
    setIsDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.player1_id || !formData.player2_id) {
      toast.error('Please select both players')
      return
    }

    if (formData.player1_id === formData.player2_id) {
      toast.error('Players must be different')
      return
    }

    try {
      await api.post('/teams', {
        event_id: Number(eventId),
        player1_id: Number(formData.player1_id),
        player2_id: Number(formData.player2_id),
        is_reigning_champion: formData.is_reigning_champion,
      })

      toast.success('Team added successfully')
      setIsDialogOpen(false)
      loadEventAndTeams()
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        toast.error('This team already exists in this event')
      } else {
        toast.error('Failed to add team')
        console.error(error)
      }
    }
  }

  async function handleDelete(teamId: number) {
    if (!confirm('Are you sure you want to delete this team?')) {
      return
    }

    try {
      await api.del(`/teams/${teamId}`)
      toast.success('Team deleted successfully')
      loadEventAndTeams()
    } catch (error) {
      toast.error('Failed to delete team')
      console.error(error)
    }
  }

  async function toggleChampion(teamId: number, currentStatus: boolean) {
    try {
      await api.put(`/teams/${teamId}`, { is_reigning_champion: !currentStatus })
      toast.success(
        !currentStatus ? 'Team marked as champion' : 'Champion status removed'
      )
      loadEventAndTeams()
    } catch (error) {
      toast.error('Failed to update champion status')
      console.error(error)
    }
  }

  async function handleReshuffle() {
    const nonChampionTeams = teams.filter((t) => !t.is_reigning_champion)
    if (nonChampionTeams.length < 2) {
      toast.error('Need at least 2 non-champion teams to reshuffle')
      return
    }

    if (
      !confirm(
        'Reshuffle will randomly reassign all non-champion teams. The reigning champion team is left as-is. Continue?'
      )
    ) {
      return
    }

    setReshuffling(true)
    try {
      const playerIds = nonChampionTeams.flatMap((t) => [t.player1_id, t.player2_id])
      await Promise.all(nonChampionTeams.map((t) => api.del(`/teams/${t.id}`)))

      const pairs = shufflePairs(playerIds)
      await Promise.all(
        pairs.map((pair) =>
          api.post('/teams', {
            event_id: Number(eventId),
            player1_id: pair.player1_id,
            player2_id: pair.player2_id,
            is_reigning_champion: false,
          })
        )
      )

      toast.success('Teams reshuffled')
      loadEventAndTeams()
    } catch (error) {
      toast.error('Failed to reshuffle teams')
      console.error(error)
    } finally {
      setReshuffling(false)
    }
  }

  if (!eventId) {
    return <div>Event not found</div>
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/events')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{event?.name || 'Event'}</h1>
          <p className="text-muted-foreground">Manage teams for this event</p>
        </div>
        {isProfileClaimed && matchCount === 0 && teams.filter((t) => !t.is_reigning_champion).length >= 2 && (
          <Button variant="outline" onClick={handleReshuffle} disabled={reshuffling}>
            <Shuffle className="mr-2 h-4 w-4" />
            {reshuffling ? 'Reshuffling...' : 'Reshuffle'}
          </Button>
        )}
        {isProfileClaimed && (
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Team
          </Button>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-0 divide-y">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center px-3 py-2">
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No teams yet. Add your first team!
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="truncate">{formatTeamName(team)}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {team.is_reigning_champion && (
                    <Badge variant="default">
                      <Trophy className="h-3 w-3 mr-1" />
                      Champion
                    </Badge>
                  )}
                  {isProfileClaimed && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => toggleChampion(team.id, team.is_reigning_champion)}
                      >
                        <Trophy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(team.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add Team</DialogTitle>
              <DialogDescription>
                Create a new team for this event.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="player1">Player 1 *</Label>
                <Select
                  value={formData.player1_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, player1_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select player 1" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {players.map((player) => (
                      <SelectItem
                        key={player.playerid}
                        value={player.playerid.toString()}
                      >
                        {player.firstname} {player.lastname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="player2">Player 2 *</Label>
                <Select
                  value={formData.player2_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, player2_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select player 2" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    {players.map((player) => (
                      <SelectItem
                        key={player.playerid}
                        value={player.playerid.toString()}
                      >
                        {player.firstname} {player.lastname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="is_reigning_champion"
                  type="checkbox"
                  checked={formData.is_reigning_champion}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_reigning_champion: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_reigning_champion" className="font-normal">
                  This is the reigning champion team
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add Team</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
