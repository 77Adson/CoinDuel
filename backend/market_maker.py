import pandas as pd
import random
import os
from datetime import datetime

# Ustawienia
DATA_FOLDER = 'data'
GAME_DURATION_TICKS = 120  # Np. gra trwa 120 świeczek (jeśli świeczka = 1h, to 5 dni z rynku)

def get_daily_scenario():
    """
    Zwraca obiekt z danymi historycznymi wylosowanymi na podstawie DZISIEJSZEJ DATY.
    """
    # 1. Ustawiamy Seed na podstawie daty (np. '2023-10-27')
    today_str = datetime.now().strftime('%Y-%m-%d')
    random.seed(today_str)
    
    # 2. Szukamy plików CSV
    if not os.path.exists(DATA_FOLDER):
        os.makedirs(DATA_FOLDER)
        return None # Zwracamy None jeśli brak folderu/plików

    available_files = [f for f in os.listdir(DATA_FOLDER) if f.endswith('.csv')]
    if not available_files:
        return None

    # 3. Losujemy asset i moment startu
    chosen_file = random.choice(available_files)
    file_path = os.path.join(DATA_FOLDER, chosen_file)
    
    # Czytamy CSV (Zakładamy kolumny: Date, Open, High, Low, Close)
    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        print(f"Błąd odczytu pliku: {e}")
        return None

    if len(df) < GAME_DURATION_TICKS:
        print("Plik CSV jest za krótki!")
        return None

    # Losujemy indeks startowy (zabezpieczamy, żeby nie wyjść poza zakres)
    max_start = len(df) - GAME_DURATION_TICKS - 1
    start_index = random.randint(0, max_start)
    
    # Wycinamy fragment
    game_data = df.iloc[start_index : start_index + GAME_DURATION_TICKS]
    
    # Resetujemy random, żeby nie psuć losowości w innych miejscach appki
    random.seed()

    return {
        'asset': chosen_file.replace('.csv', '').upper(),
        'date': today_str,
        'data': game_data.to_dict('records') # Lista słowników
    }