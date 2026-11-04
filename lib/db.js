import pg from 'pg';

const { Pool } = pg;

// 不在 module load 時 throw：next build 會先收集 page data，那時.env 可能還沒讀到
// 改成需要連線時才建立池，本機 build 不會因為沒設 DATABASE_URL 而失敗
let pool;

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL 沒有設定。請檢查 .env.local 或 Vercel 專案的環境變數');
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      // 外部 Provider（Neon/Supabase）通常要求 ssl；用 connection string 裡的 sslmode 判斷
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      // serverless 函式是短命的：池要小、要會回收，否則多個實例會把 PG 的 max_connections 吃滿
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

// 只用參數化，不拼字串 SQL
export async function ensureSchema() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function listItems(limit = 50) {
  const capped = Math.min(Number(limit) || 50, 200);
  const r = await getPool().query(
    'SELECT id, title, body, created_at FROM items ORDER BY id DESC LIMIT $1',
    [capped]
  );
  return r.rows;
}

export async function addItem(title, body = '') {
  const r = await getPool().query(
    'INSERT INTO items (title, body) VALUES ($1, $2) RETURNING id, title, body, created_at',
    [title, body]
  );
  return r.rows[0];
}

export async function pingDb() {
  const r = await getPool().query('SELECT 1 AS ok');
  return r.rows[0].ok === 1;
}
