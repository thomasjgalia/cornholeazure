# Migrating a React + Vite + Supabase App to Azure Static Web Apps + Azure SQL

This guide covers the code-level migration steps for converting a React/Vite/TypeScript SPA that uses direct Supabase client calls into an Azure Static Web App with Azure Functions API and Azure SQL backend. Written based on the golf tournament manager migration — apply the same patterns to the cornhole app.

## Architecture Change

**Before:** Browser → Supabase JS client → Supabase (Postgres)
**After:** Browser → fetch `/api/*` → Azure Functions → Azure SQL (MSSQL)

The key change: you can no longer call the database directly from the browser. Azure SQL doesn't have a browser SDK like Supabase. You need a thin API layer (Azure Functions) between the frontend and the database.

---

## Step 1: Create the `api/` Folder (Azure Functions Project)

Create an `api/` directory at the project root with this structure:

```
api/
├── host.json
├── package.json
├── tsconfig.json
└── src/
    ├── db.ts
    └── functions/
        ├── index.ts        ← entry point, imports all function files
        ├── events.ts       ← one file per table/resource
        ├── players.ts
        └── ...
```

### `api/host.json`

```json
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

### `api/package.json`

```json
{
  "name": "your-app-api",
  "version": "1.0.0",
  "main": "dist/src/functions/index.js",
  "scripts": {
    "build": "tsc",
    "prestart": "npm run build",
    "start": "func start"
  },
  "dependencies": {
    "@azure/functions": "^4.5.0",
    "mssql": "^11.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "devDependencies": {
    "@types/mssql": "^9.1.9",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0"
  }
}
```

**Important:** Do NOT include `azure-functions-core-tools` in devDependencies — it's a huge CLI package that will cause deployment failures. SWA handles the build tooling.

### `api/tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "dist",
    "rootDir": ".",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"]
}
```

### `api/src/db.ts`

```typescript
import sql from 'mssql'

const config: sql.config = {
  server: process.env.DB_SERVER || '',
  database: process.env.DB_NAME || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 30000,
  },
  // REQUIRED for Azure SQL — without this block, authentication fails silently
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER || '',
      password: process.env.DB_PASSWORD || '',
    },
  },
}

let pool: sql.ConnectionPool | null = null

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await sql.connect(config)
  }
  return pool
}
```

**Gotcha:** The `authentication` block with `type: 'default'` is mandatory for Azure SQL. Without it, the mssql/tedious driver won't authenticate even though `user`/`password` are set at the top level.

### `api/src/functions/index.ts`

```typescript
import './events'
import './players'
import './teams'
import './scores'
```

This is the single entry point referenced by `main` in package.json. Every function file must be imported here to register its routes.

---

## Step 2: Convert Supabase Calls to Azure Functions

### Pattern: Azure Function v4 HTTP Trigger

Each Supabase operation becomes an HTTP-triggered Azure Function. Here's the general pattern:

**Supabase (before):**
```typescript
const { data } = await supabase.from('events').select('*').order('eventdate', { ascending: false })
```

**Azure Function (after):**
```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getPool } from '../db'

app.http('events-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const pool = await getPool()
      const result = await pool.request().query(
        'SELECT * FROM events ORDER BY CAST(eventdate AS NVARCHAR(MAX)) DESC'
      )
      return { jsonBody: result.recordset }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})
