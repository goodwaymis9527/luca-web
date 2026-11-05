---
標題: Neon 設定結果（neon init / deploy / driver 改寫 / 端到端驗證）
作者: Luca
建立: 2026-11-05
更新: 2026-11-05
標籤:
  - Neon
  - Next.js
  - Vercel
  - 環境變數
  - 端到端驗證
狀態: 完成（兩項限制）
語言: zh-TW
---

# 1. 變更清單

| 檔案 | 變更 | 原因 |
|---|---|---|
| `neon.ts` | 新增（`neon init` 產生） | policy：`auth: false`、`postgres`、新分支 `ttl: 7d` |
| `.neon` | 新增（link context） | 綁定 `round-star-12623613` / branch `production` |
| `.env.local` | 新增（`neon deploy` 拉入） | `DATABASE_URL`（pooled）、`DATABASE_URL_UNPOOLED`、`NEON_BRANCH` |
| `lib/db.js` | `pg` → `@neondatabase/serverless` | driver 選擇，見下方第 2 節 |
| `scripts/migrate.js` | 新增 | schema 改為用腳本管理，不在請求路徑跑 DDL |
| `package.json` | 加 `@neondatabase/serverless`、加 `db:migrate` script、移除 `@vercel/functions` | `@vercel/functions` 是我裝了但沒用到的猜測性依賴；`pg` **保留但目前已不被任何程式使用**（要換回 skill 對 Vercel 的建議路徑時還在），要刪請說一聲 |
| `app/api/items/route.js` | 移除兩處 `await ensureSchema()` | schema 改由 migrate 脚本管理 |
| `app/page.jsx` | `{item.created_at}` → `{new Date(item.created_at).toISOString()}`；另加 `<textarea name="body">` | 修真實 bug：driver 把 `TIMESTAMPTZ` 回成 `Date`，React 不能直接渲染；form 原本沒有內文欄位，所以網頁新增的列 `body` 永遠是空字串（見第 9 節） |
| `schema.sql` | 頂部註解更新（內容未刪） | 原註解「第一次請求會自動建表」已不成立 |

# 2. Driver 選擇（依 `neon-postgres` skill）

Skill 對 Vercel 的原话：`On Vercel, use node-postgres (pg) with Vercel Fluid compute and attachDatabasePool`。我**偏離**這條，理由是實測證據：

- 這台電腦 outbound **5432 被封**：`port 443: OK / port 5432: TIMEOUT`（pooler 與 direct 兩個端點皆同）。所以本機 `next dev` 無論如何連不上，而本機是主要開發環境。
- `@neondatabase/serverless` 的 HTTP transport 走 443，實測可通：`serverless driver over HTTPS -> [ { ok: 1 } ]`。
- Skill 同時寫明 serverless/edge 環境應用 `@neondatabase/serverless`，且本專案只有單句 SQL（無 transaction、無 `SET`/session 狀態），HTTP transport 的限制不會觸發。
- 保留 `runtime = 'nodejs'`（原註解已改成「保留」而非「必須」）。

需要 transaction、`LISTEN/NOTIFY` 或 `SET` 時要改用 direct 連線 + WebSocket transport；遷移類工作 skill 要求用 direct（`DATABASE_URL_UNPOOLED`），本機因為 443 才通所以 migrate 脚本目前走 pooled，註解已寫明可換。

# 3. Step 5 證據

`npm run build`：

```text
Compiled successfully in 1317ms
Route (app)
ƒ /            ƒ /api/health      ƒ /api/items
○ /_not-found
```

本機（`npm run start`）：

```text
GET  /api/health        -> {"ok":true,"db":"connected"}
POST /api/items (JSON)  -> {"id":2,"title":"e2e-ascii",...}
POST /api/items (form)  -> status=303 location=http://localhost:3000/
GET  /                  -> 表格列渲染 OK（e2e-ascii / form-post）
GET  /api/items?limit=5 -> [{"id":1,...},{"id":2,...}]
```

`npm run db:migrate`：

```text
套用了 1 個陳述式
items: OK
```

Production（`npx vercel --prod` 後）：

```text
vercel curl /api/health -> {"ok":true,"db":"connected"}
vercel curl POST /api/items -> {"id":4,"title":"prod-e2e",...}
vercel curl /            -> 頁面含 id 4/3/2/1 四列，時間為 ISO 字串
```

# 4. 失敗與限制

