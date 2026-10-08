"""Calls Claude to propose ONE SQL statement from the narrow approved-views
schema catalog, as structured JSON. This module makes the only LLM call in
the app; sql_validator.py never trusts anything it returns."""
from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass

import anthropic

from db.connection import schema_catalog

MODEL = "claude-sonnet-5-5"

SYSTEM_PROMPT = f"""You translate a business question into exactly ONE read-only SQL query
against this SQLite schema. You may ONLY reference the views listed below - never any other
table or view name, even if you believe it would exist in a normal e-commerce database.

{schema_catalog()}

Rules:
- Output a single SELECT or WITH...SELECT statement. Never INSERT/UPDATE/DELETE/DROP/ALTER/
  PRAGMA/ATTACH or anything else that writes or inspects the database itself.
- Never use load_extension, readfile, writefile, or any file/extension function.
- If the question cannot be answered from the views above, set "sql" to null and explain why
  in "assumptions" instead of inventing a table.
- Respond with ONLY a JSON object, no markdown fences, matching exactly:
  {{"sql": "<the SQL, or null>", "assumptions": "<1-2 sentences>", "referenced_views": ["..."]}}
"""


@dataclass
class LLMResult:
    sql: str | None
    assumptions: str
    referenced_views: list[str]
    input_tokens: int
    output_tokens: int
    cost_usd: float
    latency_s: float
    raw_text: str


# Sonnet 5.5 pricing per the claude-api skill's cached rate card (2026-10):
# $2.00 / 1M input tokens, $10.00 / 1M output tokens.
_PRICE_IN_PER_TOKEN = 2.00 / 1_000_000
_PRICE_OUT_PER_TOKEN = 10.00 / 1_000_000


def generate_sql(question: str) -> LLMResult:
    client = anthropic.Anthropic()
    start = time.monotonic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": question}],
    )
    latency = time.monotonic() - start

    text = "".join(b.text for b in response.content if b.type == "text")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = {"sql": None, "assumptions": f"model did not return valid JSON: {text[:200]}", "referenced_views": []}

    cost = (
        response.usage.input_tokens * _PRICE_IN_PER_TOKEN
        + response.usage.output_tokens * _PRICE_OUT_PER_TOKEN
    )

    return LLMResult(
        sql=parsed.get("sql"),
        assumptions=parsed.get("assumptions", ""),
        referenced_views=parsed.get("referenced_views", []),
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        cost_usd=cost,
        latency_s=latency,
        raw_text=text,
    )


def has_api_key() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))
