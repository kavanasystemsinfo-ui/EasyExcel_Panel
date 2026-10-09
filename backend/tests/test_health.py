from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "easyexcel-backend"
    assert body["version"] == "0.1.0"


def test_unknown_route_is_404() -> None:
    response = client.get("/no-existe")
    assert response.status_code == 404
