import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface NamedPlayer {
  firstname: string
  lastname: string
}

export function formatPlayerName(player?: NamedPlayer): string {
  if (!player) return '?'
  return `${player.firstname} ${player.lastname.charAt(0)}.`
}

export function formatTeamName(team: { player1?: NamedPlayer; player2?: NamedPlayer }): string {
  return `${formatPlayerName(team.player1)}/${formatPlayerName(team.player2)}`
}

export function shufflePairs(playerIds: number[]): Array<{ player1_id: number; player2_id: number }> {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
  const pairs: Array<{ player1_id: number; player2_id: number }> = []
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push({ player1_id: shuffled[i]!, player2_id: shuffled[i + 1]! })
  }
  return pairs
}
