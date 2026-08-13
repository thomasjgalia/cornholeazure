import { TableClient, odata } from '@azure/data-tables'

// Single partition (like players/events) - keeps `id` alone sufficient to
// look up/update/delete a team, matching the existing API contract (the
// frontend never sends event_id on update/delete). At this data volume a
// full-partition scan+filter for "teams in event X" costs nothing, and it
// means all teams share one partition, which is what lets batch-creating a
// new event's initial teams be a real atomic transaction (see
// createTeamsBatch below).
// Named distinctly (not just "Teams") since this table lives in the same
// storage account as golfazure's own Teams table - matches the SQL schema's
// cornhole_event_teams naming, which existed for the exact same reason.
const TABLE_NAME = 'CornholeEventTeams'
const PARTITION_KEY = 'team'

export type TeamRecord = {
  id: number
  event_id: number
  player1_id: number
  player2_id: number
  is_reigning_champion: boolean
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

function toRecord(entity: any): TeamRecord {
  return {
    id: Number(entity.rowKey),
    event_id: Number(entity.eventId),
    player1_id: Number(entity.player1Id),
    player2_id: Number(entity.player2Id),
    is_reigning_champion: !!entity.isReigningChampion,
    created_at: entity.createdAt ?? null,
  }
}

export async function listAllTeams(): Promise<TeamRecord[]> {
  const client = await getClient()
  const out: TeamRecord[] = []
  for await (const entity of client.listEntities({ queryOptions: { filter: odata`PartitionKey eq ${PARTITION_KEY}` } })) {
    out.push(toRecord(entity))
  }
  return out
}

export async function listTeamsByEvent(eventId: number): Promise<TeamRecord[]> {
  const all = await listAllTeams()
  return all.filter((t) => t.event_id === eventId)
}

export async function getTeam(id: number): Promise<TeamRecord | null> {
  const client = await getClient()
  try {
    const entity = await client.getEntity(PARTITION_KEY, String(id))
    return toRecord(entity)
  } catch (err: any) {
    if (err.statusCode === 404) return null
    throw err
  }
}

// Order-independent - {5,9} collides with {9,5}, matching the old SQL
// unique constraint's behavior (players.ts's duplicate-team guard).
export async function teamPairExists(eventId: number, player1Id: number, player2Id: number): Promise<boolean> {
  const teams = await listTeamsByEvent(eventId)
  return teams.some(
    (t) =>
      (t.player1_id === player1Id && t.player2_id === player2Id) ||
      (t.player1_id === player2Id && t.player2_id === player1Id)
  )
}

export async function createTeam(data: { event_id: number; player1_id: number; player2_id: number; is_reigning_champion: boolean }): Promise<TeamRecord> {
  const client = await getClient()
  const existing = await listAllTeams()
  const nextId = existing.reduce((max, t) => Math.max(max, t.id), 0) + 1
  const now = new Date().toISOString()
  const fields = {
    eventId: data.event_id,
    player1Id: data.player1_id,
    player2Id: data.player2_id,
    isReigningChampion: data.is_reigning_champion,
    createdAt: now,
  }
  await client.createEntity({ partitionKey: PARTITION_KEY, rowKey: String(nextId), ...fields })
  return toRecord({ rowKey: String(nextId), ...fields })
}

// Atomically creates several teams at once (used for an event's initial
// champion + participant teams) - all share the "team" partition, so this
// is a real all-or-nothing batch transaction, same guarantee the old SQL
// transaction gave for the teams specifically (the event row itself is a
// separate write - see events.ts).
export async function createTeamsBatch(
  teams: { event_id: number; player1_id: number; player2_id: number; is_reigning_champion: boolean }[]
): Promise<TeamRecord[]> {
  if (teams.length === 0) return []
  const client = await getClient()
  const existing = await listAllTeams()
  let nextId = existing.reduce((max, t) => Math.max(max, t.id), 0) + 1
  const now = new Date().toISOString()

  const entities = teams.map((data) => {
    const fields = {
      eventId: data.event_id,
      player1Id: data.player1_id,
      player2Id: data.player2_id,
      isReigningChampion: data.is_reigning_champion,
      createdAt: now,
    }
    const entity = { partitionKey: PARTITION_KEY, rowKey: String(nextId++), ...fields }
    return entity
  })

  await client.submitTransaction(entities.map((e) => ['create', e] as const))
  return entities.map(toRecord)
}

export async function updateTeam(id: number, patch: Partial<{ is_reigning_champion: boolean }>): Promise<TeamRecord | null> {
  const client = await getClient()
  const current = await getTeam(id)
  if (!current) return null

  const fields = {
    eventId: current.event_id,
    player1Id: current.player1_id,
    player2Id: current.player2_id,
    isReigningChampion: 'is_reigning_champion' in patch ? !!patch.is_reigning_champion : current.is_reigning_champion,
    createdAt: current.created_at,
  }
  await client.updateEntity({ partitionKey: PARTITION_KEY, rowKey: String(id), ...fields }, 'Replace')
  return toRecord({ rowKey: String(id), ...fields })
}

export async function deleteTeam(id: number): Promise<void> {
  const client = await getClient()
  await client.deleteEntity(PARTITION_KEY, String(id))
}

// Deletes every team belonging to an event - used when the event itself is
// deleted, so teams don't get left behind as orphaned/unreachable data.
export async function deleteTeamsForEvent(eventId: number): Promise<void> {
  const client = await getClient()
  const teams = await listTeamsByEvent(eventId)
  for (const t of teams) {
    await client.deleteEntity(PARTITION_KEY, String(t.id))
  }
}
