import numpy as np
import torch

try:
    from backend.model_loader import load_model
except ModuleNotFoundError:
    from model_loader import load_model
from monopoly_drl.constants import PROPERTIES
from monopoly_drl.actions import ActionType


MODEL_ALGO = "ppo"
MODEL_PATH = "hy_model.pt"


print(f"[BACKEND] Loading model: {MODEL_PATH} ({MODEL_ALGO})", flush=True)
_model = load_model(MODEL_PATH, algo=MODEL_ALGO)
print(f"[BACKEND] Model loaded: {type(_model).__name__}", flush=True)


def predict_action(state):
    state_array = np.asarray(state, dtype=np.float32)

    print(
        "[BACKEND] predict_action input:",
        {"shape": state_array.shape, "head": state_array[:10].tolist()},
        flush=True,
    )

    if state_array.shape != (240,):
        raise ValueError(f"State must be a 240-dim vector. Got shape: {state_array.shape}")

    if not np.all(np.isfinite(state_array)):
        raise ValueError(f"State contains NaN/Inf values")

    state_tensor = torch.from_numpy(state_array).unsqueeze(0)

    try:
        with torch.no_grad():
            output = _model(state_tensor)

        if not torch.all(torch.isfinite(output)):
            raise ValueError(f"Model output contains NaN/Inf")

        action = int(torch.argmax(output, dim=-1).item())

        print(
            "[BACKEND] model logits -> action:",
            {"action": action, "output_shape": tuple(output.shape)},
            flush=True,
        )

        if action < 0 or action >= 2922:
            raise ValueError(f"Model returned out-of-range action: {action}")

        return action
    except Exception as e:
        print(f"[ERROR] Model inference failed: {str(e)}")
        raise


def _property_value(cell_id: int) -> float:
    return float(PROPERTIES.get(int(cell_id), {}).get("price", 0))


def _evaluate_trade_offer(trade_offer: dict | None) -> int:
    if not trade_offer:
        return int(ActionType.DECLINE_TRADE)

    give_props = trade_offer.get("giveProperties", []) or []
    take_props = trade_offer.get("takeProperties", []) or []
    give_money = float(trade_offer.get("giveMoney", 0) or 0)
    take_money = float(trade_offer.get("takeMoney", 0) or 0)

    value_to_ai = sum(_property_value(pid) for pid in give_props) + give_money
    value_from_ai = sum(_property_value(pid) for pid in take_props) + take_money

    # Small acceptance bias so AI doesn't reject every fair trade.
    accept = value_to_ai >= (value_from_ai * 0.95)
    return int(ActionType.ACCEPT_TRADE if accept else ActionType.DECLINE_TRADE)


def predict_action_hybrid(
    state,
    trade_available: bool = False,
    property_buy_available: bool = False,
    trade_offer: dict | None = None,
):
    decision_source = "model"

    print(
        "[BACKEND] predict_action_hybrid flags:",
        {
            "trade_available": trade_available,
            "property_buy_available": property_buy_available,
            "trade_offer": trade_offer,
        },
        flush=True,
    )

    if trade_available:
        action = _evaluate_trade_offer(trade_offer)
        decision_source = "rule_trade_offer"
        print("[BACKEND] hybrid branch: trade_offer ->", action, flush=True)
        return {
            "action": action,
            "decision_source": decision_source,
            "model_algo": MODEL_ALGO,
            "model_path": MODEL_PATH,
        }

    if property_buy_available:
        action = int(ActionType.BUY_PROPERTY)
        decision_source = "rule_buy_property"
        print("[BACKEND] hybrid branch: buy property ->", action, flush=True)
        return {
            "action": action,
            "decision_source": decision_source,
            "model_algo": MODEL_ALGO,
            "model_path": MODEL_PATH,
        }

    action = predict_action(state)
    print("[BACKEND] hybrid branch: model ->", action, flush=True)
    return {
        "action": action,
        "decision_source": decision_source,
        "model_algo": MODEL_ALGO,
        "model_path": MODEL_PATH,
    }


if __name__ == "__main__":
    dummy_state = np.zeros(240, dtype=np.float32)
    predicted_action = predict_action(dummy_state)
    print(f"Predicted action: {predicted_action}")
