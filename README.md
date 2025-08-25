# Secure Chat App with End‑to‑End Encryption (E2EE)

A minimal chat that keeps encryption **entirely in the browser** using the Web Crypto API (AES‑GCM).
The Flask‑SocketIO server **never sees plaintext**—it only relays ciphertext to participants in the same room.

## Features
- 🔐 **E2EE** with AES‑256‑GCM; key derived via PBKDF2 from a shared passphrase
- 💬 Real‑time messaging (Socket.IO)
- 🧂 Per-session random salt shared with every message (so receivers can derive the same key)
- 🧰 Simple Flask backend that only relays ciphertext
- 🖥️ Clean UI with join/leave and per‑room chats

> DEMO MODEL: All users in a room enter the **same passphrase**. For interviews, you can explain how to upgrade to RSA for exchanging per‑chat symmetric keys.

## Quick Start

```bash
# 1) Create and activate a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 2) Install dependencies
pip install -r requirements.txt

# 3) Run
python app.py
# Open http://localhost:5000 in two different browsers/tabs
```

## How It Works (High Level)
1. User enters `username`, `room`, and a **shared passphrase**.
2. Browser derives an AES‑256 key using PBKDF2 (150k iters, SHA‑256) with a random salt.
3. Every message is encrypted with AES‑GCM using a fresh 96‑bit IV.
4. Client sends `{iv, ciphertext, salt}` to the server, which **broadcasts as‑is** to the room.
5. Receivers derive the same key from their passphrase and the sender’s salt, then decrypt.

## Security Notes (for your report)
- Server is **blind** to message content (no decryption code exists on server).
- Use HTTPS + secure cookies in production; lock down CORS and origins.
- Replace passphrase sharing with **asymmetric key exchange** (RSA/ECDH) for stronger security:
  - Clients generate key pairs and publish **public keys** to a directory service.
  - Initiator generates a random AES session key, encrypts it with recipient public keys (hybrid crypto).
- Consider forward secrecy (e.g., X3DH/Double Ratchet like Signal) as an advanced improvement.

## File Structure
```
secure-chat-e2ee/
├─ app.py
├─ requirements.txt
├─ templates/
│  └─ index.html
└─ static/
   ├─ style.css
   └─ client.js
```

## Interview Talking Points
- Why AES‑GCM? (Confidentiality + Integrity via authentication tag)
- Why PBKDF2? (Resists brute force; could swap for Argon2)
- Threat model and limitations (shared passphrase, no FS, no trust-on-first-use verification)
- Next steps: RSA/ECDH handshake, message signatures, key rotation, and encrypted local storage.
```
