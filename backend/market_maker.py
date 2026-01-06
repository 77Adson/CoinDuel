# market_maker.py
import pandas as pd
import os

DATA_FOLDER = 'data'

def get_daily_scenario():
    # Zgodnie z wymaganiami sprintu #1, używamy jednej, sztywnej ścieżki do pliku.
    hardcoded_file = 'dummy_data.csv'
    file_path = os.path.join(DATA_FOLDER, hardcoded_file)

    if not os.path.exists(file_path):
        print(f"BŁĄD: Nie znaleziono pliku: {file_path}")
        return None

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

    return df.to_dict('records')
