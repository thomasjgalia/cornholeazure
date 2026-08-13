import { TableClient, odata } from '@azure/data-tables'

// Single global partition (like teams) - keeps `id` alone sufficient for
// delete, matching the existing API contract. Correctness note: BracketPage
// relies on match `id` order as a proxy for play order within an event
// (sorts by id desc to find the most recent match, since created_at isn't
// reliably populated). Global sequential ids still preserve that ordering
// correctly for any single event's subset of matches, since ids only ever
// increase - no per-event partitioning needed for this to hold.
const TABLE_NAME = 'Matches'
const PARTITION_KEY = 'match'

export type MatchRecord = {
  id: number
  event_id: number
  round: number
  match_number: number
  team1_id: number | null
  team2_id: number | null
  winner_id: number | null
  loser_id: number | null
  is_bye: boolean
  created_at: string | null
}

let clientPromise: Promise<TableClient> | null = null

function getClient(): Promise<TableClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const conn = process.env.AZURE_TABLES_CONNECTION_STRING
      if (!conn) throw new Error('AZURE_TABLES_CONNECTION_STRING is not configured')
      const client = TableClient.fromConnectionString(conn, TABLE_NAME)
      try {
        await client.createTable()
      } catch (err: any) {
        if (err.statusCode !== 409) throw err
      }
      return client
    })()
  }
  return clientPromise
}

function toRecord(entity: any): MatchRecord {
  return {
    id: Number(entity.rowKey),
    event_id: Number(entity.eventId),
    round: entity.round ?? 0,
    match_number: entity.matchNumber ?? 0,
    team1_id: entity.team1Id ?? null,
    team2_id: entity.team2Id ?? null,
    winner_id: entity.winnerId ?? null,
    loser_id: entity.loserId ?? null,
    is_bye: !!entity.isBye,
    created_at: entity.createdAt ?? null,
  }
}

export async function listAllMatches(): Promise<MatchRecord[]> {
  const client = await getClient()
  const out: MatchRecord[] = []
  for await (const entity of client.listEntities({ queryOptions: { filter: odata`PartitionKey eq ${PARTITION_KEY}` } })) {
    out.push(toRecord(entity))
  }
  out.sort((a, b) => a.id - b.id)
  return out
}

export async function listMatchesByEvent(eventId: number): Promise<MatchRecord[]> {
  const all = await listAllMatches()
  return all.filter((m) => m.event_id === eventId)
}

export async function createMatch(data: {
  event_id: number
  winner_id: number
  loser_id: number
  round: number
  match_number: number
  team1_id: number | null
  team2_id: number | null
  is_bye: boolean
}): Promise<MatchRecord> {
  const client = await getClient()
  const existing = await listAllMatches()
  const nextId = existing.reduce((max, m) => Math.max(max, m.id), 0) + 1
  const now = new Date().toISOString()
  const fields = {
    eventId: data.event_id,
    winnerId: data.winner_id,
    loserId: data.loser_id,
    round: data.round,
    matchNumber: data.match_number,
    team1Id: data.team1_id,
    team2Id: data.team2_id,
    isBye: data.is_bye,
    createdAt: now,
  }
  await client.createEntity({ partitionKey: PARTITION_KEY, rowKey: String(nextId), ...fields })
  return toRecord({ rowKey: String(nextId), ...fields })
}

export async function deleteMatch(id: number): Promise<void> {
  const client = await getClient()
  await client.deleteEntity(PARTITION_KEY, String(id))
}

// Deletes every match belonging to an event - used when the event itself is
// deleted, so matches don't get left behind as orphaned/unreachable data.
export async function deleteMatchesForEvent(eventId: number): Promise<void> {
  const client = await getClient()
  const matches = await listMatchesByEvent(eventId)
  for (const m of matches) {
    await client.deleteEntity(PARTITION_KEY, String(m.id))
  }
}
