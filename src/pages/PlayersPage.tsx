import { useState } from 'react'
import { usePlayers } from '@/hooks/usePlayers'
import { useAuth } from '@/lib/auth'
import { PlayerRow } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'

export default function PlayersPage() {
  const { players, loading, createPlayer, updatePlayer, deletePlayer } = usePlayers()
  const { isProfileClaimed } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<PlayerRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlayerRow | null>(null)
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

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deletePlayer(deleteTarget.playerid)
      setIsDialogOpen(false)
    } catch (error) {
      // Error already handled by hook
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Players</h1>
        {isProfileClaimed && (
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Player
          </Button>
        )}
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
        <Card>
          <CardContent className="p-0 divide-y">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center px-3 py-2">
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
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
        <Card>
          <CardContent className="p-0 divide-y">
            {filteredPlayers.map((player) => (
              <div
                key={player.playerid}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <span className="truncate">
                  {player.firstname} {player.lastname}
                </span>
                {isProfileClaimed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-7 w-7 p-0"
                    onClick={() => openEditDialog(player)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
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
              {editingPlayer && (
                <Button
                  type="button"
                  variant="destructive"
                  className="mr-auto"
                  onClick={() => setDeleteTarget(editingPlayer)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingPlayer ? 'Update' : 'Add'} Player</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete player?"
        description={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.firstname} ${deleteTarget.lastname}?`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </div>
  )
}
