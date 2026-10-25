FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DATABASE_URL=sqlite:////app/runtime/copilot.db
WORKDIR /app
COPY pyproject.toml README.md ./
COPY src/ ./src/
RUN pip install --no-cache-dir . && useradd --create-home appuser
COPY data/ ./data/
COPY knowledge/ ./knowledge/
COPY scripts/ ./scripts/
COPY migrations/ ./migrations/
COPY alembic.ini ./alembic.ini
RUN python scripts/train.py && mkdir -p /app/runtime && chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/ready',timeout=2)" || exit 1
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn it_ai_copilot.api:app --host 0.0.0.0 --port 8000 --workers 1"]
