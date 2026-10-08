#!/usr/bin/env bash
# Full fresh-checkout Docker smoke test for QUERYMIND. Proves the exact
# sequence a brand new clone needs to go from nothing to a working, seeded,
# live-queryable stack: down -v (wipe any prior volume) -> up -d --build ->
# wait healthy -> seed -> /health -> /ask/stream SSE shape -> docker compose
# ps -> down -v cleanup. Exits non-zero on any failure.
#
# ponytail: plain bash + curl + docker compose, no test framework - this is a
# linear smoke script, not a suite; add one if it grows branches.
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL="http://localhost:8020"
FAILED=0

cleanup() {
    echo "--- cleanup: docker compose down -v ---"
    docker compose down -v || true
}
trap cleanup EXIT

fail() {
    echo "FAIL: $1" >&2
    FAILED=1
}

echo "=== 1. down -v (wipe any existing volume, prove fresh-checkout startup) ==="
docker compose down -v

echo "=== 2. up -d --build ==="
docker compose up -d --build

echo "=== 3. wait for postgres and redis to report healthy (api has no healthcheck) ==="
for i in $(seq 1 30); do
    pg_status=$(docker compose ps --format '{{.Service}} {{.Health}}' | awk '$1=="postgres"{print $2}')
    redis_status=$(docker compose ps --format '{{.Service}} {{.Health}}' | awk '$1=="redis"{print $2}')
    if [ "$pg_status" = "healthy" ] && [ "$redis_status" = "healthy" ]; then
        echo "postgres and redis healthy after ${i}s"
        break
    fi
    sleep 1
    if [ "$i" -eq 30 ]; then
        fail "postgres/redis did not become healthy within 30s (postgres=$pg_status redis=$redis_status)"
    fi
done

api_state=$(docker compose ps --format '{{.Service}} {{.State}}' | awk '$1=="api"{print $2}')
[ "$api_state" = "running" ] || fail "api container not running (state=$api_state)"

echo "=== 3b. wait for the api service itself to accept connections (no healthcheck defined on it) ==="
api_ready=0
for i in $(seq 1 30); do
    if curl -sf "$API_URL/health" >/dev/null 2>&1; then
        echo "api responding after ${i}s"
        api_ready=1
        break
    fi
    sleep 1
done
[ "$api_ready" -eq 1 ] || fail "api never responded to /health within 30s"

echo "=== 4. seed ==="
set -a; source .env 2>/dev/null || true; set +a
if ! DATABASE_URL="${DATABASE_URL:-postgresql://querymind_reader:querymind_reader_local_only@localhost:55901/querymind}" \
     ADMIN_DATABASE_URL="${ADMIN_DATABASE_URL:-postgresql://postgres:querymind_admin_local_only@localhost:55901/querymind}" \
     venv/bin/python db/seed.py; then
    fail "db/seed.py failed"
fi

echo "=== 5. curl /health ==="
health_body=$(curl -sf "$API_URL/health") || fail "/health did not return 200"
echo "$health_body"
echo "$health_body" | grep -q '"status":"ok"' || fail "/health body missing status:ok"

echo "=== 6. curl -N /ask/stream (SSE) ==="
if echo "$health_body" | grep -q '"llm_configured":true'; then
    echo "ANTHROPIC_API_KEY is configured - streaming one real question"
    stream_out=$(curl -sN -X POST "$API_URL/ask/stream" \
        -H 'content-type: application/json' \
        -d '{"question":"How many customers are there in total?"}')
    echo "$stream_out"
    echo "$stream_out" | grep -q '^event: generating_sql' || fail "SSE stream missing generating_sql event"
    echo "$stream_out" | grep -q '^event: answer' || fail "SSE stream missing a terminal answer event"
else
    echo "No ANTHROPIC_API_KEY configured - confirming the endpoint exists and streams the expected shape without a real LLM call"
    stream_out=$(curl -sN -X POST "$API_URL/ask/stream" \
        -H 'content-type: application/json' \
        -d '{"question":"How many customers are there in total?"}')
    echo "$stream_out"
    echo "$stream_out" | grep -q '^event: generating_sql' || fail "SSE stream missing generating_sql event"
    # With no API key, the anthropic client call raises inside gen() and the
    # stream's own except-block turns it into a terminal `error` event - this
    # is the documented, correct shape (api.py's ask_stream docstring), not a
    # failure of the endpoint itself.
    echo "$stream_out" | grep -qE '^event: (answer|error)' || fail "SSE stream missing a terminal answer/error event"
fi

echo "=== 7. docker compose ps (confirm all healthy/running) ==="
docker compose ps

echo "=== smoke test result ==="
if [ "$FAILED" -ne 0 ]; then
    echo "SMOKE TEST FAILED" >&2
    exit 1
fi
echo "SMOKE TEST PASSED"
exit 0
