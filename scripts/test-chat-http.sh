#!/usr/bin/env bash
# Smoke test the full chat HTTP API end-to-end.
set -euo pipefail
BASE=http://localhost:3000

echo "── 1. Create session"
SESSION=$(curl -s -X POST $BASE/api/v1/chat/sessions | jq -r '.data.sessionId')
echo "  sessionId: $SESSION"

echo
echo "── 2. POST first message (streaming SSE)"
curl -s -N -X POST $BASE/api/v1/chat/messages \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION\",\"content\":\"I want a calendar MCP server with two tools: book a meeting and list upcoming meetings for a user. Backend is Google Calendar API. Internal use only. Server name calendar-ops-mcp. Scopes: calendar:write and calendar:read. List paginates 25 per page.\"}" \
  | head -c 8000
echo
echo
echo "── 3. Inspect session state"
curl -s $BASE/api/v1/chat/sessions/$SESSION | jq '{status: .data.session.status, msgs: (.data.messages | length), latestPlan: .data.session.summary.plan.serverName, tools: [.data.session.summary.plan.tools[]? | .name]}'
