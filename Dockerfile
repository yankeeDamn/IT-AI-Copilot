FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml README.md ./
COPY src/ ./src/
RUN pip install --no-cache-dir . && useradd --create-home appuser
COPY data/ ./data/
COPY scripts/ ./scripts/
RUN python scripts/train.py && chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/ready',timeout=2)" || exit 1
CMD ["uvicorn", "it_ai_copilot.api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
