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

async function getOrCreateConversation(sessionId, userAgent) {
  const existing = await pool.query(
    'SELECT id FROM conversations WHERE session_id = $1',
    [sessionId]
  );
  if (existing.rows.length > 0) {
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
      [existing.rows[0].id]
    );
    return existing.rows[0].id;
  }
  const created = await pool.query(
    'INSERT INTO conversations (session_id, user_agent) VALUES ($1, $2) RETURNING id',
    [sessionId, userAgent]
  );
  return created.rows[0].id;
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
};
