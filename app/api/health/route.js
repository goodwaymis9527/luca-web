import { NextResponse } from 'next/server';
import { pingDb } from '../../../lib/db.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ok = await pingDb();
    return NextResponse.json({ ok, db: ok ? 'connected' : 'failed' });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err.message || err) }, { status: 500 });
  }
}
