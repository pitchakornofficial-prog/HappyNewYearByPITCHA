const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DATA_FILE = path.join(__dirname, 'data', 'wishes.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function ensureData() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8') || '[]';
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeData(d) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
}

ensureData();

app.get('/api/wishes', (req, res) => {
  const data = readData();
  data.sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(data);
});

// SSE clients
const sseClients = new Set();

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.post('/api/wishes', (req, res) => {
  const { name, message } = req.body || {};
  if (!name || !message || typeof name !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing name or message' });
  }
  const wish = {
    id: Date.now().toString(),
    name: name.trim().slice(0, 100),
    message: message.trim().slice(0, 1000),
    time: new Date().toISOString()
  };
  const data = readData();
  data.push(wish);
  writeData(data);
  // notify SSE clients
  const payload = `data: ${JSON.stringify(wish)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch (e) { /* ignore write errors */ }
  }

  res.status(201).json(wish);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