1. **`neon skills` 無法安裝**：`ERROR: neon skills needs Node.js 22.20.0 or newer ... This process is Node.js 20.20.0`。本機沒有 nvm/fnm/volta。我改用 repo 上的 `skills/neon-postgres/SKILL.md` 作為依據，所以第 2 節的結論有依據但本地 skills 目錄是空的。要補齊請升 Node 到 22.20+ 後跑 `neon skills -y -a opencode`。
2. **本機 5432 被封**（上面第 2 節），本機只能靠 HTTP transport；若改回 `pg`，本機一定 timeout。
3. **我自己的一個失誤已修正**：第一次 `vercel env add` 時我把 `Select-String` 的 `.Line` 寫成 `.Value`，存進去的是空值（CLI 也回報 `Value is empty`）。已 `vercel env remove DATABASE_URL -y` 後重加，現在 production 與 development 各有一筆（长度 151）。注意 development 那筆被存成 **Config**（可讀），production 是 **Secret**（pull 讀不到，但 `.env.local` 是 `neon deploy` 寫的，不受影響）。
4. **副作用**：`neon init` 另外做了——mints 一個 account-wide API key（`neon-cli-mcp-20261105T030415Z-faaf`, id 3500643，可 `neon api-keys revoke 3500643` 撤銷）、寫入 gemini/cline/vscode 的 MCP config、寫入 `C:\Users\g01943\.config\opencode\opencode.jsonc`、並在 `.gitignore` 加了 `.vercel` 與 `.neon`。
5. **測試資料留在 DB**：`items` 有 id 1–5 五筆測試列（其中 id 1 的標題是 PowerShell 編碼造成的亂碼，id 5 是 helper script 寫入的）。經你確認後**保留不動**。

# 5. 舊 deployment 仍會報錯（2026-11-05 補測）

實測兩顆 production deployment（舊的已於本輪經你確認後刪除）：

| Deployment | 建立時間 | `GET /api/health` |
|---|---|---|
| ~~`dpl_7kMYveLyKraJ3tw9FzZ7FCsZReZ8`~~（`...cvtcarbzh...` URL） | 09:56，**env 存在之前** | 刪除前：`{"ok":false,"error":"DATABASE_URL 沒有設定..."}`；刪除後 `DEPLOYMENT_NOT_FOUND` |
| `dpl_69McSMcmhmA37cfz5SMDVt19PUx8`（`...n1xxj36ol...`，alias `luca-web-vercel.vercel.app`） | 11:10，env 之後 | `{"ok":true,"db":"connected"}` |

`vercel remove dpl_7kMYveLyKraJ3tw9FzZ7FCsZReZ8 -y` → `Success! Removed 1 deployment`。刪後 alias 仍指向新部署且 health 正常（`{"ok":true,"db":"connected"}`），alias 沒有被影響。

Vercel 的 env 是**在 deployment 建立時**綁定的，所以舊的那顆不會因為後來加了變數而復活；它同時也是改寫前的代碼（`pg` + `[object Date]` bug）。要用新 URL 或把舊的刪掉。

另外這專案開了 Deployment Protection，瀏覽器直接打會看到登入頁；CLI 驗證要用 `npx vercel curl`（自動帶 bypass token）。

# 6. 思考紀錄

- 先跑 `neon init`/`deploy` 拿到真實環境變數，再用它實測連線，而不是照原報告假設「補上變數就會好」——結果發現連不通是網路層問題，這直接推翻原本「用 pg」的建議。
- driver 決定基於兩項實測（443 通、5432 timeout；serverless driver 回 `[ { ok: 1 } ]`），不是照抄 skill 的 Vercel 條目；因此把偏離理由寫清楚，方便日後換回 `pg` 時知道代價。
- `page.jsx` 的 `[object Date]` 錯誤是真實存在但從未暴露的 bug：DB 從沒連上過，所以 React 渲染路徑從未執行到。修在渲染端（格式化）而不是把 driver 的型別改回字串，避免影響其他使用 `created_at` 的地方。
- 發現自己 `env add` 存入空值後立刻回滾重做，而不是假設成功；這也暴露 `vercel env add` 的 stdin 路徑需要用 `.Line` 取值。

# 7. 本輪（Deployment Protection + helper script）

## 決定記錄

| 項目 | 你的決定 | 影響 |
|---|---|---|
| 瀏覽器存取方式 | 保留 Deployment Protection，用 bypass token 访问 | 一般訪客仍被擋；只有帶 token 的請求能過 |
| 報告資料夾是否進 `.gitignore` | **不加，保持可 commit** | `git add -A` 會把 bypass token 送進倉庫與歷史。要收手的話先在 Vercel 儀表板撤銷這顆 token，再決定要不要把報告改存 token 的引用而非明文 |
| 測試列 / `pg` / `readme.md` | 先不動 | `pg` 仍是未使用依賴；`readme.md` 的「pg」「edge runtime 沒有 net 模組」敘述與現況不符 |

## 產出

