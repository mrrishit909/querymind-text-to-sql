FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Only the files the API actually imports - not venv/, web/node_modules,
# tests/, or a local .env (the real .env, if one exists on the host, must
# never end up baked into the image).
COPY api.py llm_sql.py query_executor.py sql_validator.py ./
COPY db/ db/

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
