$repo = "c:\Users\Berna\Software\2026\Revolver"
$screenshotDir = "c:\Users\Berna\Software\2026\Revolver\output\web-game"
$client = "C:\Users\Berna\.codex\skills\develop-web-game\scripts\web_game_playwright_client.js"
$actions = "c:\Users\Berna\Software\2026\Revolver\test-actions.json"

Remove-Item -Force "$screenshotDir\*" -ErrorAction SilentlyContinue

$job = Start-Job -ScriptBlock {
  param($wd)
  Set-Location $wd
  npm run dev -- --host 127.0.0.1 --port 5173
} -ArgumentList $repo

Start-Sleep -Seconds 8

try {
  node $client --url "http://127.0.0.1:5173" --actions-file $actions --iterations 4 --pause-ms 250 --screenshot-dir $screenshotDir
} finally {
  Stop-Job $job -ErrorAction SilentlyContinue
  Remove-Job $job -Force -ErrorAction SilentlyContinue
}
