#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
mailcatcher_ip=$(docker inspect supabase_inbucket_veetr --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
test -n "$mailcatcher_ip"
local_env=$(mktemp)
trap 'rm -f "$local_env"' EXIT HUP INT TERM
chmod 600 "$local_env"
printf 'LOCAL_MAILCATCHER=true\nLOCAL_SMTP_HOST=%s\nPORTAL_URL=http://localhost:4321\n' "$mailcatcher_ip" > "$local_env"
supabase functions serve --env-file "$local_env"
