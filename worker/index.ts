import { Hono } from 'hono';
import { getIdentity, isAdminMember, type Identity } from './auth';

const app = new Hono<{ Bindings: Env }>();

async function requireAdmin(c: { env: Env } & Parameters<typeof getIdentity>[0]): Promise<Identity | Response> {
	const identity = await getIdentity(c);
	if (!identity) return Response.json({ message: 'Authentication required' }, { status: 401 });
	if (!(await isAdminMember(c.env, identity.memberId))) {
		return Response.json({ message: 'Admin access required' }, { status: 403 });
	}
	return identity;
}

function mapEventRow(row: any) {
	return { ...row, champion_gets_bye: !!row.champion_gets_bye };
}

function mapPlayerRow(id: number, firstname: string, lastname: string) {
	return { playerid: id, firstname, lastname };
}

const PLAYER_SELECT = "COALESCE(m.first_name, m.display_name) as firstname, COALESCE(m.last_name, '') as lastname";

// ---- session ----

app.get('/api/session', async (c) => {
	const identity = await getIdentity(c);
	if (!identity) return c.json({ identity: null, isAdmin: false });
	const admin = await isAdminMember(c.env, identity.memberId);
	return c.json({ identity: { memberId: identity.memberId, displayName: identity.displayName }, isAdmin: admin });
});

// ---- players (read-only view of SOLDelco's shared members table) ----

app.get('/api/players', async (c) => {
	const { results } = await c.env.DB.prepare(
		`SELECT id, ${PLAYER_SELECT} FROM members m ORDER BY COALESCE(last_name, display_name), COALESCE(first_name, '')`,
	).all<{ id: number; firstname: string; lastname: string }>();
	return c.json(results.map((r) => mapPlayerRow(r.id, r.firstname, r.lastname)));
});

// ---- events ----

app.get('/api/events', async (c) => {
	const { results } = await c.env.DB.prepare(
		'SELECT id, name, date, champion_gets_bye, created_at FROM cornhole_events ORDER BY date DESC',
	).all();
	return c.json(results.map(mapEventRow));
});

app.get('/api/events/:id', async (c) => {
	const id = Number(c.req.param('id'));
	const row = await c.env.DB.prepare('SELECT id, name, date, champion_gets_bye, created_at FROM cornhole_events WHERE id = ?')
		.bind(id)
		.first();
	if (!row) return c.json({ message: 'Not found' }, 404);
	return c.json(mapEventRow(row));
});

app.post('/api/events', async (c) => {
	const auth = await requireAdmin(c);
	if (auth instanceof Response) return auth;

	const body = await c.req.json();
	const { name, date, champion_gets_bye, champion_team, participant_teams } = body;
	if (!name || !date) return c.json({ message: 'name and date are required' }, 400);

	const event = await c.env.DB.prepare(
		'INSERT INTO cornhole_events (name, date, champion_gets_bye) VALUES (?, ?, ?) RETURNING id, name, date, champion_gets_bye, created_at',
	)
		.bind(name, date, champion_gets_bye ? 1 : 0)
		.first<any>();

	const teamsToCreate: Array<{ player1_id: number; player2_id: number; is_reigning_champion: number }> = [];
	if (champion_team?.player1_id && champion_team?.player2_id) {
		teamsToCreate.push({ player1_id: champion_team.player1_id, player2_id: champion_team.player2_id, is_reigning_champion: 1 });
	}
	for (const t of participant_teams ?? []) {
		teamsToCreate.push({ player1_id: t.player1_id, player2_id: t.player2_id, is_reigning_champion: 0 });
	}
	if (teamsToCreate.length > 0) {
		await c.env.DB.batch(
			teamsToCreate.map((t) =>
				c.env.DB.prepare('INSERT INTO cornhole_teams (event_id, player1_id, player2_id, is_reigning_champion) VALUES (?, ?, ?, ?)').bind(
					event.id,
					t.player1_id,
					t.player2_id,
					t.is_reigning_champion,
				),
			),
		);
	}

	return c.json(mapEventRow(event), 201);
});

app.put('/api/events/:id', async (c) => {
	const auth = await requireAdmin(c);
	if (auth instanceof Response) return auth;

	const id = Number(c.req.param('id'));
	const body = await c.req.json();
	const existing = await c.env.DB.prepare('SELECT id FROM cornhole_events WHERE id = ?').bind(id).first();
	if (!existing) return c.json({ message: 'Not found' }, 404);

	await c.env.DB.prepare('UPDATE cornhole_events SET name = ?, date = ?, champion_gets_bye = ? WHERE id = ?')
		.bind(body.name, body.date, body.champion_gets_bye ? 1 : 0, id)
		.run();

	const updated = await c.env.DB.prepare('SELECT id, name, date, champion_gets_bye, created_at FROM cornhole_events WHERE id = ?')
		.bind(id)
		.first();
	return c.json(mapEventRow(updated));
});

app.delete('/api/events/:id', async (c) => {
	const auth = await requireAdmin(c);
	if (auth instanceof Response) return auth;

	const id = Number(c.req.param('id'));
	await c.env.DB.batch([
		c.env.DB.prepare('DELETE FROM cornhole_matches WHERE event_id = ?').bind(id),
		c.env.DB.prepare('DELETE FROM cornhole_teams WHERE event_id = ?').bind(id),
		c.env.DB.prepare('DELETE FROM cornhole_events WHERE id = ?').bind(id),
	]);
	return c.json({ success: true });
});

