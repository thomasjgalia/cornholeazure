import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { TABLES } from '@/lib/constants'
import { EventRow, PlayerRow } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Calendar, Users, Trophy } from 'lucide-react'
import { format } from 'date-fns'

export default function EventsListPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventRow[]>([])
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    champion_gets_bye: false,
    champion_player1_id: '',
    champion_player2_id: '',
  })
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>([])

  useEffect(() => {
    loadEvents()
    loadPlayers()
  }, [])

  async function loadEvents() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from(TABLES.CORNHOLE_EVENTS)
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      toast.error('Failed to load events')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function loadPlayers() {
    try {
      const { data, error } = await supabase
        .from(TABLES.PLAYERS)
        .select('*')
        .order('lastname', { ascending: true })
        .order('firstname', { ascending: true })

      if (error) throw error
      setPlayers(data || [])
    } catch (error) {
      console.error('Failed to load players:', error)
    }
  }

  function openAddDialog() {
    setEditingEvent(null)
    setFormData({
      name: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      champion_gets_bye: false,
      champion_player1_id: '',
      champion_player2_id: '',
    })
    setSelectedParticipantIds([])
    setIsDialogOpen(true)
  }

  function openEditDialog(event: EventRow) {
    setEditingEvent(event)
    setFormData({
      name: event.name,
      date: event.date,
      champion_gets_bye: event.champion_gets_bye,
      champion_player1_id: '',
      champion_player2_id: '',
    })
    setIsDialogOpen(true)
  }

  function toggleParticipant(playerId: number) {
    setSelectedParticipantIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    )
  }

  function getAvailableParticipants() {
    const championIds = [
      Number(formData.champion_player1_id),
      Number(formData.champion_player2_id),
    ].filter((id) => !isNaN(id) && id > 0)

    return players.filter((p) => !championIds.includes(p.playerid))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.name.trim() || !formData.date) {
      toast.error('Name and date are required')
      return
    }

    // Validate champion team if bye is enabled
    const hasChampionTeam = formData.champion_player1_id && formData.champion_player2_id
    if (formData.champion_gets_bye && !hasChampionTeam) {
      toast.error('Please select both players for the reigning champion team')
      return
    }

    if (hasChampionTeam && formData.champion_player1_id === formData.champion_player2_id) {
      toast.error('Champion team players must be different')
      return
    }

    // Validate participants when creating event
    if (!editingEvent) {
      if (selectedParticipantIds.length === 0) {
        toast.error('Please select at least 4 players to participate (2 teams)')
        return
      }

      if (selectedParticipantIds.length % 2 !== 0) {
        toast.error('Please select an even number of players')
        return
      }

      if (selectedParticipantIds.length < 4) {
        toast.error('At least 4 players (2 teams) are required')
        return
      }
    }

    try {
      if (editingEvent) {
        const { error } = await supabase
          .from(TABLES.CORNHOLE_EVENTS)
          .update({
            name: formData.name.trim(),
            date: formData.date,
            champion_gets_bye: formData.champion_gets_bye,
          })
          .eq('id', editingEvent.id)

        if (error) throw error
        toast.success('Event updated successfully')
      } else {
        // Create event
        const { data: newEvent, error: eventError } = await supabase
          .from(TABLES.CORNHOLE_EVENTS)
          .insert({
            name: formData.name.trim(),
            date: formData.date,
            champion_gets_bye: formData.champion_gets_bye,
          })
          .select()
          .single()

        if (eventError) throw eventError

        // Create champion team if specified
        if (hasChampionTeam && newEvent) {
          const { error: teamError } = await supabase
            .from(TABLES.CORNHOLE_EVENT_TEAMS)
            .insert({
              event_id: newEvent.id,
              player1_id: Number(formData.champion_player1_id),
              player2_id: Number(formData.champion_player2_id),
              is_reigning_champion: true,
            })

          if (teamError) throw teamError
        }

        // Create randomly assigned teams from participants
        if (selectedParticipantIds.length > 0 && newEvent) {
          // Shuffle participants randomly
          const shuffled = [...selectedParticipantIds].sort(() => Math.random() - 0.5)
          const teamsToCreate = []

          // Pair them up into teams
          for (let i = 0; i < shuffled.length; i += 2) {
            teamsToCreate.push({
              event_id: newEvent.id,
              player1_id: shuffled[i],
              player2_id: shuffled[i + 1],
              is_reigning_champion: false,
            })
          }

          const { error: teamsError } = await supabase
            .from(TABLES.CORNHOLE_EVENT_TEAMS)
            .insert(teamsToCreate)

          if (teamsError) throw teamsError
        }

        toast.success('Event created successfully')
      }

      setIsDialogOpen(false)
      loadEvents()
    } catch (error) {
      toast.error('Failed to save event')
      console.error(error)
    }
  }

  async function handleDelete(event: EventRow) {
    if (!confirm(`Are you sure you want to delete "${event.name}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from(TABLES.CORNHOLE_EVENTS)
        .delete()
        .eq('id', event.id)

      if (error) throw error
      toast.success('Event deleted successfully')
      loadEvents()
    } catch (error) {
      toast.error('Failed to delete event')
      console.error(error)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Events</h1>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No events yet. Create your first tournament!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card
              key={event.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/events/${event.id}`)}
            >
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <span>{event.name}</span>
                  {event.champion_gets_bye && (
                    <Badge variant="secondary" className="ml-2">
                      Bye
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(event.date), 'MMMM d, yyyy')}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditDialog(event)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(event)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/events/${event.id}/teams`)
                      }}
                    >
                      <Users className="mr-1 h-4 w-4" />
                      Teams
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/events/${event.id}/bracket`)
                      }}
                    >
                      <Trophy className="mr-1 h-4 w-4" />
                      Manage
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col p-0">
          <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
            <DialogHeader className="flex-shrink-0 px-6 pt-6">
              <DialogTitle>
                {editingEvent ? 'Edit Event' : 'Create Event'}
              </DialogTitle>
              <DialogDescription>
                {editingEvent
                  ? 'Update event details.'
                  : 'Create a new cornhole tournament event.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-3 px-6 overflow-y-auto flex-1 min-h-0">
              <div className="grid gap-2">
                <Label htmlFor="name">Event Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Summer Cornhole Tournament 2024"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  required
                />
              </div>

              {!editingEvent && (
                <>
                  <div className="border-t pt-3 mt-1">
                    <Label className="text-base font-semibold mb-2 block">
                      Reigning Champion Team (Optional)
                    </Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Select the two players who make up the reigning champion team
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="champion_player1">Champion Player 1</Label>
                    <Select
                      value={formData.champion_player1_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, champion_player1_id: value })
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
                    <Label htmlFor="champion_player2">Champion Player 2</Label>
                    <Select
                      value={formData.champion_player2_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, champion_player2_id: value })
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
                      id="champion_gets_bye"
                      type="checkbox"
                      checked={formData.champion_gets_bye}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          champion_gets_bye: e.target.checked,
                        })
                      }
                      disabled={
                        !formData.champion_player1_id ||
                        !formData.champion_player2_id
                      }
                      className="h-4 w-4 rounded border-gray-300 disabled:opacity-50"
                    />
                    <Label
                      htmlFor="champion_gets_bye"
                      className={`font-normal ${
                        !formData.champion_player1_id ||
                        !formData.champion_player2_id
                          ? 'text-muted-foreground'
                          : ''
                      }`}
                    >
                      Reigning champion gets first-game bye
                    </Label>
                  </div>

                  <div className="border-t pt-3 mt-2">
                    <Label className="text-base font-semibold mb-2 block">
                      Tournament Participants *
                    </Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Select players to participate in the tournament. Teams will be randomly assigned.
                    </p>
                    <div className="mb-2 p-2 bg-muted rounded-md">
                      <p className="text-sm font-medium">
                        Selected: {selectedParticipantIds.length} players
                        {selectedParticipantIds.length > 0 && (
                          <span className="ml-2">
                            ({selectedParticipantIds.length / 2} teams)
                          </span>
                        )}
                      </p>
                      {selectedParticipantIds.length % 2 !== 0 && (
                        <p className="text-sm text-destructive mt-1">
                          Please select an even number of players
                        </p>
                      )}
                      {selectedParticipantIds.length > 0 && selectedParticipantIds.length < 4 && (
                        <p className="text-sm text-destructive mt-1">
                          At least 4 players (2 teams) required
                        </p>
                      )}
                    </div>
                    <div className="max-h-36 overflow-y-auto border rounded-md p-2 space-y-1.5">
                      {getAvailableParticipants().length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          {formData.champion_player1_id && formData.champion_player2_id
                            ? 'All players are assigned to the champion team'
                            : 'No players available'}
                        </p>
                      ) : (
                        getAvailableParticipants().map((player) => (
                          <div key={player.playerid} className="flex items-center gap-2">
                            <input
                              id={`participant-${player.playerid}`}
                              type="checkbox"
                              checked={selectedParticipantIds.includes(player.playerid)}
                              onChange={() => toggleParticipant(player.playerid)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            <Label
                              htmlFor={`participant-${player.playerid}`}
                              className="font-normal cursor-pointer flex-1"
                            >
                              {player.firstname} {player.lastname}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter className="flex-shrink-0 px-6 pb-6 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingEvent ? 'Update' : 'Create'} Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
