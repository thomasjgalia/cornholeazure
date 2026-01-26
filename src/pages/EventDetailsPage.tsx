import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { TABLES } from '@/lib/constants'
import { EventRow, TeamWithPlayers } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeft, Users, Trophy, Calendar } from 'lucide-react'
import { format } from 'date-fns'

export default function EventDetailsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EventRow | null>(null)
  const [teams, setTeams] = useState<TeamWithPlayers[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (eventId) {
      loadEventData()
    }
  }, [eventId])

  async function loadEventData() {
    try {
      setLoading(true)

      // Load event
      const { data: eventData, error: eventError } = await supabase
        .from(TABLES.CORNHOLE_EVENTS)
        .select('*')
        .eq('id', eventId)
        .single()

      if (eventError) throw eventError
      setEvent(eventData)

      // Load teams
      const { data: teamsData, error: teamsError } = await supabase
        .from(TABLES.CORNHOLE_EVENT_TEAMS)
        .select('*')
        .eq('event_id', eventId)

      if (teamsError) throw teamsError

      const teamsWithPlayers = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { data: player1 } = await supabase
            .from(TABLES.PLAYERS)
            .select('*')
            .eq('playerid', team.player1_id)
            .single()

          const { data: player2 } = await supabase
            .from(TABLES.PLAYERS)
            .select('*')
            .eq('playerid', team.player2_id)
            .single()

          return {
            ...team,
            player1: player1 || undefined,
            player2: player2 || undefined,
          }
        })
      )

      setTeams(teamsWithPlayers)
    } catch (error) {
      toast.error('Failed to load event data')
      console.error(error)
    } finally {
      setLoading(false)
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
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {event?.date && format(new Date(event.date), 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{teams.length} teams registered</span>
                </div>
                {event?.champion_gets_bye && (
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <span>Reigning champion gets first-round bye</span>
                    {teams.find((t) => t.is_reigning_champion) && (
                      <Badge variant="secondary">Champion registered</Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button onClick={() => navigate(`/events/${eventId}/teams`)}>
              <Users className="mr-2 h-4 w-4" />
              Manage Teams
            </Button>
            <Button
              onClick={() => navigate(`/events/${eventId}/bracket`)}
            >
              <Trophy className="mr-2 h-4 w-4" />
              View Tournament
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
