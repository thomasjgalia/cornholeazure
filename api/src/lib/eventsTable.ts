import { TableClient, odata } from '@azure/data-tables'

// Named distinctly (not just "Events") since this table lives in the same
// storage account as golfazure's own Events table - matches the SQL schema's
// cornhole_events naming, which existed for the exact same reason. Only
// Players is intentionally shared between the two apps.
const TABLE_NAME = 'CornholeEvents'
const PARTITION_KEY = 'event'

export type EventRecord = {
  id: number
  name: string
  date: string
  champion_gets_bye: boolean
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

function toRecord(entity: any): EventRecord {
  return {
    id: Number(entity.rowKey),
    name: entity.name,
    date: entity.date,
    champion_gets_bye: !!entity.championGetsBye,
    created_at: entity.createdAt ?? null,
  }
}

export async function listEvents(): Promise<EventRecord[]> {
  const client = await getClient()
  const out: EventRecord[] = []
  for await (const entity of client.listEntities({ queryOptions: { filter: odata`PartitionKey eq ${PARTITION_KEY}` } })) {
    out.push(toRecord(entity))
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return out
}

export async function getEvent(id: number): Promise<EventRecord | null> {
  const client = await getClient()
  try {
    const entity = await client.getEntity(PARTITION_KEY, String(id))
    return toRecord(entity)
  } catch (err: any) {
    if (err.statusCode === 404) return null
    throw err
  }
}

export async function createEvent(data: { name: string; date: string; champion_gets_bye: boolean }): Promise<EventRecord> {
  const client = await getClient()
  const existing = await listEvents()
  const nextId = existing.reduce((max, e) => Math.max(max, e.id), 0) + 1
  const now = new Date().toISOString()
  const fields = { name: data.name, date: data.date, championGetsBye: data.champion_gets_bye, createdAt: now }
  await client.createEntity({ partitionKey: PARTITION_KEY, rowKey: String(nextId), ...fields })
  return toRecord({ rowKey: String(nextId), ...fields })
}

export async function updateEvent(id: number, patch: Partial<{ name: string; date: string; champion_gets_bye: boolean }>): Promise<EventRecord | null> {
  const client = await getClient()
  const current = await getEvent(id)
  if (!current) return null

  const fields = {
    name: patch.name ?? current.name,
    date: patch.date ?? current.date,
    championGetsBye: 'champion_gets_bye' in patch ? !!patch.champion_gets_bye : current.champion_gets_bye,
    createdAt: current.created_at,
  }
  await client.updateEntity({ partitionKey: PARTITION_KEY, rowKey: String(id), ...fields }, 'Replace')
  return toRecord({ rowKey: String(id), ...fields })
}

export async function deleteEvent(id: number): Promise<void> {
  const client = await getClient()
  await client.deleteEntity(PARTITION_KEY, String(id))
}
