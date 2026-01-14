from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS
from market_maker import get_daily_scenario

app = Flask(__name__)
CORS(app)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading"
)

# --- KONFIGURACJA GRY ---
INITIAL_VISIBLE_CANDLES = 50
GAME_SPEED = 0.5
STARTING_BALANCE = 10_000

# --- STAN GRY (GLOBALNY - Sprint 2 MVP) ---
market_data = []
current_index = 0
is_running = False

cash_balance = STARTING_BALANCE     # kasa dostępna
btc_amount = 0.0                   # ilość BTC (ułamki)
invested_cash = 0.0                # ile realnie włożyliśmy w BTC


# ---------- FUNKCJA POMOCNICZA ----------
def emit_game_state(price):
    btc_value = btc_amount * price
    portfolio_value = cash_balance + btc_value

    if invested_cash > 0:
        pnl_percent = ((btc_value - invested_cash) / invested_cash) * 100
    else:
        pnl_percent = 0.0

    socketio.emit("game_state", {
        "cash": round(cash_balance, 2),
        "btc_amount": round(btc_amount, 6),
        "btc_value": round(btc_value, 2),
        "portfolio_value": round(portfolio_value, 2),
        "pnl_percent": round(pnl_percent, 2),
        "price": price
    })


# ---------- SOCKET EVENTS ----------

@socketio.on("connect")
def on_connect():
    global market_data, current_index, is_running
    global cash_balance, btc_amount, invested_cash

    print("Client connected")

    # Reset stanu gracza (Sprint 2 = single player)
    cash_balance = STARTING_BALANCE
    btc_amount = 0.0
    invested_cash = 0.0

    # Ładujemy dzisiejszy scenariusz (daily seed)
    if not market_data:
        market_data = get_daily_scenario()
        if not market_data:
            print("Błąd: brak danych rynkowych")
            return

        print(f"Loaded scenario: {len(market_data)} candles")
        current_index = INITIAL_VISIBLE_CANDLES

    # 1. Historia do wykresu
    socketio.emit("history", market_data[:INITIAL_VISIBLE_CANDLES])

    # 2. Stan gry na start
    emit_game_state(market_data[current_index - 1]["close"])

    # 3. Start streamu czasu
    if not is_running:
        is_running = True
        socketio.start_background_task(stream_market)
        print("Market stream started")


def stream_market():
    global current_index, is_running

    while True:
        if current_index >= len(market_data):
            final_price = market_data[-1]["close"]
            final_value = cash_balance + btc_amount * final_price

            socketio.emit("game_over", {
                "final_value": round(final_value, 2),
                "pnl_percent": round(
                    ((final_value - STARTING_BALANCE) / STARTING_BALANCE) * 100, 2
                )
            })

            is_running = False
            print("Game over")
            break

        candle = market_data[current_index]

        # 1. Nowa świeczka
        socketio.emit("candle", candle)

        # 2. Aktualizacja portfela
        emit_game_state(candle["close"])

        current_index += 1
        socketio.sleep(GAME_SPEED)


@socketio.on("trade")
def handle_trade(data):
    global cash_balance, btc_amount, invested_cash

    action = data.get("action")          # BUY / SELL
    amount = float(data.get("amount", 0))  # kwota gotówki

    if amount <= 0 or current_index == 0:
        return

    price = market_data[current_index - 1]["close"]

    if action == "BUY":
        if cash_balance >= amount:
            btc_bought = amount / price
            cash_balance -= amount
            btc_amount += btc_bought
            invested_cash += amount

    elif action == "SELL":
        btc_to_sell = amount / price
        if btc_amount >= btc_to_sell and invested_cash > 0:
            sell_ratio = btc_to_sell / btc_amount
            invested_cash -= invested_cash * sell_ratio

            btc_amount -= btc_to_sell
            cash_balance += amount

    emit_game_state(price)


# ---------- START SERWERA ----------
if __name__ == "__main__":
    socketio.run(
        app,
        port=5000,
        debug=True,
        allow_unsafe_werkzeug=True
    )
