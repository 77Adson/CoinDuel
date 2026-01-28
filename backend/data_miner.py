import yfinance as yf
import os

# --- KONFIGURACJA ---
ASSETS = {
    "BTC": "BTC-USD",
    "ETH": "ETH-USD",
    "SOL": "SOL-USD",
    "XRP": "XRP-USD",
    "LINK": "LINK-USD",
    "LTC": "LTC-USD",
    "ATOM": "ATOM-USD",
    "BCH": "BCH-USD",
    "TRX": "TRX-USD",
    "EOS": "EOS-USD"
}

INTERVAL = "1h"
PERIOD = "2y"
DATA_FOLDER = "./data"


def download_data():
    if not os.path.exists(DATA_FOLDER):
        os.makedirs(DATA_FOLDER)
        print(f"[INIT] Utworzono folder: {DATA_FOLDER}")

    print(f"[START] Pobieranie danych | okres={PERIOD}, interwał={INTERVAL}\n")

    for name, symbol in ASSETS.items():
        print(f"[FETCH] {name} ({symbol}) ...")

        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=PERIOD, interval=INTERVAL)

            if df.empty:
                print(f"  [!] Brak danych dla {name}")
                continue

            df.reset_index(inplace=True)
            df = df[["Datetime", "Open", "High", "Low", "Close", "Volume"]]

            filename = f"{name}_{INTERVAL}.csv"
            path = os.path.join(DATA_FOLDER, filename)
            df.to_csv(path, index=False)

            print(f"  [OK] {filename} | świeczek: {len(df)}")

        except Exception as e:
            print(f"  [ERROR] {name}: {e}")

    print("\n[DONE] Data miner zakończył pobieranie danych.")


if __name__ == "__main__":
    download_data()