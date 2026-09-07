import express from 'express';
import pg from 'pg';
import {
  initialMunicipality,
  initialUsers,
  initialCycle,
  initialNeighborhoods,
  initialProperties,
  initialOvitraps,
  initialStrategicPoints,
  initialSpecialProperties,
  initialEpidemiologicalEvents,
  initialEpidemiologicalBlocks,
  initialComplaints,
  initialSupplies,
  initialEquipments,
  initialTasks,
  initialAlerts,
  initialReferrals,
  initialAuditLogs,
} from '../src/services/seedData';

const { Pool } = pg;
const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  database: 'endemias',
  user: 'endemias',
  password: 'endemias',
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT NOT NULL,
      type TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (type, id)
    );
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*) as count FROM entities');
  if (parseInt(rows[0].count) === 0) {
    await seed();
    console.log('Database seeded with initial data');
  }
}

async function seed() {
  const entities: { type: string; data: any }[] = [
    { type: 'municipality', data: initialMunicipality },
    ...initialUsers.map(u => ({ type: 'users', data: u })),
    { type: 'cycle', data: initialCycle },
    ...initialNeighborhoods.map(n => ({ type: 'neighborhoods', data: n })),
    ...initialProperties.map(p => ({ type: 'properties', data: p })),
    ...initialOvitraps.map(o => ({ type: 'ovitraps', data: o })),
    ...initialStrategicPoints.map(s => ({ type: 'strategic_points', data: s })),
    ...initialSpecialProperties.map(s => ({ type: 'special_properties', data: s })),
    ...initialEpidemiologicalEvents.map(e => ({ type: 'epi_events', data: e })),
    ...initialEpidemiologicalBlocks.map(b => ({ type: 'epi_blocks', data: b })),
    ...initialComplaints.map(c => ({ type: 'complaints', data: c })),
    ...initialSupplies.map(s => ({ type: 'supplies', data: s })),
    ...initialEquipments.map(e => ({ type: 'equipments', data: e })),
    ...initialTasks.map(t => ({ type: 'tasks', data: t })),
    ...initialAlerts.map(a => ({ type: 'alerts', data: a })),
    ...initialReferrals.map(r => ({ type: 'referrals', data: r })),
    ...initialAuditLogs.map(l => ({ type: 'audit_logs', data: l })),
  ];

  for (const { type, data } of entities) {
    await pool.query(
      'INSERT INTO entities (id, type, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [data.id, type, JSON.stringify(data)]
    );
  }

  await pool.query(
    'INSERT INTO app_state (key, data) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    ['current_user', JSON.stringify(initialUsers[3])]
  );
}

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Entity CRUD (generic, JSONB-based) ────────────────────────
app.get('/api/entities/:type', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT data FROM entities WHERE type = $1 ORDER BY created_at',
      [req.params.type]
    );
    res.json(rows.map(r => r.data));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/entities/:type/bulk', async (req, res) => {
  try {
    const type = req.params.type;
    const entities: any[] = req.body;
    for (const entity of entities) {
      await pool.query(
        `INSERT INTO entities (id, type, data) VALUES ($1, $2, $3)
         ON CONFLICT (type, id) DO UPDATE SET data = $3, updated_at = NOW()`,
        [entity.id, type, JSON.stringify(entity)]
      );
    }
    res.json({ success: true, count: entities.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/entities/:type', async (req, res) => {
  try {
    const entity = req.body;
    await pool.query(
      `INSERT INTO entities (id, type, data) VALUES ($1, $2, $3)
       ON CONFLICT (type, id) DO UPDATE SET data = $3, updated_at = NOW()`,
      [entity.id, req.params.type, JSON.stringify(entity)]
    );
    res.json(entity);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/entities/:type/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE entities SET data = $3, updated_at = NOW()
       WHERE type = $1 AND id = $2 RETURNING data`,
      [req.params.type, req.params.id, JSON.stringify(req.body)]
    );
    res.json(rows[0]?.data || req.body);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── App state (current_user etc.) ────────────────────────────
app.get('/api/state/:key', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT data FROM app_state WHERE key = $1',
      [req.params.key]
    );
    res.json(rows[0]?.data || null);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/state/:key', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO app_state (key, data) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = NOW()`,
      [req.params.key, JSON.stringify(req.body)]
    );
    res.json(req.body);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start ─────────────────────────────────────────────────────
const PORT = 8000;
initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`API server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
