# 打开 Playwright 浏览器过人机验证并保存 TM Cookie
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "刷新 Transfermarkt Cookie（浏览器会弹出）..."
python scripts/refresh_tm_cookies.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "失败。若提示缺浏览器，先执行: python -m playwright install chromium"
    exit $LASTEXITCODE
}
