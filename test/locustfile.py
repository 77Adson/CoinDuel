import time
import random
import socketio
from locust import User, task, between, events

class SocketIOUser(User):
    """
    Symuluje gracza używającego Socket.IO.
    Każdy 'User' to osobny wątek/greenlet łączący się z serwerem.
    """
    wait_time = between(1, 3) # Czas myślenia gracza między akcjami (1-3 sekundy)

    def on_start(self):
        """Uruchamiane przy starcie użytkownika: Połączenie i Start Gry"""
        self.sio = socketio.Client()
        self.connected = False
        
        try:
            # Łączymy się z localhost:5000
            self.sio.connect("http://localhost:5000")
            self.connected = True
            
            # Start gry
            self.sio.emit("start_game", {
                "username": f"LocustUser_{random.randint(1000,9999)}",
                "coins": ["BTC", "ETH"], # Symulujemy wybór monet
                "speed": 0.1 # Bardzo szybka gra dla testów
            })
            
            # Nasłuchujemy (opcjonalnie, żeby nie blokować bufora)
            @self.sio.on("portfolio_state")
            def on_portfolio(data):
                pass 

        except Exception as e:
            print(f"Connection failed: {e}")
            events.request.fire(
                request_type="SocketIO",
                name="connect",
                response_time=0,
                exception=e,
            )

    @task(3)
    def buy_action(self):
        """Gracz kupuje losową kwotę"""
        if not self.connected: return
        
        start_time = time.time()
        try:
            amount = random.randint(100, 1000)
            self.sio.emit("trade", {"coin": "BTC", "action": "BUY", "amount": amount})
            
            # Raportujemy sukces do Locusta
            events.request.fire(
                request_type="SocketIO",
                name="trade_buy",
                response_time=(time.time() - start_time) * 1000,
                response_length=0,
            )
        except Exception as e:
            events.request.fire(
                request_type="SocketIO",
                name="trade_buy",
                response_time=0,
                exception=e,
            )

    @task(1)
    def sell_action(self):
        """Gracz sprzedaje (rzadziej niż kupuje)"""
        if not self.connected: return
        
        start_time = time.time()
        try:
            self.sio.emit("trade", {"coin": "BTC", "action": "SELL", "amount": 500})
            
            events.request.fire(
                request_type="SocketIO",
                name="trade_sell",
                response_time=(time.time() - start_time) * 1000,
                response_length=0,
            )
        except Exception as e:
            events.request.fire(
                request_type="SocketIO",
                name="trade_sell",
                response_time=0,
                exception=e,
            )

    def on_stop(self):
        """Rozłączenie przy zatrzymaniu testu"""
        if self.connected:
            self.sio.disconnect()