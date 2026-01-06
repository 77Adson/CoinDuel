# market_maker.py
import pandas as pd
import random
import os
from datetime import datetime

DATA_FOLDER = 'data'

def get_daily_scenario():
    today_str = datetime.now().strftime('%Y-%m-%d')
    random.seed(today_str)

    available_files = [f for f in os.listdir(DATA_FOLDER) if f.endswith('.csv')]
    if not available_files:
        return None

    file_path = os.path.join(DATA_FOLDER, random.choice(available_files))
    df = pd.read_csv(file_path)

    # Normalizacja kolumn
    df = df.rename(columns={
        'Date': 'time',
        'Open': 'open',
        'High': 'high',
        'Low': 'low',
        'Close': 'close'
    })

    # Konwersja czasu (Lightweight Charts!)
    df['time'] = pd.to_datetime(df['time']).astype(int) // 10**9

    random.seed()

    return df.to_dict('records')
