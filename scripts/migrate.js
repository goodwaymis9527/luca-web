// Schema 用這份腳本管理，不在請求路徑裡跑 ensureSchema()
// skill 的原則：遷移要用直接連線（非 -pooler），因為 PgBouncer transaction mode 不支援 session 級行為
// 本機 5432 被封（實測 TCP timeout），所以走 HTTP transport；能連 5432 時把 DATABASE_URL 換成 DATABASE_URL_UNPOOLED
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL 沒有設定。用 node --env-file=.env.local scripts/migrate.js 執行');
}

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, '..', 'schema.sql'), 'utf8');

const sql = neon(connectionString);
const statements = raw
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  // sql(...) 只能當 tagged template；一般函式呼叫要用 sql.query()
  await sql.query(statement);
}

const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'items'`;
console.log(`套用了 ${statements.length} 個陳述式`);
console.log(tables.length === 1 ? 'items: OK' : 'items: 未建立');
