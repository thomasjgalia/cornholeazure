import { useState } from 'react'
import { usePlayers } from '@/hooks/usePlayers'
import { PlayerRow } from '@/types'
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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'

export default function PlayersPage() {
  const { players, loading, createPlayer, updatePlayer, deletePlayer } = usePlayers()
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<PlayerRow | null>(null)
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    handicap: '',
    profile_secret: '',
  })

  const filteredPlayers = players.filter((player) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      player.firstname.toLowerCase().includes(term) ||
      player.lastname.toLowerCase().includes(term) ||
      player.email?.toLowerCase().includes(term) ||
      player.phone?.toLowerCase().includes(term)
    )
  })

  function openAddDialog() {
    setEditingPlayer(null)
    setFormData({
      firstname: '',
      lastname: '',
      email: '',
      phone: '',
      handicap: '',
      profile_secret: '',
    })
    setIsDialogOpen(true)
  }

  function openEditDialog(player: PlayerRow) {
    setEditingPlayer(player)
    setFormData({
      firstname: player.firstname,
      lastname: player.lastname,
      email: player.email || '',
      phone: player.phone || '',
      handicap: player.handicap?.toString() || '',
      profile_secret: player.profile_secret || '',
    })
    setIsDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.firstname.trim() || !formData.lastname.trim()) {
      return
    }

    try {
      const playerData = {
        firstname: formData.firstname.trim(),
        lastname: formData.lastname.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        handicap: formData.handicap ? parseFloat(formData.handicap) : undefined,
        profile_secret: formData.profile_secret.trim() || undefined,
      }

      if (editingPlayer) {
        await updatePlayer(editingPlayer.playerid, playerData)
      } else {
        await createPlayer(playerData)
      }

      setIsDialogOpen(false)
    } catch (error) {
      // Error already handled by hook
    }
  }

  async function handleDelete(player: PlayerRow) {
    if (
      !window.confirm(
        `Are you sure you want to delete ${player.firstname} ${player.lastname}?`
      )
    ) {
      return
    }

    try {
      await deletePlayer(player.playerid)
    } catch (error) {
      // Error already handled by hook
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Players</h1>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Player
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPlayers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchTerm
                ? 'No players found matching your search.'
                : 'No players yet. Add your first player!'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPlayers.map((player) => (
            <Card key={player.playerid}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    {player.firstname} {player.lastname}
                  </span>
                  {player.profile_secret && (
                    <Badge variant="secondary" className="text-xs">
                      Secret
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {player.email && (
                  <p className="text-sm text-muted-foreground mb-1">{player.email}</p>
                )}
                {player.phone && (
                  <p className="text-sm text-muted-foreground mb-1">{player.phone}</p>
                )}
                {player.handicap !== null && player.handicap !== undefined && (
                  <p className="text-sm text-muted-foreground mb-3">
                    Handicap: {player.handicap}
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(player)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(player)}>
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
              <DialogTitle>{editingPlayer ? 'Edit Player' : 'Add Player'}</DialogTitle>
              <DialogDescription>
                {editingPlayer
                  ? 'Update player information.'
                  : 'Add a new player to the system.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="firstname">First Name *</Label>
                <Input
                  id="firstname"
                  value={formData.firstname}
                  onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastname">Last Name *</Label>
                <Input
                  id="lastname"
                  value={formData.lastname}
                  onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="handicap">Handicap</Label>
                <Input
                  id="handicap"
                  type="number"
                  step="0.1"
                  value={formData.handicap}
                  onChange={(e) => setFormData({ ...formData, handicap: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile_secret">Profile Secret</Label>
                <Input
                  id="profile_secret"
                  type="text"
                  placeholder="e.g., 1234 or golf"
                  value={formData.profile_secret}
                  onChange={(e) =>
                    setFormData({ ...formData, profile_secret: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Used for claiming profile in the app
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingPlayer ? 'Update' : 'Add'} Player</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