```

### Supabase → MSSQL Query Translation Reference

| Supabase | MSSQL |
|----------|-------|
| `.select('*')` | `SELECT * FROM tablename` |
| `.insert({...})` | `INSERT INTO ... OUTPUT INSERTED.* VALUES (...)` |
| `.update({...}).eq('id', id)` | `UPDATE ... SET ... OUTPUT INSERTED.* WHERE id = @id` |
| `.delete().eq('id', id)` | `DELETE FROM ... WHERE id = @id` |
| `.eq('col', val)` | `WHERE col = @param` (use parameterized queries) |
| `.order('col', { ascending: false })` | `ORDER BY CAST(col AS NVARCHAR(MAX)) DESC` |
| `.upsert({...})` / `ON CONFLICT` | `MERGE ... USING ... ON ... WHEN MATCHED THEN UPDATE WHEN NOT MATCHED THEN INSERT` |
| `RETURNING *` (Postgres) | `OUTPUT INSERTED.*` (MSSQL) |

### Azure SQL Gotchas

1. **`text`/`ntext` columns cannot be sorted or compared.** If your Azure SQL tables use legacy `text` or `ntext` data types, you MUST wrap them in `CAST(column AS NVARCHAR(MAX))` in:
   - `ORDER BY` clauses
   - `WHERE` comparisons (e.g., `WHERE UPPER(CAST(sharecode AS NVARCHAR(MAX))) = @code`)
   - This does NOT apply to `int`, `datetime`, `bit`, or `nvarchar` columns

2. **Parameterized queries are required.** Use `.input('paramName', value)` — never concatenate values into SQL strings:
   ```typescript
   const result = await pool.request()
     .input('id', Number(req.params.id))
     .query('SELECT * FROM events WHERE eventid = @id')
   ```

3. **MERGE for upserts.** Postgres `ON CONFLICT` doesn't exist in MSSQL. Use `MERGE`:
   ```sql
   MERGE tablename AS target
   USING (SELECT @col1 AS col1, @col2 AS col2) AS source
   ON target.col1 = source.col1
   WHEN MATCHED THEN UPDATE SET col2 = @col2
   WHEN NOT MATCHED THEN INSERT (col1, col2) VALUES (@col1, @col2)
   OUTPUT INSERTED.*;
   ```

4. **JSON columns.** Supabase auto-parses JSON columns. With MSSQL, JSON is stored as `NVARCHAR(MAX)` text. You must:
   - `JSON.stringify()` when writing
   - `JSON.parse()` when reading

5. **Foreign key constraint errors.** MSSQL returns error number `547` for FK violations. Handle these in DELETE endpoints:
   ```typescript
   } catch (err: any) {
     if (err.number === 547 || err.message?.includes('REFERENCE')) {
       return { status: 409, jsonBody: { message: 'Cannot delete: referenced by other records' } }
     }
     return { status: 500, jsonBody: { message: err.message } }
   }
   ```

### Route Parameter Patterns

Azure Functions v4 supports typed route parameters:
- `route: 'events/{id:int}'` — matches `/api/events/123`
- `route: 'events/sharecode/{code}'` — matches `/api/events/sharecode/ABC123`
- Access via `req.params.id`, `req.params.code`
- Query strings via `req.query.get('paramName')`
- Request body via `await req.json()`

**Important:** Define specific routes (like `/sharecode/{code}`) as separate functions from generic `/{id:int}` routes. Azure Functions handles routing by specificity, but naming them distinctly avoids conflicts.

---

## Step 3: Create the Frontend API Client

Replace `src/lib/supabase.ts` with `src/lib/api.ts`:

```typescript
const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || res.statusText)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
```

`BASE = '/api'` works both locally (with SWA CLI proxy) and in production (SWA routes `/api/*` to managed functions automatically).

---

## Step 4: Migrate Hooks and Pages

### Hooks

Replace every `supabase.from(...)` call with the corresponding `api.*` call.

**Before (Supabase):**
```typescript
import { supabase } from '../lib/supabase'

export function useEvents() {
  const [events, setEvents] = useState<EventRow[]>([])
  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('eventdate', { ascending: false })
    setEvents(data || [])
  }
  // ...
}
```

**After (API):**
```typescript
import { api } from '../lib/api'

export function useEvents() {
  const [events, setEvents] = useState<EventRow[]>([])
  const fetchEvents = async () => {
    const data = await api.get<EventRow[]>('/events')
    setEvents(data)
  }
  // ...
}
```

### Pages

Replace any direct Supabase calls in page components with `api.*` calls. Common patterns:

```typescript
// Fetch by ID
const event = await api.get<EventRow>(`/events/${id}`)

// Create
const newEvent = await api.post<EventRow>('/events', formData)

// Update
const updated = await api.put<EventRow>(`/events/${id}`, formData)

// Delete
await api.del(`/events/${id}`)

// Fetch with query params
const scores = await api.get<ScoreRow[]>(`/scores?eventId=${eventId}`)

// Upsert
const score = await api.post<ScoreRow>('/scores/upsert', { eventid, playerid, holenumber, strokes })
```

### JSON Column Handling

If Supabase was auto-parsing a JSON column (e.g., `parperhole`), add normalization on the frontend since MSSQL returns it as a string:

```typescript
function normalizeRow(row: any): EventRow {
  return {
    ...row,
    parperhole: typeof row.parperhole === 'string' ? JSON.parse(row.parperhole) : row.parperhole,
  }
}
```

---

## Step 5: Update Root Project Config

### Remove Supabase

```bash
npm uninstall @supabase/supabase-js
```

Delete `src/lib/supabase.ts` and any `.env` references to `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

### Remove Vercel Config

Delete `vercel.json` if it exists.

### Clean Up `package.json` Scripts

Remove any Express/server-related scripts if you used an intermediate Express backend. Keep it simple:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

### Remove Vite Proxy

If you added a proxy for local Express development, remove it from `vite.config.ts`. The SWA CLI handles proxying in local dev:

```typescript
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 5173,
  },
})
```

### Add `staticwebapp.config.json` at Project Root

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/assets/*", "*.ico", "*.png", "*.svg"]
  },
  "platform": {
    "apiRuntime": "node:20"
  }
}
```

This ensures SPA client-side routing works (all non-asset, non-API routes fall back to `index.html`) and sets the Node.js runtime to 20 (required by mssql dependencies).

---

## Step 6: Set Up Azure Static Web App

When creating the SWA resource in Azure Portal and linking to GitHub, use these build settings:

| Setting | Value |
|---------|-------|
| App location | `/` |
| API location | `api` |
| Output location | `dist` |

### Environment Variables (Application Settings)

Set these in the SWA resource under **Configuration > Application Settings**:

| Name | Value |
|------|-------|
| `DB_SERVER` | `sol-apps-sql.database.windows.net` |
| `DB_NAME` | `sol-db` |
| `DB_USER` | `turnstoneread` |
| `DB_PASSWORD` | `S0Lfili!Lib3rt@ti` |

These are the same for both the golf and cornhole apps since they share the same database and credentials.

---

## Step 7: Database Tables

Since both apps share `sol-db`, make sure cornhole table names don't collide with golf tables (`events`, `players`, `teams`, `scores`). Use a prefix like `ch_events`, `ch_players`, etc., or ensure the cornhole tables already have distinct names.

If your Azure SQL tables use legacy `text`/`ntext` column types, you'll need the `CAST(col AS NVARCHAR(MAX))` workaround in every `ORDER BY` and string comparison. Consider altering columns to `NVARCHAR(MAX)` to avoid this:

```sql
ALTER TABLE your_table ALTER COLUMN your_column NVARCHAR(MAX)
```

---

## Checklist

- [ ] Create `api/` folder with `host.json`, `package.json`, `tsconfig.json`
- [ ] Create `api/src/db.ts` using environment variables (with `authentication` block)
- [ ] Create `api/src/functions/index.ts` importing all function files
- [ ] Create one function file per table/resource in `api/src/functions/`
- [ ] Create `src/lib/api.ts` (fetch wrapper)
- [ ] Delete `src/lib/supabase.ts`
- [ ] Migrate all hooks from Supabase calls to `api.*` calls
- [ ] Migrate all pages from Supabase calls to `api.*` calls
- [ ] Add JSON parse/stringify for any JSON columns
- [ ] Add `CAST(col AS NVARCHAR(MAX))` for text/ntext columns in ORDER BY and WHERE
- [ ] Add `staticwebapp.config.json` at project root
- [ ] Remove `@supabase/supabase-js` from package.json
- [ ] Remove `vercel.json`
- [ ] Remove Vite proxy config
- [ ] Clean up package.json scripts
- [ ] `npm uninstall` any Express/cors/tsx/concurrently packages if used during dev
- [ ] Push to GitHub repo
- [ ] Create Azure SWA, set app/api/output locations, add env vars
- [ ] Verify deployment in GitHub Actions
