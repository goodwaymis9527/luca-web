# luca-web（路 A：GitHub 倉庫 → Vercel 執行 → Neon/Supabase 資料庫）

本專案是 Next.js 16 + `pg`，跑在 Vercel 上；GitHub 只有「程式碼來源」的角色。

## 檔案

```
LucaWebVercel\
  package.json
  .gitignore          ← .env / node_modules / .next 不入倉庫
  .env.example        ← 入倉庫
  schema.sql          ← 給 Neon/Supabase SQL Editor 用
  lib\db.js           ← 連線池 + 參數化 SQL
  app\layout.jsx
  app\page.jsx         ← 動態頁（force-dynamic）
  app\api\items\route.js
  app\api\health\route.js
```

## 跑之前要做的事

1. 在 Neon 建 project（免費層 1 GB / 5 GB egress，5 分鐘無流量會 scale to zero）
   或 Supabase（免費層 500 MB，1 週無活動暫停）。
2. 把 connection string 寫進 `.env.local`（本機）或 Vercel 專案的環境變數（正式）。
   **connection string 不要提交進倉庫。**
3. 本機跑：

   ```powershell
   npm install
   npm run dev        # http://127.0.0.1:3000
   ```

4. 部署（二選一）：

   ```powershell
   # a) 用 CLI（程式碼可以留在 Gitea，不依賴 GitHub 整合）
   npx vercel                 # 第一次會登入並建立專案
   npx vercel env add DATABASE_URL production
   npx vercel --prod

   # b) 用 GitHub 整合：在 Vercel 連上倉庫，push 就自動部署
   #    （Vercel 官方支援 GitHub/GitLab/Bitbucket，不含 Gitea）
   ```

## 三個已知的限制

- Hobby 層**只能非商業個人使用**；function 最长 300 秒、記憶體 2 GB。
- `pg` 只能跑 **Node runtime**，所以 route 裡寫死 `export const runtime = 'nodejs'`；edge runtime 沒有 Node 的 net 模組。
- `/` 設了 `force-dynamic`，build 時不會被預渲染成靜態頁（實測 route 表是 `ƒ`），否则資料會被固定在 build 當下的結果。

## 上線後檢查

```powershell
curl https://<你的域名>/api/health
```

應該回 `{"ok":true,"db":"connected"}`。

## Git 部分

- 倉庫：`https://github.com/goodwaymis9527/<倉庫名>.git`（要先在網頁上建立）
- 推送用 `git ph`（別名 = `push -u github main`），這支資料夾只有 `github` 遠端
- commit 作者會用全域身分 `Luca / 351768965+goodwaymis9527@users.noreply.github.com`

> 注意：這支資料夾不在 `D:\gitDockAllPush.bat` 的清單內，因為它推 GitHub 不推 Gitea。
