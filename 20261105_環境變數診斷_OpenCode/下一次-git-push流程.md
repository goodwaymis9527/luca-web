---
標題: 下一次 git commit / push 的做法（為什麼直接 push 看起來沒更新）
作者: Luca
建立: 2026-11-05
更新: 2026-11-05
標籤:
  - Git
  - 工作流
  - 秘密值
  - Vercel
狀態: 說明
語言: zh-TW
---

# 為什麼直接 `git push` 看起來沒更新

`git push` 只傳送 **commit**。工作樹裡的改動如果沒被 `git add` + `git commit`，push 就沒有任何東西可送，會回：

```text
Everything up-to-date
```

實例：本次本地 HEAD 和 `github/main` 都是 `20e6cc6`，所以 push 等於空操作。

# 標準四步

```powershell
cd D:\LucaWebVercel

git status                 # 先看哪些檔被改，哪些是 untracked
git add app/page.jsx lib/db.js scripts/migrate.js   # 明確列檔名，不要盲用 -A
git commit -F msg.txt      # 中文訊息用檔案，見下方「中文 commit 訊息」
git push github main       # 這個倉庫的 remote 名稱是 github，不是 origin
```

`git add -A` 方便但危險：它會把 untracked 的東西一次全收（本次就把含 API key 的 `opencode.json` 送了進去）。

# commit 前掃秘密值

```powershell
# 看即將送出去的檔案清單
git status --short

# 掃描可疑的 key（在將要 commit 的檔案裡）
Select-String -Path opencode.json,.env.example,*.md -Pattern 'apiKey|sk-|npg_|Bypass|token' -CaseSensitive:$false
```

`.gitignore` 目前擋：`.env`、`.env.local`、`.env.production`、`node_modules/`、`.next/`、`.vercel/`、`.neon`。
**不擋**：`opencode.json`、`20261105_*_OpenCode/`（你的決定：報告資料夾保持可 commit）。

# 怎麼確認 push 真的有動

```powershell
git rev-parse HEAD github/main     # 兩個 sha 相同 = 沒有東西可 push；不同 = 還沒送
git log --oneline -1 github/main   # 送完後這裡應該等於本地 HEAD
```

送成功的輸出長這樣：

```text
   20e6cc6..7eb0b52  main -> main
```

（PowerShell 會把 git 的 stderr 當成錯誤、exit code 1，但推送其實成功。看 `..` 那行判斷。）

# 中文 commit 訊息

PowerShell 5.1 把參數用系統 codepage（Big5 950）送出，`git commit -m "中文"` 可能變成亂碼寫進倉庫。這次我用檔案，GitHub 上檢查過是正確 UTF-8：

```powershell
git commit -F C:\Users\g01943\AppData\Local\Temp\opencode\commit-msg.txt
```

或在 PowerShell 7+ 先 `$OutputEncoding = [Text.UTF8Encoding]::new($false)` 再直接用 `-m`。

# push 到 GitHub ≠ 部署到 Vercel

這次 Vercel 的更新是手動 `npx vercel deploy --prod` 做的。倉庫沒有接 Vercel 的 Git 整合（CLI 建議過 `vercel git connect`），所以 `git push` 不會觸發重建。要「push 就部署」需要連 Git 整合或加 Vercel GitHub App。

# 目前未 commit 的狀態

第 10 節（秘密值外流）写在 `Neon設定結果.md` 裡，目前是本地改動、還沒 commit。
