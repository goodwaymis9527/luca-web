import { neon } from '@neondatabase/serverless';

// 不在 module load 時 throw：next build 會先收集 page data，那時.env 可能還沒讀到
// 改成需要連線時才建立 client，本機 build 不會因為沒設 DATABASE_URL 而失敗
//
// driver 選擇（依 neon-postgres skill）：
// - Vercel 是 serverless/edge 環境 → 用 @neondatabase/serverless，走 PgBouncer（transaction mode）
//   的 HTTP transport，一筆請求一條查詢，不會把 max_connections 吃滿
// - 本機網路封了 outbound 5432（實測 TCP timeout），HTTP transport 走 443 可通
// - 這裡只有單句 SQL，沒有 transaction/SET/session 狀態，HTTP transport 足夠
let sql;

function getClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL 沒有設定。請檢查 .env.local 或 Vercel 專案的環境變數');
  }
  if (!sql) sql = neon(connectionString);
  return sql;
}

// 只用參數化，不拼字串 SQL：tagged template 的值會被當成參數送，不會字串插值
export async function listItems(limit = 50) {
  const capped = Math.min(Number(limit) || 50, 200);
  return getClient()`SELECT id, title, body, created_at FROM items ORDER BY id DESC LIMIT ${capped}`;
}

export async function addItem(title, body = '') {
  const rows = await getClient()`INSERT INTO items (title, body) VALUES (${title}, ${body}) RETURNING id, title, body, created_at`;
  return rows[0];
}

export async function pingDb() {
  const rows = await getClient()`SELECT 1 AS ok`;
  return rows[0].ok === 1;
}
