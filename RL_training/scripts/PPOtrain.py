# train_ppo.py
import gym
from stable_baselines3 import PPO

def main():
    # Example: train on CartPole. Replace with your custom environment if you have one in Python.
    env = gym.make("CartPole-v1")

    # Create the model
    model = PPO("MlpPolicy", env, verbose=1)

    # Train the model
    model.learn(total_timesteps=10000)

    # Save the trained model
    model.save("ppo_cartpole")

    # If you want to load it later:
    # model = PPO.load("ppo_cartpole", env=env)

    print("Training complete and model saved.")

if __name__ == "__main__":
    main()
