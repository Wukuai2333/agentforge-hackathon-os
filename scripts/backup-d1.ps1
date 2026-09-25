param(
  [string]$DatabaseName = "agentforge-hackathon-prod",
  [string]$OutputDirectory = ".\backups"
)

$resolvedRoot = (Resolve-Path ".").Path
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$resolvedOutput = (Resolve-Path $OutputDirectory).Path
if (-not $resolvedOutput.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Backup output must stay inside the AgentForge workspace."
}
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputPath = Join-Path $resolvedOutput "$DatabaseName-$timestamp.sql"
npx wrangler d1 export $DatabaseName --remote --output $outputPath
if ($LASTEXITCODE -ne 0) { throw "D1 export failed." }
Write-Host "Backup created: $outputPath"
