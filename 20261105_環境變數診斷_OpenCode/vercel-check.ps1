# 用 bypass token 驗證 production deployment（保留 Deployment Protection）
# Token 不硬編碼：讀環境變數 VERCEL_BYPASS_TOKEN
# 用法：
#   $env:VERCEL_BYPASS_TOKEN = "VOYjty5d1ZsO0PAGMbJYpFnzNxzWTYSL"
#   .\20261105_環境變數診斷_OpenCode\vercel-check.ps1

$token = $env:VERCEL_BYPASS_TOKEN
if (-not $token) {
    Write-Output "VERCEL_BYPASS_TOKEN 沒有設定。token 值見 DeploymentProtection-bypass.md"
    exit 1
}

$base = "https://luca-web-vercel.vercel.app"

Write-Output "--- header 方式 ---"
curl.exe -s -w "\nHTTP %{http_code}\n" -H "x-vercel-protection-bypass: $token" "$base/api/health"

Write-Output "--- query 參數方式 ---"
curl.exe -s -w "\nHTTP %{http_code}\n" "$base/api/health?_vercel_protection_bypass=$token"

Write-Output "--- POST（form）via header ---"
curl.exe -s -w "\nHTTP %{http_code}\n" -X POST `
    -H "x-vercel-protection-bypass: $token" `
    -H "Content-Type: application/x-www-form-urlencoded" `
    -d "title=via-header&body=ps1-script" "$base/api/items"
