from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'change-me'  # for session cookies if needed
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")  # dev-friendly; lock down for prod

@app.route("/")
def index():
    return render_template("index.html")

@socketio.on("join")
def on_join(data):
    username = data.get("username")
    room = data.get("room")
    join_room(room)
    emit("system", {"msg": f"{username} joined."}, to=room)

@socketio.on("leave")
def on_leave(data):
    username = data.get("username")
    room = data.get("room")
    leave_room(room)
    emit("system", {"msg": f"{username} left."}, to=room)

@socketio.on("ciphertext")
def on_ciphertext(data):
    # Relay encrypted messages as-is (server cannot decrypt)
    room = data.get("room")
    emit("ciphertext", data, to=room, include_self=False)

if __name__ == "__main__":
    # Use eventlet or gevent in production; simple dev server for demo
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
