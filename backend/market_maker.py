# market_maker.py
import pandas as pd
import os
import random
from datetime import datetime

DATA_FOLDER = './data'
GAME_LENGTH = 300  # ile świeczek trwa jedna gra

def get_daily_scenario():
    # 1. DAILY SEED
    today = datetime.now().strftime('%Y-%m-%d')
    random.seed(today)

    file_path = os.path.join(DATA_FOLDER, 'BTC_1h.csv')
    if not os.path.exists(file_path):
        return None

    df = pd.read_csv(file_path)

    df = df.rename(columns={
        'Datetime': 'time',
        'Open': 'open',
        'High': 'high',
        'Low': 'low',
        'Close': 'close'
    })

    df['time'] = pd.to_datetime(df['time']).astype(int) // 10**9

    # 2. LOSUJEMY START (ale deterministycznie)
    max_start = len(df) - GAME_LENGTH
    start_index = random.randint(0, max_start)

    scenario = df.iloc[start_index:start_index + GAME_LENGTH]

    random.seed()  # reset

    return scenario.to_dict('records')
