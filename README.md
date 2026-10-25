# IT-AI-Copilot — Week 2

A minimal Python ML backend that classifies IT helpdesk tickets into **network**, **account_access**, **hardware**, or **software**. No frontend or paid AI API required.

## Architecture

- **Data:** 120 labeled synthetic tickets in `data/tickets_v2.csv` with 40 incident families (30 per class).
- **Training:** Scikit-learn TF-IDF word and bigram features with balanced logistic regression.
- **Evaluation:** Group-aware 75/25 split, deterministic seed 42; accuracy, macro-F1, per-class report and confusion matrix.
- **Serving:** FastAPI with model loaded once at startup; Docker image trains the model at build time.
- **CI:** GitHub Actions lint, tests, training smoke test and Docker build.

> This synthetic dataset deliberately contains templated variants of the same issue. Held-out metrics may be optimistic because related variants can appear in both train and test. Do not claim production accuracy. For real-world evaluation, collect permissioned, de-identified tickets and split by incident family or time.

## Windows PowerShell — exact setup

Install Python 3.12 and Git. Clone the default branch after the PR is merged (while reviewing, switch to `feature/week2-ml-quality`):

```powershell
git clone https://github.com/yankeeDamn/IT-AI-Copilot.git
cd IT-AI-Copilot
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe scripts/{train,evaluate,validate_data}.py
.\.venv\Scripts\python.exe -m uvicorn it_ai_copilot.api:app --reload
```

Open http://127.0.0.1:8000/docs and use the interactive API. A trained artifact must exist before API startup.

## Test a prediction

In a second PowerShell window:

```powershell
$body = @{ text = "My VPN connection keeps dropping" } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8000/v1/predict -Method Post -ContentType "application/json" -Body $body
Invoke-RestMethod http://127.0.0.1:8000/health/live
Invoke-RestMethod http://127.0.0.1:8000/health/ready
```

The response includes `label`, `confidence`, `scores`, `needs_review` and `model_version`. The heuristic review flag is set for top-class score below 0.65. Scores are **not calibrated** and are not reliable probabilities. Do not automate high-impact actions from them.

## Docker

With Docker Desktop running:

```powershell
docker build -t it-ai-copilot:week1 .
docker run --rm -p 8000:8000 it-ai-copilot:week1
```

Visit http://localhost:8000/docs. The image runs as a non-root user and includes a health check.

## Repository

```text
.github/workflows/ci.yml
data/tickets.csv
scripts/train.py
src/it_ai_copilot/{__init__,model,api,evaluation}.py
tests/{test_api,test_model,test_evaluation}.py
Dockerfile
pyproject.toml
.env.example
.gitignore
.dockerignore
```

## API routes

- `GET /health/live`: process liveness
- `GET /health/ready`: model readiness (startup fails if model missing)
- `POST /v1/predict`: JSON `{"text":"VPN disconnects at home"}`

## Security and deployment notes

Never load untrusted `.joblib` files: joblib uses pickle and can execute code when deserializing. This starter API has **no authentication, rate limiting, or production-grade observability**; keep it private until those are added. Do not submit real employee data to the demo without proper authorization and redaction. For Azure, build and test the container locally before deploying to Azure Container Apps with a controlled budget.

## Next milestone

Improve the dataset and evaluation to avoid near-duplicate leakage, add an authenticated API, model versioning and monitoring, then deploy a private Azure Container App.

## Week 2 evaluation

Run `python scripts/validate_data.py` and `python scripts/evaluate.py`. The report `artifacts/evaluation_v2.json` contains the family-disjoint split, model comparison, per-class metrics, confusion matrices, model version, timestamp and SHA256 digests. CI uploads this report as a short-lived artifact. The deployed model remains logistic regression for API compatibility; Linear SVM is evaluated only. These synthetic data results do not establish production quality. Real-world datasets and calibrated confidence require separate work.
