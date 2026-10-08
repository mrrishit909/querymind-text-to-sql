"""QUERYMIND API: question -> LLM-proposed SQL -> AST-validated -> executed
read-only -> grounded answer."""
from __future__ import annotations

import json
import logging
import os
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from llm_sql import generate_sql, has_api_key
from query_executor import execute_validated_sql, ground_narrative
from sql_validator import validate_sql

logger = logging.getLogger("querymind")

app = FastAPI(title="QUERYMIND - Secure Text-to-SQL API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---------------------------------------------------------------------------
# Redis-backed rate limiting on /ask and /ask/stream: both call a real paid
# LLM, so both need it. Fixed-window counter keyed by caller IP (this app
# has no auth concept at all - see LIMITATIONS.md/PRD-139a - so IP is the
# only identity available). client=None (REDIS_URL unset or unreachable)
# makes check() a literal no-op: never a fake pass hiding a bug, there is
# simply no limiter configured. Same pattern as the PREDICTIVE project's
# api/main.py::RateLimiter.
# ponytail: single shared window per key, no sliding window; good enough for
# a local demo. Upgrade to a sliding-window log if burst-at-boundary matters.
# ---------------------------------------------------------------------------
class RateLimiter:
    def __init__(self, client=None, limit: int = 20, window: int = 60):
        self.client = client
        self.limit = limit
        self.window = window

    def check(self, identity: str) -> bool:
        """Returns False if `identity` is over the limit. Always True (no-op)
        when no backend is configured."""
        if self.client is None:
            return True
        window_id = int(time.time() // self.window)
        key = f"ratelimit:{identity}:{window_id}"
        try:
            count = self.client.incr(key)
            if count == 1:
                self.client.expire(key, self.window)
            return count <= self.limit
        except Exception as exc:  # redis down mid-run: fail open, log it
            logger.warning("Rate limiter backend error, allowing request: %s", exc)
            return True


def _build_rate_limiter() -> RateLimiter:
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        return RateLimiter(client=None)
    try:
        import redis as redis_lib

        client = redis_lib.Redis.from_url(redis_url, socket_connect_timeout=2)
        client.ping()
        return RateLimiter(client=client)
    except Exception as exc:
        logger.warning("Rate limiting disabled: could not connect to REDIS_URL (%s)", exc)
        return RateLimiter(client=None)


_rate_limiter = _build_rate_limiter()


def _enforce_rate_limit(request: Request) -> None:
    identity = request.client.host if request.client else "unknown"
    if not _rate_limiter.check(identity):
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limited",
                "message": f"Rate limit exceeded: max {_rate_limiter.limit} requests per {_rate_limiter.window}s",
            },
        )


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


class AskResponse(BaseModel):
    question: str
    sql: str | None
    safety_status: str  # "validated" | "rejected" | "llm_declined"
    reason: str = ""
    columns: list[str] = []
    rows: list[dict] = []
    row_count: int = 0
    answer: str
    cost_usd: float | None = None
    latency_s: float | None = None


@app.get("/health")
def health():
    return {"status": "ok", "llm_configured": has_api_key()}


@app.get("/schema")
def schema():
    from db.connection import APPROVED_VIEWS, schema_catalog
    return {"approved_views": sorted(APPROVED_VIEWS), "catalog": schema_catalog()}


@app.post("/ask", response_model=AskResponse)
def ask(req: AskRequest, request: Request):
    _enforce_rate_limit(request)
    llm = generate_sql(req.question)

    if not llm.sql:
        return AskResponse(
            question=req.question,
            sql=None,
            safety_status="llm_declined",
            reason=llm.assumptions,
            answer=f"The model declined to write a query: {llm.assumptions}",
            cost_usd=llm.cost_usd,
            latency_s=llm.latency_s,
        )

    result = execute_validated_sql(llm.sql)
    if not result.ok:
        return AskResponse(
            question=req.question,
            sql=llm.sql,
            safety_status="rejected",
            reason=result.reason,
            answer=f"The proposed query was rejected before execution: {result.reason}",
            cost_usd=llm.cost_usd,
            latency_s=llm.latency_s,
        )

    return AskResponse(
        question=req.question,
        sql=result.sql,
        safety_status="validated",
        columns=result.columns,
        rows=result.rows,
        row_count=result.row_count,
        answer=ground_narrative(req.question, result),
        cost_usd=llm.cost_usd,
        latency_s=llm.latency_s,
    )


class DirectSQLRequest(BaseModel):
    """Test/debug endpoint: run validated SQL without the LLM round trip.
    Used by the adversarial security tests and by local development."""
    sql: str = Field(min_length=1, max_length=5000)


