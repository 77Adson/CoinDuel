# market_maker.py
import pandas as pd
import os
import random
from datetime import datetime

DATA_FOLDER = "data"
GAME_LENGTH = 200

AVAILABLE_COINS = ["BTC", "ETH", "SOL", "XRP", "LINK"]

def load_all_markets():
    markets = {}

    seed = datetime.now().strftime("%d-%m-%Y")
    random.seed(seed)

    for coin in AVAILABLE_COINS:
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

        df["time"] = (
            pd.to_datetime(df["time"], utc=True)
              .astype("int64") // 10**9
        )

        # 🔒 KLUCZOWA WALIDACJA
        if len(df) < GAME_LENGTH:
            print(f"[SKIP] {coin}: za mało danych ({len(df)} świeczek)")
            continue

        max_start = len(df) - GAME_LENGTH
        start = random.randint(0, max_start)

        markets[coin] = df.iloc[start:start + GAME_LENGTH].to_dict("records")

    random.seed()
    return markets
