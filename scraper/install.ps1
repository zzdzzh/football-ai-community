# 安装 Python 爬虫依赖
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "安装 scraper 依赖..."
python -m pip install -r requirements.txt

Write-Host "可选：安装 Playwright Chromium（用于 FBRef 高级统计）"
Write-Host "  python -m playwright install chromium"

Write-Host "完成。测试同步英超："
Write-Host "  python -m scraper sync-league --league PL --no-fbref"
