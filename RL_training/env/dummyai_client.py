import asyncio
import json
import numpy as np
import websockets

# Stable Baselines3
from stable_baselines3 import PPO
from stable_baselines3.common.logger import configure
from stable_baselines3.common.env_checker import check_env

# Gymnasium (new Gym API)
import gymnasium as gym
from gymnasium import spaces


###############################################################################
# 1) Minimal Gymnasium Env: 4D obs => [x, y, speed, angle], Discrete(4) actions
###############################################################################
class DummyCarEnv(gym.Env):
    """
    A minimal environment to match the new Gymnasium API:
      - reset(seed=None, options=None) -> (obs, info)
      - step(action) -> (obs, reward, done, truncated, info)

    We never step this environment in a real loop;
    we just need it so PPO is initialized with correct shapes.
    """

    def __init__(self):
        super().__init__()
        # 4D observation: (x, y, speed, angle)
        self.observation_space = spaces.Box(low=-np.inf, high=np.inf, shape=(4,), dtype=np.float32)
        # Discrete actions: 0=forward,1=left,2=right,3=brake
        self.action_space = spaces.Discrete(4)

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)  # For seeding, if needed
        obs = np.zeros(4, dtype=np.float32)
        info = {}
        return obs, info

    def step(self, action):
        # We don't actually simulate anything; we just return dummy values.
        obs = np.zeros(4, dtype=np.float32)
        reward = 0.0
        done = True          # single-step episode
        truncated = False    # not truncated in this dummy example
        info = {}
        return obs, reward, done, truncated, info


###############################################################################
# 2) Create and check the env, then initialize PPO with it
###############################################################################
dummy_env = DummyCarEnv()
check_env(dummy_env)  # Will enforce the new Gymnasium-style methods
model = PPO(
    "MlpPolicy",
    dummy_env,
    n_steps=2048,        # 增加採樣步數
    batch_size=64,        # 調整批量大小
    gamma=0.99,           # 提高長期回報權重
    verbose=1,
    tensorboard_log="./tensorboard"
)

# Optional: Set up a logger to see training info (tensorboard, CSV, console)
log_path = "./logs"
logger = configure(log_path, ["stdout", "csv", "tensorboard"])
model.set_logger(logger)

# We'll keep a small buffer of transitions (hacky on-policy approach)
last_obs = None
last_action = None


###############################################################################
# 3) WebSocket handler: receives (obs, reward, done), returns an action
###############################################################################
async def handle_client(websocket):
    global last_obs, last_action

    print("Client connected.")

    async for message in websocket:
        data = json.loads(message)

        if data.get("type") == "step":
            # 1) Parse the incoming step data
            obs_dict = data["observation"]  # { "x":..., "y":..., "speed":..., "angle":... }
            reward = float(data["reward"])
            done = bool(data["done"])

            # Convert to 4D numpy array for PPO
            obs_array = np.array(
                [obs_dict["x"], obs_dict["y"], obs_dict["speed"], obs_dict["angle"]],
                dtype=np.float32
            )

            # 2) If we have a last_obs, store that transition in a naive way
            #    (In a real on-policy approach, you'd do a formal rollout buffer.)
            #    We'll just do partial "training" on dummy_env to demonstrate.
            if last_obs is not None:
                # (We are not storing them anywhere else in this minimal script,
                #  but you could store them in a list if you want offline analysis.)
                pass

            # 3) Predict an action from PPO
            #    model.predict expects shape (n_envs=1, obs_dim=4)
            action, _states = model.predict(obs_array, deterministic=False)

            # 4) Send that action back to the front-end
            response = {"action": int(action)}
            await websocket.send(json.dumps(response))

            # Save for next loop
            last_obs = obs_array
            last_action = action

            # 5) If done => run a short "learn" so we see training updates
            if done:
                print("Episode done. Running partial training update...")
                model.learn(total_timesteps=500, reset_num_timesteps=False)

                # Reset for next episode
                last_obs = None
                last_action = None

        elif data.get("type") == "car_info":
            # If in manual mode, maybe receiving real-time data
            car_info = data.get("data", {})
            print(f"Manual mode car info: {car_info}")

        else:
            print(f"Unknown message type: {data.get('type')}")


###############################################################################
# 4) Main entry: Start the WebSocket server
###############################################################################
async def main():
    print("Starting WebSocket server on ws://localhost:8080")
    async with websockets.serve(handle_client, "localhost", 8080):
        # Keep the server running
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
