---
標題: Deployment Protection 的 bypass token 用法（保留保護，用 token 访问）
作者: Luca
建立: 2026-11-05
更新: 2026-11-05
標籤:
  - Vercel
  - Deployment Protection
  - bypass token
  - 驗證
狀態: 驗證通過
語言: zh-TW
---

# Token

從 project settings API（`npx vercel api /v9/projects/prj_WEL31AntUe1IrlgtnKFMKTjdNo2Y`）讀到：

```text
protectionBypass: VOYjty5d1ZsO0PAGMbJYpFnzNxzWTYSL
  scope: automation-bypass
  isEnvVar: true
```

這是秘密值。**這支資料夾在 git 是 untracked**，但 `git add -A` 會把它送進倉庫；要留在倉庫外請把 `20261105_環境變數診斷_OpenCode/` 加進 `.gitignore`（我不會自己改 `.gitignore`）。

專案目前的保護設定：`ssoProtection.deploymentType = all_except_custom_domains`（Vercel Authentication），所以瀏覽器直接打會看到登入頁。

# 用法

**瀏覽器**（query 參數，最方便）：

```text
https://luca-web-vercel.vercel.app/api/health?_vercel_protection_bypass=VOYjty5d1ZsO0PAGMbJYpFnzNxzWTYSL
```

**curl / header**：

```powershell
curl.exe -s -H "x-vercel-protection-bypass: VOYjty5d1ZsO0PAGMbJYpFnzNxzWTYSL" https://luca-web-vercel.vercel.app/api/health
```

**CLI**（不需要 token，CLI 自己用 project settings 裡的 bypass）：

```powershell
npx vercel curl https://luca-web-vercel.vercel.app/api/health
```

# 實測

```text
GET /api/health?_vercel_protection_bypass=...  -> {"ok":true,"db":"connected"}  HTTP 200
GET /api/health  + header x-vercel-protection-bypass -> {"ok":true,"db":"connected"}  HTTP 200
```

## helper script（`vercel-check.ps1`）

Token 不寫死在腳本裡，改讀 `$env:VERCEL_BYPASS_TOKEN`：

```powershell
$env:VERCEL_BYPASS_TOKEN = "VOYjty5d1ZsO0PAGMbJYpFnzNxzWTYSL"
.\20261105_環境變數診斷_OpenCode\vercel-check.ps1
```

跑出來的結果（2026-11-05）：

```text
header 方式        -> {"ok":true,"db":"connected"}  HTTP 200
query 參數方式     -> {"ok":true,"db":"connected"}  HTTP 200
POST（form）       -> HTTP 303（route 的 form POST 會 redirect 到 /）
```

注意：POST 那一次會**真的寫入一筆資料**，所以跑腳本会在 `items` 留下一列（本次是 id 5，title `via-header`）。

# 注意

- `automation-bypass` 類型的 token 只跳過保護，不會讓專案變成公開；搜尋引擎與一般訪客仍會被擋。
- Query 參數會出現在瀏覽器歷史與某些 proxy/access log；自動化建議用 header 或環境變數 `VERCEL_BYPASS_TOKEN`（`vercel-check.ps1` 讀的就是這個）。
- 要撤銷：儀表板 Project Settings → Deployment Protection → Bypass URLs。
