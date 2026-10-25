"""Small local retrieval baseline. No embeddings service required."""
from __future__ import annotations

from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def search_knowledge(query: str, root: Path, limit: int = 3) -> list[dict]:
    files = sorted(root.glob("*.md"))[:200] if root.is_dir() else []
    documents = [(p.name, p.read_text(encoding="utf-8")[:12000]) for p in files]
    if not documents or not query.strip():
        return []
    vectorizer = TfidfVectorizer(stop_words="english")
    matrix = vectorizer.fit_transform([body for _, body in documents] + [query])
    scores = cosine_similarity(matrix[-1], matrix[:-1]).ravel()
    matches = sorted(enumerate(scores), key=lambda item: item[1], reverse=True)
    return [
        {"source": documents[i][0], "excerpt": documents[i][1][:1200], "score": round(float(score), 4)}
        for i, score in matches[:limit] if score > 0.01
    ]
