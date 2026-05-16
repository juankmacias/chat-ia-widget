require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const {
  getOrCreateConversation,
  getHistory,
  saveMessage,
  countUserMessagesForSession,
  countUserMessagesForIp,
} = require('./db');
const { SYSTEM_PROMPT } = require('./system-prompt');

const app = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;
const MAX_USER_MESSAGES = 10;
const LIMIT_REPLY =
  'Llegamos al límite de mensajes por aquí 🙏. Para seguir tu consulta y atenderte personalmente, escríbeme directamente al WhatsApp 322 3671553 y te atiendo de una 😊.';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
}));
app.use(express.json({ limit: '100kb' }));

const MEDIA_DIR = path.join(__dirname, 'public', 'media');
const MEDIA_EXTS = {
  audio: ['.mp3', '.ogg', '.m4a', '.wav'],
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  video: ['.mp4', '.webm', '.mov'],
};

app.get('/media/:type/:slug', (req, res, next) => {
  const { type, slug } = req.params;
  const exts = MEDIA_EXTS[type];
  if (!exts || !/^[a-z0-9-]+$/.test(slug)) return next();
  for (const ext of exts) {
    const filePath = path.join(MEDIA_DIR, type, slug + ext);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
  }
  res.status(404).send('Media not found');
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body ?? {};

    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 100) {
      return res.status(400).json({ error: 'sessionId inválido' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message requerido' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Mensaje demasiado largo (máx 2000)' });
    }

    const userAgent = req.headers['user-agent']?.slice(0, 300) ?? null;
    const ip = (req.ip || req.socket?.remoteAddress || '').slice(0, 64) || null;
    const conversationId = await getOrCreateConversation(sessionId, userAgent, ip);

    const [countBySession, countByIp] = await Promise.all([
      countUserMessagesForSession(sessionId),
      countUserMessagesForIp(ip),
    ]);
    if (countBySession >= MAX_USER_MESSAGES || countByIp >= MAX_USER_MESSAGES) {
      await saveMessage(conversationId, 'user', message);
      await saveMessage(conversationId, 'assistant', LIMIT_REPLY);
      return res.json({ reply: LIMIT_REPLY, limit_reached: true });
    }

    const history = await getHistory(conversationId, 20);
    const apiMessages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    await saveMessage(conversationId, 'user', message);

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    await saveMessage(conversationId, 'assistant', reply, response.usage);

    res.json({ reply });
  } catch (err) {
    console.error('Error en /api/chat:', err);
    if (err instanceof Anthropic.APIError) {
      return res.status(err.status || 500).json({
        error: 'Error consultando la IA',
        detail: err.message,
      });
    }
    res.status(500).json({ error: 'Error interno', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