// ---- teams ----

app.get('/api/teams', async (c) => {
	const eventId = c.req.query('eventId');
	if (!eventId) return c.json({ message: 'eventId is required' }, 400);

	const { results } = await c.env.DB.prepare(
		`SELECT t.id, t.event_id, t.player1_id, t.player2_id, t.is_reigning_champion, t.created_at,
			p1.id as p1_id, COALESCE(p1.first_name, p1.display_name) as p1_first, COALESCE(p1.last_name, '') as p1_last,
			p2.id as p2_id, COALESCE(p2.first_name, p2.display_name) as p2_first, COALESCE(p2.last_name, '') as p2_last
		 FROM cornhole_teams t
		 JOIN members p1 ON p1.id = t.player1_id
		 JOIN members p2 ON p2.id = t.player2_id
		 WHERE t.event_id = ?`,
	)
		.bind(Number(eventId))
		.all<any>();

	const teams = results.map((row) => ({
		id: row.id,
		event_id: row.event_id,
		player1_id: row.player1_id,
		player2_id: row.player2_id,
		is_reigning_champion: !!row.is_reigning_champion,
		created_at: row.created_at,
		player1: mapPlayerRow(row.p1_id, row.p1_first, row.p1_last),
		player2: mapPlayerRow(row.p2_id, row.p2_first, row.p2_last),
	}));
	return c.json(teams);
});

app.post('/api/teams', async (c) => {
	const auth = await requireAdmin(c);
	if (auth instanceof Response) return auth;

	const body = await c.req.json();
	const { event_id, player1_id, player2_id, is_reigning_champion } = body;
	if (!event_id || !player1_id || !player2_id) {
		return c.json({ message: 'event_id, player1_id, player2_id are required' }, 400);
	}

	const dup = await c.env.DB.prepare(
		'SELECT id FROM cornhole_teams WHERE event_id = ? AND ((player1_id = ? AND player2_id = ?) OR (player1_id = ? AND player2_id = ?))',
	)
		.bind(event_id, player1_id, player2_id, player2_id, player1_id)
		.first();
	if (dup) return c.json({ message: 'This team pairing already exists in this event' }, 409);

	const inserted = await c.env.DB.prepare(
		'INSERT INTO cornhole_teams (event_id, player1_id, player2_id, is_reigning_champion) VALUES (?, ?, ?, ?) RETURNING id',
	)
		.bind(event_id, player1_id, player2_id, is_reigning_champion ? 1 : 0)
		.first<{ id: number }>();

	return c.json({ id: inserted?.id }, 201);
});

app.put('/api/teams/:id', async (c) => {
	const auth = await requireAdmin(c);
	if (auth instanceof Response) return auth;

	const id = Number(c.req.param('id'));
	const body = await c.req.json();
	const existing = await c.env.DB.prepare('SELECT id FROM cornhole_teams WHERE id = ?').bind(id).first();
	if (!existing) return c.json({ message: 'Not found' }, 404);

	await c.env.DB.prepare('UPDATE cornhole_teams SET is_reigning_champion = ? WHERE id = ?')
		.bind(body.is_reigning_champion ? 1 : 0, id)
		.run();
	return c.json({ success: true });
});

app.delete('/api/teams/:id', async (c) => {
	const auth = await requireAdmin(c);
	if (auth instanceof Response) return auth;

	const id = Number(c.req.param('id'));
	await c.env.DB.prepare('DELETE FROM cornhole_teams WHERE id = ?').bind(id).run();
	return c.json({ success: true });
});

// ---- matches ----

app.get('/api/matches', async (c) => {
	const eventId = c.req.query('eventId');
	if (!eventId) return c.json({ message: 'eventId is required' }, 400);

	const { results } = await c.env.DB.prepare('SELECT id, winner_id, loser_id, created_at FROM cornhole_matches WHERE event_id = ? ORDER BY id ASC')
		.bind(Number(eventId))
		.all();
	return c.json(results);
});

app.post('/api/matches', async (c) => {
	const auth = await requireAdmin(c);
	if (auth instanceof Response) return auth;

	const body = await c.req.json();
	const { event_id, winner_id, loser_id, team1_id, team2_id } = body;
	if (!event_id || !winner_id || !loser_id) {
		return c.json({ message: 'event_id, winner_id, loser_id are required' }, 400);
	}

	const inserted = await c.env.DB.prepare(
		'INSERT INTO cornhole_matches (event_id, team1_id, team2_id, winner_id, loser_id) VALUES (?, ?, ?, ?, ?) RETURNING id, winner_id, loser_id, created_at',
	)
		.bind(event_id, team1_id ?? null, team2_id ?? null, winner_id, loser_id)
		.first();

	return c.json(inserted, 201);
});

app.delete('/api/matches/:id', async (c) => {
	const auth = await requireAdmin(c);
	if (auth instanceof Response) return auth;

	const id = Number(c.req.param('id'));
	await c.env.DB.prepare('DELETE FROM cornhole_matches WHERE id = ?').bind(id).run();
	return c.json({ success: true });
});

app.onError((err, c) => {
	console.error(err);
	return c.json({ message: err.message || 'Internal error' }, 500);
});

export default app;