@app.post("/execute", response_model=AskResponse)
def execute_direct(req: DirectSQLRequest):
    result = execute_validated_sql(req.sql)
    if not result.ok:
        return AskResponse(
            question="(direct SQL)", sql=req.sql, safety_status="rejected",
            reason=result.reason, answer=f"Rejected: {result.reason}",
        )
    return AskResponse(
        question="(direct SQL)", sql=result.sql, safety_status="validated",
        columns=result.columns, rows=result.rows, row_count=result.row_count,
        answer=ground_narrative("(direct SQL)", result),
    )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/ask/stream")
def ask_stream(req: AskRequest, request: Request):
    """Same question -> SQL -> validated -> executed -> grounded pipeline as
    POST /ask, emitted as staged Server-Sent Events instead of one blocking
    response. Additive endpoint: POST /ask and POST /execute above are
    unchanged (chat-ui-engineer and tests/test_api.py depend on that).

    This is POST, not GET, so the browser's native EventSource can't attach
    to it (EventSource only issues GET). The client must use `fetch()` and
    read `response.body` as a stream, splitting on blank lines to get each
    `event:`/`data:` pair - exactly the Fetch-based SSE pattern (see the
    `@microsoft/fetch-event-source` library, or a hand-rolled reader) rather
    than `new EventSource(url)`.

    Event sequence (always in this order, and each `data:` line is one
    single-line JSON object, exactly as `json.dumps` produces it):
      event: generating_sql   data: {"stage": "generating_sql"}
      event: validating       data: {"stage": "validating", "sql": "<llm's proposed SQL, unvalidated>"}
      event: executing        data: {"stage": "executing", "sql": "<AST-regenerated SQL actually run>"}
      event: answer           data: {<exactly the AskResponse JSON shape POST /ask returns - same
                                       9 fields: question, sql, safety_status, reason, columns,
                                       rows, row_count, answer, cost_usd, latency_s>}
    On a declined/rejected query, there is no `executing` event - the
    sequence goes generating_sql -> validating -> answer (with
    safety_status "llm_declined" or "rejected", same as /ask; `sql`/`reason`
    are populated the same way /ask populates them for that case).

    On an unexpected server error (including a 429 from the rate limiter,
    which is a plain HTTP 429 response BEFORE the stream even opens, not an
    SSE event) or an in-stream exception, a terminal `error` event replaces
    `answer` and the stream ends - there is no `answer` event after it:
      event: error   data: {"stage": "<generating_sql|validating|executing, whichever was in
                              progress when it failed>", "message": "<str(exception)>"}

    Integration note for the client: `error` (and an HTTP 429) must be
    treated as terminal, NOT as "fall back to POST /ask" - falling back
    would silently repeat the same question as a second real, paid Claude
    API call and a second hit against the same rate limit.
    """
    _enforce_rate_limit(request)

    def gen():
        stage = "generating_sql"
        try:
            yield _sse(stage, {"stage": stage})
            llm = generate_sql(req.question)

            if not llm.sql:
                payload = AskResponse(
                    question=req.question, sql=None, safety_status="llm_declined",
                    reason=llm.assumptions, answer=f"The model declined to write a query: {llm.assumptions}",
                    cost_usd=llm.cost_usd, latency_s=llm.latency_s,
                ).model_dump()
                yield _sse("answer", payload)
                return

            stage = "validating"
            yield _sse(stage, {"stage": stage, "sql": llm.sql})
            validation = validate_sql(llm.sql)
            if not validation.ok:
                payload = AskResponse(
                    question=req.question, sql=llm.sql, safety_status="rejected",
                    reason=validation.reason,
                    answer=f"The proposed query was rejected before execution: {validation.reason}",
                    cost_usd=llm.cost_usd, latency_s=llm.latency_s,
                ).model_dump()
                yield _sse("answer", payload)
                return

            stage = "executing"
            yield _sse(stage, {"stage": stage, "sql": validation.sql})
            result = execute_validated_sql(llm.sql)
            if not result.ok:
                payload = AskResponse(
                    question=req.question, sql=llm.sql, safety_status="rejected",
                    reason=result.reason,
                    answer=f"The proposed query was rejected before execution: {result.reason}",
                    cost_usd=llm.cost_usd, latency_s=llm.latency_s,
                ).model_dump()
                yield _sse("answer", payload)
                return

            payload = AskResponse(
                question=req.question, sql=result.sql, safety_status="validated",
                columns=result.columns, rows=result.rows, row_count=result.row_count,
                answer=ground_narrative(req.question, result),
                cost_usd=llm.cost_usd, latency_s=llm.latency_s,
            ).model_dump()
            yield _sse("answer", payload)
        except Exception as exc:  # noqa: BLE001 - never let the stream die silently
            logger.exception("ask_stream failed at stage=%s", stage)
            yield _sse("error", {"stage": stage, "message": str(exc)})

    return StreamingResponse(gen(), media_type="text/event-stream")
