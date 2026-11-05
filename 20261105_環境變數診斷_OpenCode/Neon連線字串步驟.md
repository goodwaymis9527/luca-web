---
標題: Neon 連線字串取得步驟（本機 Postgres 目前不可用）
作者: Luca
建立: 2026-11-05
更新: 2026-11-05
標籤:
  - Neon
  - PostgreSQL
  - 環境變數
  - Vercel
狀態: 待執行
語言: zh-TW
---

# 為什麼一定要網路可達的 DB

本機檢查結果：

- `Get-Service postgreSQL*` → 無服務
- `where.exe psql` → 找不到
- `docker ps` → `failed to connect to the docker API ... dockerDesktopLinuxEngine`（Docker Desktop 未啟動）

Vercel 的 Node 函式跑在 Vercel 的機房（日誌顯示 `region: sfo1`），它連不到你電腦上的 `localhost:5432`。所以 `DATABASE_URL` 必須指向公開可達的端點。

# Neon 步驟

1. https://neon.tech → 用 GitHub 登入 → **New Project**。
2. Region 選接近函式實際執行區域（本次日誌是 `sfo1`，Neon 沒有 SFO，選 `aws-us-west-2` Oregon 最近；Neon 免費層只能有一個 branch，region 建好之後不能改）。
3. 建完 project，Dashboard 右側 **Connection string** 區塊有兩個版本：
   - **Direct connection**：`postgresql://user:pass@ep-xxx-123456.us-east-2.aws.neon.tech/dbname?sslmode=require`
   - **With pooler (PgBouncer)**：`postgresql://user:pass@ep-xxx-pooler-123456...`
4. Serverless 建議用 **pooler 版**，因為每個函式實例都會開連線，`lib/db.js` 的 `max: 3` 在多實例下還是可能把免費層連線數吃滿；PgBouncer 幫你收。
5. 建表：把 `schema.sql` 貼進 Neon 的 **SQL Editor** 執行（`lib/db.js` 的 `ensureSchema()` 也會自己建，但免費層第一次連線較慢，先手動建比較穩）。

# Supabase 的話

Project Settings → **Database** → Connection string：

```
postgresql://postgres:postgres@db-xxx.supabase.co:5432/postgres?sslmode=require
```

- 要用 **Connection pooling 開關**（Project Settings → Database → Connection pooling）打開後拿到的才是 `pooler.supabase.com` 的字串。
- Supabase 免費層 1 週無活動會暫停，`pg` 連暫停中的專案會 timeout。

# 兩個與現有程式有關的實際風險

1. **`ssl` 判斷依賴字串含 `sslmode=require`**。Neon 字串自帶，沒問題；但若你复制時把 query 參數丟掉，`ssl: false` 會被 Neon 拒連線（`SSL required`）。建議改成預設開 SSL，只有明確 `sslmode=disable` 才關。
2. **`connectionTimeoutMillis: 5000` 對 Neon 免費層偏緊**。免費層 scale-to-zero 後第一次連線要等 compute 醒過來，常見 1–5 秒，剛好卡在邊界。建議 10000–15000，並把 `idleTimeoutMillis` 調小（你已經是 30000，OK）。

# 拿到字串後的執行順序

```powershell
npx vercel env add DATABASE_URL production
npx vercel env add DATABASE_URL development
npx vercel env pull          # 產生 D:\LucaWebVercel\.env.local
npm run dev
curl http://127.0.0.1:3000/api/health
```

## 思考紀錄

- 先確認本機沒有可用的 Postgres（服務、psql、Docker 三項都查過），避免建議一條走不通的路。
- 建議用 pooler 字串而非 direct，理由是 serverless 多實例的連線膨脹問題，這是 `lib/db.js` 現行 `max: 3` 挡不住的。
