from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS
from market_maker import get_daily_scenario

app = Flask(__name__)
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# --- KONFIG ---
INITIAL_VISIBLE_CANDLES = 50
GAME_SPEED = 0.5
STARTING_BALANCE = 10_000

# --- STAN GRY ---
market_data = {}        # { "BTC": [...], "ETH": [...], "SOL": [...] }
current_index = 0
is_running = False

cash_balance = STARTING_BALANCE

portfolio = {}          # per coin


# ---------- HELPERS ----------

def init_portfolio(coins):
    global portfolio
    portfolio = {
        coin: {
            "amount": 0.0,
            "invested": 0.0
        } for coin in coins
    }


def emit_full_state(prices):
    coins_state = {}
    total_value = cash_balance

    for coin, state in portfolio.items():
        price = prices[coin]
        value = state["amount"] * price
        invested = state["invested"]

        pnl = ((value - invested) / invested * 100) if invested > 0 else 0.0
        total_value += value

        coins_state[coin] = {
            "amount": round(state["amount"], 6),
            "value": round(value, 2),
            "pnl_percent": round(pnl, 2),
            "price": price
        }

    socketio.emit("portfolio_state", {
        "cash": round(cash_balance, 2),
        "total_value": round(total_value, 2),
        "coins": coins_state
    })


# ---------- SOCKETS ----------

@socketio.on("connect")
def on_connect():
    global market_data, current_index, is_running, cash_balance

    print("Client connected")

    cash_balance = STARTING_BALANCE

    if not market_data:
        market_data = get_daily_scenario()
        coins = list(market_data.keys())
        init_portfolio(coins)

        current_index = INITIAL_VISIBLE_CANDLES
        print(f"Daily coins: {coins}")

    # Historia dla KAŻDEGO coina
    for coin, candles in market_data.items():
        socketio.emit("history", {
            "coin": coin,
            "candles": candles[:INITIAL_VISIBLE_CANDLES]
        })

    # Stan początkowy
    prices = {
        coin: market_data[coin][current_index - 1]["close"]
        for coin in market_data
    }
    emit_full_state(prices)

    if not is_running:
        is_running = True
        socketio.start_background_task(stream_market)


def stream_market():
    global current_index, is_running

    while True:
        if current_index >= len(next(iter(market_data.values()))):
            socketio.emit("game_over")
            is_running = False
            break

        prices = {}

        for coin, candles in market_data.items():
            candle = candles[current_index]
            prices[coin] = candle["close"]

            socketio.emit("candle", {
                "coin": coin,
                "candle": candle
            })

        emit_full_state(prices)

        current_index += 1
        socketio.sleep(GAME_SPEED)


@socketio.on("trade")
def handle_trade(data):
    global cash_balance

    coin = data.get("coin")
    action = data.get("action")
    amount = float(data.get("amount", 0))

    if coin not in portfolio or amount <= 0:
        return

    price = market_data[coin][current_index - 1]["close"]
    state = portfolio[coin]

    if action == "BUY" and cash_balance >= amount:
        crypto = amount / price
        cash_balance -= amount
        state["amount"] += crypto
        state["invested"] += amount

    elif action == "SELL":
        crypto = amount / price
        if state["amount"] >= crypto and state["invested"] > 0:
            ratio = crypto / state["amount"]
            state["invested"] -= state["invested"] * ratio
            state["amount"] -= crypto
            cash_balance += amount

    prices = {
        c: market_data[c][current_index - 1]["close"]
        for c in market_data
    }
    emit_full_state(prices)


# ---------- START ----------
if __name__ == "__main__":
    socketio.run(app, port=5000, debug=True, allow_unsafe_werkzeug=True)
