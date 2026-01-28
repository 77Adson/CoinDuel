import pandas as pd
import os
import random
from datetime import datetime

DATA_FOLDER = "data"
GAME_LENGTH = 250

def load_all_markets():
    seed = datetime.now().strftime("%d-%m-%Y")
    random.seed(seed)

    markets = {}

    for file in os.listdir(DATA_FOLDER):
        if not file.endswith("_1h.csv"):
            continue

        coin = file.replace("_1h.csv", "")
        df = pd.read_csv(os.path.join(DATA_FOLDER, file))

        if len(df) < GAME_LENGTH:
            continue

        df = df.rename(columns={
            "Datetime": "time",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close"
        })

        df["time"] = pd.to_datetime(df["time"], utc=True).astype("int64") // 10**9

        start = random.randint(0, len(df) - GAME_LENGTH)
        markets[coin] = df.iloc[start:start + GAME_LENGTH].to_dict("records")

    random.seed()
    return markets