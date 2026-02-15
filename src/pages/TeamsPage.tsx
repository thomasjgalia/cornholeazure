import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { EventRow, PlayerRow, TeamWithPlayers } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Plus, Trash2, ArrowLeft, Trophy } from 'lucide-react'

export default function TeamsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [teams, setTeams] = useState<TeamWithPlayers[]>([])
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)
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
      const [eventData, teamsData] = await Promise.all([
        api.get<EventRow>(`/events/${eventId}`),
        api.get<TeamWithPlayers[]>(`/teams?eventId=${eventId}`),
      ])
      setEvent(eventData)
      setTeams(teamsData)
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
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Team
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No teams yet. Add your first team!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <span>{team.player1?.firstname}/{team.player2?.firstname}</span>
                  {team.is_reigning_champion && (
                    <Badge variant="default" className="ml-2">
                      <Trophy className="h-3 w-3 mr-1" />
                      Champion
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 mb-4">
                  <p className="text-sm text-muted-foreground">
                    {team.player1?.firstname} {team.player1?.lastname}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {team.player2?.firstname} {team.player2?.lastname}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleChampion(team.id, team.is_reigning_champion)}
                  >
                    <Trophy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(team.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
