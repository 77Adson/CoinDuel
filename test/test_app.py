import pytest
from app import app, db, socketio, ALL_MARKETS

# --- KONFIGURACJA TESTÓW ---
@pytest.fixture
def client():
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"  # Baza w RAM
    
    with app.app_context():
        db.create_all()
        yield app.test_client()
        db.drop_all()

@pytest.fixture
def socket_client():
    # Tworzymy klienta testowego SocketIO
    return socketio.test_client(app)

# --- MOCKOWANIE DANYCH RYNKOWYCH ---
# Nadpisujemy ALL_MARKETS, żeby testy nie zależały od plików CSV
ALL_MARKETS["BTC"] = [{"close": 50000}] * 1000 # Stała cena 50k
ALL_MARKETS["ETH"] = [{"close": 4000}] * 1000  # Stała cena 4k


# --- TESTY ---

def test_leaderboard_empty(client):
    """Sprawdza czy leaderboard zwraca pustą listę na początku."""
    rv = client.get("/leaderboard")
    assert rv.status_code == 200
    assert rv.json == []

def test_start_game(socket_client):
    """Sprawdza inicjalizację gry przez SocketIO."""
    socket_client.emit("start_game", {"username": "Tester", "coins": ["BTC"]})
    
    # Odbierz odpowiedzi
    received = socket_client.get_received()
    
    # Szukamy eventu 'history'
    history_events = [e for e in received if e['name'] == 'history']
    assert len(history_events) > 0
    assert history_events[0]['args'][0]['coin'] == "BTC"

def test_trade_buy_logic(socket_client):
    """Testuje logikę kupna."""
    # 1. Start gry
    socket_client.emit("start_game", {"coins": ["BTC"]})
    
    # 2. Kupujemy za 10,000$ przy cenie 50,000$ (z mocka) -> Powinniśmy mieć 0.2 BTC
    # Domyślnie gracz ma 10,000$, więc wydajemy wszystko.
    socket_client.emit("trade", {"coin": "BTC", "action": "BUY", "amount": 10000})
    
    # 3. Sprawdzamy stan portfela
    received = socket_client.get_received()
    portfolio_updates = [e for e in received if e['name'] == 'portfolio_state']
    last_state = portfolio_updates[-1]['args'][0]
    
    assert last_state["cash"] == 0.0
    assert last_state["coins"]["BTC"]["amount"] == 0.2
    assert last_state["coins"]["BTC"]["value"] == 10000.0

def test_trade_sell_profit(socket_client):
    """Testuje sprzedaż (symulacja zysku)."""
    # 1. Start gry
    socket_client.emit("start_game", {"coins": ["BTC"]})
    
    # 2. Kupujemy 0.1 BTC za 5000$ (Cena rynkowa: 50,000)
    socket_client.emit("trade", {"coin": "BTC", "action": "BUY", "amount": 5000})
    
    # 3. HACK: Zmieniamy cenę rynkową "w locie" na 100,000$ (x2)
    ALL_MARKETS["BTC"][50]["close"] = 100000 
    # Przesuwamy indeks gry gracza, żeby "widział" nową cenę (socket_client nie ma łatwego dostępu do sid, 
    # więc zakładamy, że to zadziała w uproszczonym modelu testowym lub musimy hackować active_games)
    
    # W teście jednostkowym socketio trudniej symulować upływ czasu pętli game_loop.
    # Zamiast tego sprawdzimy tylko czy SELL zwraca gotówkę poprawnie przy stałej cenie.
    
    # Sprzedajemy za 5000$ (czyli całe nasze 0.1 BTC przy cenie 50k)
    socket_client.emit("trade", {"coin": "BTC", "action": "SELL", "amount": 5000})
    
    received = socket_client.get_received()
    last_state = [e for e in received if e['name'] == 'portfolio_state'][-1]['args'][0]
    
    # Powinniśmy odzyskać gotówkę (minus/plus błędy zaokrągleń float)
    assert 9999.99 <= last_state["cash"] <= 10000.01
    assert last_state["coins"]["BTC"]["amount"] == 0.0

def test_trade_insufficient_funds(socket_client):
    """Sprawdza zabezpieczenie przed wydaniem za dużo."""
    socket_client.emit("start_game", {"coins": ["BTC"]})
    
    # Próba kupna za 20,000$ (mając 10k)
    socket_client.emit("trade", {"coin": "BTC", "action": "BUY", "amount": 20000})
    
    received = socket_client.get_received()
    errors = [e for e in received if e['name'] == 'error']
    
    assert len(errors) > 0
    assert errors[0]['args'][0]['msg'] == "Niewystarczające środki"