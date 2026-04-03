from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from backend.inference import predict_action_hybrid
except ModuleNotFoundError:
    from inference import predict_action_hybrid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    state: list[float]
    trade_available: bool = False
    property_buy_available: bool = False


@app.get("/")
def root():
    return {"status": "ok", "message": "FastAPI backend is running"}


@app.get("/test")
def test_endpoint():
    return {"message": "Backend working"}


@app.post("/predict")
def predict(payload: PredictRequest):
    try:
        print(
            "[BACKEND] /predict payload:",
            {
                "state_len": len(payload.state or []),
                "trade_available": payload.trade_available,
                "property_buy_available": payload.property_buy_available,
                "state_head": (payload.state or [])[:10],
            },
            flush=True,
        )

        if not payload.state or len(payload.state) != 240:
            raise ValueError(f"State must be 240-dim vector. Got {len(payload.state or [])}")

        result = predict_action_hybrid(
            state=payload.state,
            trade_available=payload.trade_available,
            property_buy_available=payload.property_buy_available,
        )

        if not isinstance(result.get("action"), int) or result["action"] < 0:
            raise ValueError(f"Model returned invalid action: {result.get('action')}")

        print("[BACKEND] /predict result:", result, flush=True)

        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] /predict: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(exc)}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
