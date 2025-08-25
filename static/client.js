// --- Utility: Base64 helpers ---
function toBase64(bytes){ return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function fromBase64(b64){
  const bin = atob(b64); const len = bin.length; const bytes = new Uint8Array(len);
  for (let i=0;i<len;i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// --- Crypto primitives using Web Crypto ---
async function deriveKey(passphrase, saltB64){
  const enc = new TextEncoder();
  const salt = saltB64 ? fromBase64(saltB64) : crypto.getRandomValues(new Uint8Array(16)).buffer;
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    {name:"PBKDF2", salt, iterations:150000, hash:"SHA-256"},
    keyMaterial, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]
  );
  return { key, saltB64: toBase64(salt) };
}

async function encryptText(key, plaintext){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, enc.encode(plaintext));
  return { ivB64: toBase64(iv), ctB64: toBase64(ct) };
}

async function decryptText(key, ivB64, ctB64){
  const iv = new Uint8Array(fromBase64(ivB64));
  const ct = fromBase64(ctB64);
  const ptBuf = await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, ct);
  return new TextDecoder().decode(ptBuf);
}

// --- App state ---
let socket = null;
let aesKey = null;
let saltB64 = null;
let username = null;
let room = null;

const ui = {
  username: document.getElementById("username"),
  room: document.getElementById("room"),
  passphrase: document.getElementById("passphrase"),
  joinBtn: document.getElementById("joinBtn"),
  leaveBtn: document.getElementById("leaveBtn"),
  chat: document.getElementById("chat"),
  messages: document.getElementById("messages"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
};

function addMsg(text, cls="system"){
  const div = document.createElement("div");
  div.className = cls === "me" ? "msg me" : cls === "them" ? "msg them" : "system";
  div.textContent = text;
  ui.messages.appendChild(div);
  ui.messages.scrollTop = ui.messages.scrollHeight;
}

// --- Join / Leave ---
ui.joinBtn.onclick = async () => {
  username = ui.username.value.trim();
  room = ui.room.value.trim();
  const pass = ui.passphrase.value;

  if(!username || !room || !pass){ alert("Fill username, room, and passphrase"); return; }

  // Derive AES key (same passphrase must be used by all room participants).
  const d = await deriveKey(pass);
  aesKey = d.key; saltB64 = d.saltB64;

  socket = io.connect(window.location.origin, { transports: ["websocket"] });
  socket.on("connect", () => {
    socket.emit("join", { username, room });
    ui.joinBtn.disabled = true;
    ui.leaveBtn.disabled = false;
    ui.chat.style.display = "block";
    addMsg("Connected. Waiting for messages…", "system");
  });

  socket.on("system", (data) => addMsg(data.msg, "system"));
  socket.on("ciphertext", async (data) => {
    try{
      // Receiver derives key with sender's salt (salt is shared alongside message).
      const pass = ui.passphrase.value;
      const { key } = await deriveKey(pass, data.saltB64);
      const pt = await decryptText(key, data.ivB64, data.ctB64);
      addMsg(`${data.username}: ${pt}`, "them");
    }catch(e){ addMsg("[Decryption failed]", "system"); }
  });
};

ui.leaveBtn.onclick = () => {
  if(socket){
    socket.emit("leave", { username, room });
    socket.disconnect();
  }
  socket = null; aesKey = null; saltB64 = null;
  ui.joinBtn.disabled = false;
  ui.leaveBtn.disabled = true;
  ui.chat.style.display = "none";
  addMsg("Disconnected.", "system");
};

// --- Sending messages ---
ui.sendBtn.onclick = async () => {
  if(!socket || !aesKey) return;
  const text = ui.messageInput.value.trim();
  if(!text) return;

  const enc = await encryptText(aesKey, text);
  // Send ciphertext with IV, salt (so receiver can derive the same key), and metadata
  socket.emit("ciphertext", {
    room, username, ivB64: enc.ivB64, ctB64: enc.ctB64, saltB64
  });
  addMsg(`Me: ${text}`, "me");
  ui.messageInput.value = "";
};