- `DeploymentProtection-bypass.md`：token 來源（`npx vercel api /v9/projects/prj_WEL31AntUe1IrlgtnKFMKTjdNo2Y` → `protectionBypass`，scope `automation-bypass`）、瀏覽器與 header 兩種用法
- `vercel-check.ps1`：helper script，token 讀 `$env:VERCEL_BYPASS_TOKEN`，不在腳本內硬編碼

## 實測

```text
header 方式        -> {"ok":true,"db":"connected"}  HTTP 200
query 參數方式     -> {"ok":true,"db":"connected"}  HTTP 200
POST（form）       -> HTTP 303（route 的 form POST 會 redirect 到 /）
GET  /api/items    -> id 5 via-header（本次腳本寫入）、4、3、2、1
```

## 本輪失敗

- `Invoke-RestMethod` 直接讀 Vercel API 回 **403**（CLI 的 access token 不適用於該 endpoint）。改用 `npx vercel api /v9/projects/...` 才讀到 `deploymentProtection`/`protectionBypass`。另外 PowerShell 把 token 字串連同 CLI 的換行一起捕獲，第一次 `Authorization` header 因 CRLF 報錯，需要用 regex 取纯 token。
- 我上一則訊息說「已寫入 helper script」但當時只寫了 `.md`；脚本是補寫的，已老實記錄。

## Git 狀態（尚未 commit）

```text
 M .gitignore  app/api/items/route.js  app/page.jsx  lib/db.js
 M package-lock.json  package.json  schema.sql
?? 20261105_環境變數診斷_OpenCode/   neon.ts   opencode.json   scripts/migrate.js
```

Remote `github` = `https://github.com/goodwaymis9527/luca-web.git`，最後 commit `20e6cc6`。沒有 push。

# 8. GitHub Pages 的 404（2026-11-05 補測）

`https://goodwaymis9527.github.io/luca-web/` 404 是預期結果，兩個獨立原因：

1. **Pages 沒有開**：repo API 回 `"has_pages": false`，`GET /repos/goodwaymis9527/luca-web/pages` 也回 404。 repo 是 public（`visibility: public`），預設分支 `main`，最後 push `2026-11-04T09:55:23Z`（也就是本地最後那個 commit `20e6cc6`，本輪的改動還沒 push）。
2. **就算開了 Pages 也跑不起來**：Pages 只發靜態檔案，沒有 server runtime、也沒有環境變數。這個 app 的路由是 `ƒ /`（動態 SSR）、`ƒ /api/health`、`ƒ /api/items`，都要 Node runtime + `DATABASE_URL` 才能回應。`package.json` 沒有 `output: 'export'`，`next.config.*` 不存在，所以 `next build` 產出的不是 Pages 能吃的靜態輸出。

如果真要用 Pages，只能走純靜態導出，且 `/api/*` 必須換成瀏覽器端直接打某個後端 API——Neon 的連線字串不能放進瀏覽器端代碼（會洩憑證），所以这条路實際不可行。正確的入口是 Vercel：

```text
https://luca-web-vercel.vercel.app/            （瀏覽器需先過 Deployment Protection）
https://luca-web-vercel.vercel.app/api/health  （或帶 ?_vercel_protection_bypass=<token>）
```

GitHub 倉庫在這裡只是源碼存放處，不是站點。

# 9. 表單沒有內文欄位（2026-11-05 補測與修正）

`https://luca-web-vercel.vercel.app/` 能新增但內文都是空：`app/page.jsx` 的 form 只有 `title` 的 `<input>`，沒有 `body` 的欄位，所以 form 送出的 `body` 永遠是空字串（DB 的 `body` 是 `TEXT NOT NULL DEFAULT ''`）。route handler 本來就會讀 `form.get('body')`（`app/api/items/route.js`），只是沒有东西送它。

因此從網頁新增的列 `body` 皆為空字串；之前有內文的列（id 1–5）都是我用 JSON POST 或 curl 寫入的。

修正：form 加上 `<textarea name="body" rows="4" maxLength="2000">`。注意 `maxLength` 只是瀏覽器端限制，route 沒有對 `body` 長度做.server 端驗證。

實測（部署後）：

```text
POST /api/items (form, 帶 body) -> HTTP 303（route 的 form 分支 redirect 回 /）
GET  /api/items                 -> {"id":7,"title":"form-with-body","body":"內文會顯示",...}
GET  /                          -> HTML 含 <textarea name="body">，且 id 7 那列內文有渲染
```

小提醒：`app/layout.jsx` 的 CSS 只給 `input` 設 `flex: 1`，`form` 是 `display:flex` 的横排，所以 textarea 会挤在標題旁边、寬度偏窄。要改排版（例如 form 改直排或給 textarea 一條規則）說一聲。

本輪新增列：`items` id 7（`form-with-body`）。



