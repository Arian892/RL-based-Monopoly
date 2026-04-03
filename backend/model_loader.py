from pathlib import Path
import sys

import torch
import torch.nn as nn
import torch.nn.functional as F


ROOT_DIR = Path(__file__).resolve().parents[1]
MONOPOLY_RL_DIR = ROOT_DIR / "Monopoly_RL"
if str(MONOPOLY_RL_DIR) not in sys.path:
    sys.path.append(str(MONOPOLY_RL_DIR))

from monopoly_drl.networks import ActorNetwork, DDQNNetwork


class ModelLoadError(Exception):
    pass


class LegacyActorNetwork(nn.Module):
    def __init__(self, actor_state_dict: dict):
        super().__init__()
        layer_indices = sorted(
            {
                int(key.split(".")[1])
                for key in actor_state_dict.keys()
                if key.startswith("net.") and key.endswith(".weight")
            }
        )
        if not layer_indices:
            raise ModelLoadError("Legacy actor state_dict has no linear layers")

        modules = []
        for i, layer_idx in enumerate(layer_indices):
            weight = actor_state_dict[f"net.{layer_idx}.weight"]
            out_features, in_features = weight.shape
            modules.append(nn.Linear(in_features, out_features))
            if i < len(layer_indices) - 1:
                modules.append(nn.ReLU())

        self.net = nn.Sequential(*modules)

    def forward(self, state: torch.Tensor, mask: torch.Tensor = None) -> torch.Tensor:
        logits = self.net(state)
        if mask is not None:
            logits = logits.masked_fill(~mask, float("-inf"))
        return F.log_softmax(logits, dim=-1)


def _resolve_model_path(model_path: str) -> Path:
    p = Path(model_path)
    if p.is_absolute() and p.exists():
        return p

    candidates = [
        ROOT_DIR / model_path,
        MONOPOLY_RL_DIR / model_path,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    raise ModelLoadError(f"Model file not found: {model_path}")


def load_model(model_path: str, algo: str = "ppo", hidden_dim: int = 256):
    algo = algo.lower()
    resolved_path = _resolve_model_path(model_path)
    checkpoint = torch.load(resolved_path, map_location="cpu")

    if algo == "ppo":
        if "actor" not in checkpoint:
            raise ModelLoadError("Invalid PPO checkpoint: missing 'actor' key")
        actor_state = checkpoint["actor"]

        try:
            model = ActorNetwork(hidden_dim=hidden_dim)
            model.load_state_dict(actor_state)
        except RuntimeError:
            model = LegacyActorNetwork(actor_state)
            model.load_state_dict(actor_state)

        model.eval()
        return model

    if algo == "ddqn":
        if "online" not in checkpoint:
            raise ModelLoadError("Invalid DDQN checkpoint: missing 'online' key")
        model = DDQNNetwork(hidden_dim=hidden_dim)
        model.load_state_dict(checkpoint["online"])
        model.eval()
        return model

    raise ModelLoadError(f"Unsupported algo: {algo}. Use 'ppo' or 'ddqn'.")


if __name__ == "__main__":
    loaded_model = load_model("hy_model.pt", algo="ppo")
    print(f"Model loaded successfully: {loaded_model.__class__.__name__}")
