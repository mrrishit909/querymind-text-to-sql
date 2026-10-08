"""QUERYMIND API: question -> LLM-proposed SQL -> AST-validated -> executed
read-only -> grounded answer."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from llm_sql import generate_sql, has_api_key
from query_executor import execute_validated_sql, ground_narrative

app = FastAPI(title="QUERYMIND - Secure Text-to-SQL API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


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
def ask(req: AskRequest):
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
