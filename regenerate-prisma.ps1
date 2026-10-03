# Stop any node processes, regenerate Prisma client, restart dev server
Write-Host "Stopping dev server..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "Regenerating Prisma client..." -ForegroundColor Yellow
npx prisma generate

Write-Host "Restarting dev server..." -ForegroundColor Green
npm run dev
