import asyncio
import json
import numpy as np
import websockets

from stable_baselines3 import PPO
from stable_baselines3.common.logger import configure
from gymnasium import Env, spaces

###############################################################################
# 1) "Memory Replay" Env for On-Policy Steps
###############################################################################
class OnPolicyMemoryEnv(Env):
    """
    This environment replays transitions from the front-end so that
    Stable Baselines3 can call `env.step()`. We feed it transitions
    in an "on-policy" fashion after each episode.

    Mechanism:
      - At the start of training, we load the entire list of transitions
        from the just-finished episode into `self.episode_transitions`.
      - `env.reset()` sets an index=0, and returns the first obs.
      - `env.step(action)` ignores the passed-in action, and *instead*
        uses the stored transitions (obs, action, reward, done, next_obs).

      This is a hack to make PPO's rollout collection actually read from
      the front-end data. It's not ideal, but works for demonstration.

    Because PPO is on-policy, we only load transitions from the *latest*
    policy. After training, we discard them (or else we'd be mixing older
    policy data with a newer policy).
    """

    def __init__(self):
        super().__init__()
        # Observations: (x, y, speed, angle)
        self.observation_space = spaces.Box(
            low=-1e9, high=1e9, shape=(4,), dtype=np.float32
        )
        # Discrete(4) actions: forward, left, right, brake
        self.action_space = spaces.Discrete(4)

        self.episode_transitions = []  # (obs, act, rew, done, next_obs)
        self.current_index = 0

    def load_episode(self, transitions):
        """
        Provide a list of transitions from the front-end for a single episode:
          transitions = [ (obs, act, reward, done, next_obs), ... ]
        We store them internally and reset the pointer.
        """
        self.episode_transitions = transitions
        self.current_index = 0

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.current_index = 0

        if len(self.episode_transitions) == 0:
            # No data => return a dummy obs
            return np.zeros(4, dtype=np.float32), {}

        # The first obs in the episode
        first_obs = self.episode_transitions[0][0]
        return first_obs, {}

    def step(self, action):
        """
        Returns the next transition from self.episode_transitions,
        ignoring the 'action' argument because the front-end already
        took the real action. We just replay the stored transition.
        """
        if self.current_index >= len(self.episode_transitions):
            # No more transitions => end episode
            return np.zeros(4, dtype=np.float32), 0.0, True, False, {}

        # We retrieve the 'true' action, reward, done from the stored transition
        obs, true_act, reward, done, next_obs = self.episode_transitions[self.current_index]
        self.current_index += 1

        return next_obs, reward, done, False, {}


###############################################################################
# 2) Instantiate PPO with this "Memory" Env
###############################################################################
memory_env = OnPolicyMemoryEnv()
model = PPO("MlpPolicy", memory_env, verbose=1)

# Optional logger
log_path = "./logs"
logger = configure(log_path, ["stdout", "csv", "tensorboard"])
model.set_logger(logger)


###############################################################################
# 3) Global Buffers for Current Episode
###############################################################################
current_episode = []  # We'll store transitions for *one* episode
# Each transition: (obs, action, reward, done, next_obs)

last_obs = None
last_action = None


###############################################################################
# 4) WebSocket Handler
###############################################################################
async def handle_client(websocket):
    global last_obs, last_action, current_episode

    print("Client connected.")

    async for message in websocket:
        data = json.loads(message)

        if data.get("type") == "step":
            # 1) Parse the incoming data from front-end
            obs_dict = data["observation"]  # {x, y, speed, angle}
            print(obs_dict)
            reward = float(data["reward"])
            done = bool(data["done"])

            # Convert to 4D float array
            new_obs = np.array([obs_dict["x"], obs_dict["y"],
                                obs_dict["speed"], obs_dict["angle"]],
                               dtype=np.float32)

            # 2) If we have a last_obs & last_action, store the transition
            if last_obs is not None and last_action is not None:
                # We'll store the transition as (obs, act, reward, done, next_obs)
                current_episode.append(
                    (last_obs, last_action, reward, done, new_obs)
                )

            # 3) Predict next action from our current PPO model
            action, _states = model.predict(new_obs, deterministic=False)

            # 4) Send that action back to the front-end
            response = {"action": int(action)}
            await websocket.send(json.dumps(response))

            # Save these as the "last" for the next iteration
            last_obs = new_obs
            last_action = action

            # 5) If the episode is done => train on these transitions
            if done:
                print(f"\nEpisode finished. We collected {len(current_episode)} steps.")
                if len(current_episode) > 0:
                    # Load these transitions into the memory_env
                    memory_env.load_episode(current_episode)

                    # Let PPO do a short training run
                    print("Running PPO.learn() on the collected transitions...")
                    model.learn(
                        total_timesteps=2048,   # or however many you want
                        reset_num_timesteps=False
                    )

                # Clear the buffer for the next episode
                current_episode = []
                last_obs = None
                last_action = None

        else:
            print(f"Unknown message type: {data.get('type')}")


###############################################################################
# 5) Main Entry: Start Server
###############################################################################
async def main():
    print("WebSocket server starting on ws://localhost:8080...")
    async with websockets.serve(handle_client, "localhost", 8080):
        await asyncio.Future()  # keep running

if __name__ == "__main__":
    asyncio.run(main())
