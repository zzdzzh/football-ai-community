# 安装 Python 爬虫依赖
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "安装 scraper 依赖..."
python -m pip install -r requirements.txt

Write-Host "可选：安装 Playwright Chromium（用于 FBRef / Transfermarkt 过人机验证）"
Write-Host "  python -m playwright install chromium"
Write-Host "TM 被 WAF 拦截时，在 scraper 目录执行："
Write-Host "  .\scripts\refresh-tm-cookies.ps1"
Write-Host "  （会弹出浏览器，人工点完验证后回终端按 Enter）"

Write-Host "完成。测试同步英超："
Write-Host "  python -m scraper sync-league --league PL --no-fbref"
