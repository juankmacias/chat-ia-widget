const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en pool de Postgres:', err);
});

async function getOrCreateConversation(sessionId, userAgent, ip) {
  const existing = await pool.query(
    'SELECT id FROM conversations WHERE session_id = $1',
    [sessionId]
  );
  if (existing.rows.length > 0) {
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW(), ip = COALESCE(ip, $2) WHERE id = $1',
      [existing.rows[0].id, ip]
    );
    return existing.rows[0].id;
  }
  const created = await pool.query(
    'INSERT INTO conversations (session_id, user_agent, ip) VALUES ($1, $2, $3) RETURNING id',
    [sessionId, userAgent, ip]
  );
  return created.rows[0].id;
}

async function countUserMessagesForSession(sessionId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.session_id = $1 AND m.role = 'user'`,
    [sessionId]
  );
  return result.rows[0].n;
}

async function countUserMessagesForIp(ip) {
  if (!ip) return 0;
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.ip = $1 AND m.role = 'user'`,
    [ip]
  );
  return result.rows[0].n;
}

async function getHistory(conversationId, limit = 20) {
  const result = await pool.query(
    `SELECT role, content FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [conversationId, limit]
  );
  return result.rows;
}

async function saveMessage(conversationId, role, content, usage = {}) {
  await pool.query(
    `INSERT INTO messages (conversation_id, role, content, tokens_input, tokens_output)
     VALUES ($1, $2, $3, $4, $5)`,
    [conversationId, role, content, usage.input_tokens ?? null, usage.output_tokens ?? null]
  );
}

module.exports = {
  pool,
  getOrCreateConversation,
  getHistory,
  saveMessage,
  countUserMessagesForSession,
  countUserMessagesForIp,
};
