import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('lastname', { ascending: true })
        .order('firstname', { ascending: true })

      if (error) throw error
      setPlayers(data || [])
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
      const { data, error } = await supabase
        .from('players')
        .insert([player])
        .select()
        .single()

      if (error) throw error

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
      const { error } = await supabase
        .from('players')
        .update(updates)
        .eq('playerid', playerid)

      if (error) throw error

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
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('playerid', playerid)

      if (error) throw error

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
