# test_action.py
from monopoly_drl.actions import action_to_description, ACTION_SPACE_SIZE
import random

# Test a specific index
print(action_to_description(131))
print(action_to_description(2))
print(action_to_description(5))
print(action_to_description(50))
print(action_to_description(240))

# Test a few random ones
for _ in range(5):
    idx = random.randint(0, ACTION_SPACE_SIZE - 1)
    print(f"  {idx:4d} → {action_to_description(idx)}")