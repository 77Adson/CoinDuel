import yfinance as yf
import os

# Konfiguracja
ASSETS = {
    "BTC": "BTC-USD",
    "ETH": "ETH-USD",
    "SOL": "SOL-USD",
    "XRP": "XRP-USD",
    "LINK": "LINK-USD"
}


INTERVAL = '1h'   # Świeczki godzinowe (idealne do gry Turbo)
PERIOD = '2y'     # Ostatnie 2 lata historii
DATA_FOLDER = './data'

def download_data():
    if not os.path.exists(DATA_FOLDER):
        os.makedirs(DATA_FOLDER)
        print(f"Utworzono folder: {DATA_FOLDER}")

    print(f"Rozpoczynam pobieranie danych ({PERIOD}, interwał: {INTERVAL})...")

    for symbol in ASSETS:
        print(f" Pobieranie: {symbol}...")
        
        # Magia yfinance - pobieramy historię
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=PERIOD, interval=INTERVAL)
        
        if df.empty:
            print(f" [!] Błąd: Brak danych dla {symbol}")
            continue

        # Formatowanie danych pod naszą grę
        # Resetujemy index, żeby Data była kolumną, a nie indeksem
        df.reset_index(inplace=True)
        
        # Wybieramy tylko potrzebne kolumny i zmieniamy nazwy na prostsze
        # Yahoo zwraca: Datetime, Open, High, Low, Close, Volume...
        df = df[['Datetime', 'Open', 'High', 'Low', 'Close', 'Volume']]
        
        # Zapisujemy do CSV
        filename = f"{symbol.replace('-USD', '')}_{INTERVAL}.csv"
        filepath = os.path.join(DATA_FOLDER, filename)
        
        df.to_csv(filepath, index=False)
        print(f" [OK] Zapisano: {filepath} ({len(df)} świeczek)")

    print("\nGotowe! Twoja baza danych historycznych jest pełna.")

if __name__ == "__main__":
    download_data()