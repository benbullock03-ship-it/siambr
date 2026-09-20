from fastapi import FastAPI

from backend.routes import domains, members, plenary, search, terms

app = FastAPI(title="Siambr API", version="0.1.0")
app.include_router(plenary.router)
app.include_router(members.router)
app.include_router(search.router)
app.include_router(domains.router)
app.include_router(terms.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
