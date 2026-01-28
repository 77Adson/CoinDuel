from flask import Flask, request
from flask_socketio import SocketIO
from flask_cors import CORS

from market_maker import load_all_markets
from models import db, Score
from flask import jsonify

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///scores.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

INITIAL_VISIBLE_CANDLES = 50
STARTING_BALANCE = 10_000

ALL_MARKETS = load_all_markets()
active_games = {}  # sid -> game state


def create_game():
    return {
        "index": INITIAL_VISIBLE_CANDLES,
        "cash": STARTING_BALANCE,
        "coins": [],
        "portfolio": {},
        "speed": 0.5,
        "username": None,
        "running": False
    }


@socketio.on("connect")
def connect():
    sid = request.sid
    active_games[sid] = create_game()
    socketio.emit("available_coins", list(ALL_MARKETS.keys()), to=sid)


@socketio.on("start_game")
def start_game(data=None):
    print("Start_Game Data: ", data)
    sid = request.sid
    game = active_games[sid]

    if not data:
        socketio.emit("error", {"msg": "Missing start_game payload"}, to=sid)
        return

    game["username"] = data.get("username", "anonymous")
    game["coins"] = data.get("coins", [])[:3]
    game["speed"] = float(data.get("speed", 0.5))

    if not game["coins"]:
        socketio.emit("error", {"msg": "No coins selected"}, to=sid)
        return

    game["portfolio"] = {
        c: {"amount": 0.0, "invested": 0.0}
        for c in game["coins"]
    }

    for c in game["coins"]:
        socketio.emit(
            "history",
            {
                "coin": c,
                "candles": ALL_MARKETS[c][:INITIAL_VISIBLE_CANDLES],
            },
            to=sid,
        )

    game["running"] = True
    socketio.start_background_task(game_loop, sid)


def game_loop(sid):
    game = active_games[sid]
    first_coin = game["coins"][0]
    max_len = len(ALL_MARKETS[first_coin])

    while game["running"]:
        idx = game["index"]
        if idx >= max_len:
            finish_game(sid)
            break

        for c in game["coins"]:
            socketio.emit("candle", {
                "coin": c,
                "candle": ALL_MARKETS[c][idx]
            }, to=sid)

        emit_portfolio(sid)
        game["index"] += 1
        socketio.sleep(game["speed"])


def emit_portfolio(sid):
    game = active_games[sid]
    prices = {
        c: ALL_MARKETS[c][game["index"] - 1]["close"]
        for c in game["coins"]
    }

    total = game["cash"]
    coins = {}

    for c, s in game["portfolio"].items():
        val = s["amount"] * prices[c]
        total += val
        coins[c] = {
            "amount": round(s["amount"], 6),
            "value": round(val, 2),
            "price": prices[c]
        }

    socketio.emit("portfolio_state", {
        "cash": round(game["cash"], 2),
        "total": round(total, 2),
        "coins": coins
    }, to=sid)


@socketio.on("trade")
def trade(data):
    sid = request.sid
    game = active_games[sid]

    c = data["coin"]
    amt = float(data["amount"])
    price = ALL_MARKETS[c][game["index"] - 1]["close"]
    state = game["portfolio"][c]

    if data["action"] == "BUY" and game["cash"] >= amt:
        crypto = amt / price
        game["cash"] -= amt
        state["amount"] += crypto
        state["invested"] += amt

    if data["action"] == "SELL":
        crypto = amt / price
        if state["amount"] >= crypto:
            ratio = crypto / state["amount"]
            state["invested"] *= (1 - ratio)
            state["amount"] -= crypto
            game["cash"] += amt


def finish_game(sid):
    game = active_games[sid]

    prices = {
        c: ALL_MARKETS[c][game["index"] - 1]["close"]
        for c in game["coins"]
    }

    total = game["cash"]
    for c, s in game["portfolio"].items():
        total += s["amount"] * prices[c]

    score = Score(
        username=game["username"],
        score=total,
        assets=",".join(game["coins"])
    )

    db.session.add(score)
    db.session.commit()

    socketio.emit("game_over", {
        "total": round(total, 2)
    }, to=sid)

@app.route("/leaderboard", methods=["GET"])
def leaderboard():
    top = (
        Score.query
        .order_by(Score.score.desc())
        .limit(10)
        .all()
    )
    return jsonify([s.to_dict() for s in top])

if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    socketio.run(app, port=5000, debug=True, allow_unsafe_werkzeug=True)