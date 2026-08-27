import { getCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { verify } from './session';

const IDENTITY_COOKIE = 'sol_identity';

export interface Identity {
	memberId: number;
	displayName: string;
	exp: number;
}

export async function getIdentity(c: Context<{ Bindings: Env }>): Promise<Identity | null> {
	const token = getCookie(c, IDENTITY_COOKIE);
	return verify<Identity>(c.env.IDENTITY_SECRET, token);
}

export async function isAdminMember(env: Env, memberId: number): Promise<boolean> {
	const row = await env.DB.prepare('SELECT is_admin FROM members WHERE id = ?').bind(memberId).first<{ is_admin: number }>();
	return !!row?.is_admin;
}
