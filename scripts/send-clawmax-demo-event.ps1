param(
  [string]$ClawMaxServer = "http://localhost:3021",
  [string]$Prompt = "How can I verify that my personal agent remembers the correct source?",
  [string]$Response = "Create a small recall test with expected evidence and citations."
)

$ErrorActionPreference = "Stop"
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$body = @{
  source = "agent-chat"
  sessionId = "meeting-demo-$stamp"
  subjectId = "agentforge-meeting-demo"
  content = "User:`n$Prompt`n`nAssistant:`n$Response"
  metadata = @{
    tutorialStep = "ClawMax integration demo"
    agentId = "agentforge-meeting-demo"
    model = "demo-fixture"
  }
} | ConvertTo-Json -Depth 6

$queued = Invoke-RestMethod -Method Post -Uri "$ClawMaxServer/api/activity-export/events" -ContentType "application/json" -Body $body

$deadline = (Get-Date).AddSeconds(15)
do {
  Start-Sleep -Milliseconds 750
  $status = Invoke-RestMethod -Method Get -Uri "$ClawMaxServer/api/activity-export/status"
} while ($status.queuedEvents -gt 0 -and (Get-Date) -lt $deadline)

[pscustomobject]@{
  EventId = $queued.eventIds[0]
  Queued = $status.queuedEvents
  Delivery = if ($status.queuedEvents -eq 0) { "delivered" } else { "pending" }
  LastError = $status.delivery.worker.lastError
}
