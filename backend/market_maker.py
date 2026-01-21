import pandas as pd
import os
import random
from datetime import datetime

DATA_FOLDER = "data"
GAME_LENGTH = 300

COIN_POOL = ["BTC", "ETH", "SOL", "XRP", "LINK"]

def get_daily_scenario():
    seed = datetime.now().strftime("%d-%m-%Y")
    random.seed(seed)

    selected_coins = random.sample(COIN_POOL, 3)
    scenarios = {}

    for coin in selected_coins:
        path = os.path.join(DATA_FOLDER, f"{coin}_1h.csv")
        if not os.path.exists(path):
            continue

        df = pd.read_csv(path)

        df = df.rename(columns={
            "Datetime": "time",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close"
        })

        df["time"] = pd.to_datetime(df["time"], utc=True).view("int64") // 10**9

        max_start = len(df) - GAME_LENGTH
        start = random.randint(0, max_start)

        scenarios[coin] = df.iloc[start:start + GAME_LENGTH].to_dict("records")

    random.seed()
    return scenarios
