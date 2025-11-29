from fastapi import APIRouter

test_router = APIRouter()

@test_router.get("/test-reload")
async def test_reload():
    return {"message": "This is a test endpoint to verify code reloading - VERSION 2"}
