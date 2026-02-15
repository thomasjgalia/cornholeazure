import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { PlayerRow } from '@/types'
import { toast } from 'sonner'

export function usePlayers() {
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPlayers()
  }, [])

  async function loadPlayers() {
    try {
      setLoading(true)
      const data = await api.get<PlayerRow[]>('/players')
      setPlayers(data)
    } catch (error) {
      toast.error('Failed to load players')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function createPlayer(player: {
    firstname: string
    lastname: string
    email?: string
    phone?: string
    handicap?: number
    profile_secret?: string
  }) {
    try {
      const data = await api.post<PlayerRow>('/players', player)
      toast.success('Player created successfully')
      loadPlayers()
      return data
    } catch (error) {
      toast.error('Failed to create player')
      console.error(error)
      throw error
    }
  }

  async function updatePlayer(
    playerid: number,
    updates: Partial<Omit<PlayerRow, 'playerid' | 'created_at' | 'updated_at'>>
  ) {
    try {
      await api.put<PlayerRow>(`/players/${playerid}`, updates)
      toast.success('Player updated successfully')
      loadPlayers()
    } catch (error) {
      toast.error('Failed to update player')
      console.error(error)
      throw error
    }
  }

  async function deletePlayer(playerid: number) {
    try {
      await api.del(`/players/${playerid}`)
      toast.success('Player deleted successfully')
      loadPlayers()
    } catch (error) {
      toast.error('Failed to delete player')
      console.error(error)
      throw error
    }
  }

  return {
    players,
    loading,
    createPlayer,
    updatePlayer,
    deletePlayer,
    refresh: loadPlayers,
  }
}
