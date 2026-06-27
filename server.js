const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { localNow, safeParse, md5, sendError, extractImageUrls, stripImageUrls, buildUserContent } = require('./utils');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Constants ==========
const DATA_DIR = process.env.DATA_DIR || __dirname;
const CONFIG_PATH = path.join(DATA_DIR, 'db-config.json');
const DEFAULT_DB_PATH = path.join(DATA_DIR, 'default.db');
const UPLOADS_DIR = path.join(DATA_DIR, 'databases');
const TMP_DIR = path.join(DATA_DIR, 'tmp-uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ========== Config ==========
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw);
      const validRecent = (cfg.recentPaths || []).filter(p => fs.existsSync(p));
      if (validRecent.length === 0) validRecent.push(DEFAULT_DB_PATH);
      const currentPath = (cfg.currentPath && fs.existsSync(cfg.currentPath))
        ? cfg.currentPath
        : DEFAULT_DB_PATH;
      return { currentPath, recentPaths: validRecent, targetDir: cfg.targetDir || '' };
    }
  } catch (e) {
    console.error('[config] 读取 db-config.json 失败:', e.message);
  }
  return { currentPath: DEFAULT_DB_PATH, recentPaths: [DEFAULT_DB_PATH], targetDir: '' };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error('[config] 保存 db-config.json 失败:', e.message);
  }
}

// ========== Database Initialization ==========
function initDatabase(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  try {
    const integrity = db.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') {
      console.error('[db] 数据库完整性检查失败:', integrity);
    }
  } catch (integrityErr) {
    console.error('[db] 数据库完整性检查异常:', integrityErr.message);
  }

  // Ensure data_questions table exists (external DB may not have it)
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS data_questions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  DATETIME,
      updated_at  DATETIME,
      deleted_at  DATETIME,
      md5         TEXT,
      type        TEXT NOT NULL,
      content     TEXT NOT NULL,
      options     BLOB,
      answers     BLOB,
      right_status INTEGER DEFAULT 0,
      category    TEXT DEFAULT '默认',
      images      TEXT
    )`);
  } catch {}

  // Migration: add images column
  try { db.exec(`ALTER TABLE data_questions ADD COLUMN images TEXT`); } catch {}

  // Migration: add analysis column (AI 解析缓存)
  try { db.exec(`ALTER TABLE data_questions ADD COLUMN analysis TEXT`); } catch {}

  // Migration: add ai_answer column (AI 答案缓存)
  try { db.exec(`ALTER TABLE data_questions ADD COLUMN ai_answer TEXT`); } catch {}

  // Ensure data_categories table exists WITH score column
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS data_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      score INTEGER,
      created_at DATETIME
    )`);
  } catch {}

  // Auto-migrate: add missing columns to existing tables
  try { db.exec(`ALTER TABLE data_questions ADD COLUMN category TEXT DEFAULT '默认'`); } catch {}
  try { db.exec(`ALTER TABLE data_categories ADD COLUMN score INTEGER`); } catch {}
  try { db.exec(`ALTER TABLE data_categories ADD COLUMN notes TEXT`); } catch {}

  // Indexes
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_questions_type ON data_questions(type)`); } catch {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_questions_category ON data_questions(category)`); } catch {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_questions_created_at ON data_questions(created_at)`); } catch {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_questions_deleted_at ON data_questions(deleted_at)`); } catch {}

  // Sync categories from questions
  try {
    const existing = db.prepare("SELECT DISTINCT COALESCE(category, '默认') as name FROM data_questions WHERE deleted_at IS NULL").all();
    const insert = db.prepare("INSERT OR IGNORE INTO data_categories (name, created_at) VALUES (@name, @created_at)");
    const now = localNow();
    for (const row of existing) { insert.run({ name: row.name, created_at: now }); }
  } catch {}

  // Ensure ai_providers table exists
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS ai_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      created_at DATETIME,
      updated_at DATETIME
    )`);
  } catch {}

  // Ensure external_config table exists
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS external_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME
    )`);
  } catch {}

  // Ensure external_logs table exists
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS external_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT,
      result TEXT NOT NULL,
      answer TEXT,
      cost_ms INTEGER,
      created_at DATETIME
    )`);
  } catch {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_ext_logs_created ON external_logs(created_at)`); } catch {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_ext_logs_source ON external_logs(source)`); } catch {}

  // Ensure users table exists
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password      TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user',
      display_name  TEXT,
      created_at    DATETIME,
      updated_at    DATETIME,
      last_login_at DATETIME,
      is_active     INTEGER DEFAULT 1
    )`);
  } catch {}

  // Ensure user_activity_logs table exists
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS user_activity_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      action      TEXT NOT NULL,
      detail      TEXT,
      created_at  DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
  } catch {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON user_activity_logs(user_id)`); } catch {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON user_activity_logs(created_at)`); } catch {}

  // Ensure user_category_restrictions table exists
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS user_category_restrictions (
      user_id      INTEGER NOT NULL,
      category     TEXT NOT NULL,
      created_at   DATETIME,
      PRIMARY KEY (user_id, category),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  } catch {}

  // Add restriction_mode column to users if not exists
  try { db.exec(`ALTER TABLE users ADD COLUMN restriction_mode TEXT DEFAULT 'allow'`); } catch {}

  // Ensure site_settings table exists
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS site_settings (
      key         TEXT PRIMARY KEY,
      value       TEXT,
      updated_at  DATETIME
    )`);
  } catch {}

  // Migrate old announcement keys to new format
  try {
    const oldAnnouncement = db.prepare('SELECT value, updated_at FROM site_settings WHERE key = ?').get('announcement');
    const oldEnabled = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('announcement_enabled');
    if (oldAnnouncement) {
      const now = localNow();
      db.prepare('INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('announcement_modal', oldAnnouncement.value, oldAnnouncement.updated_at || now);
      db.prepare('DELETE FROM site_settings WHERE key = ?').run('announcement');
      console.log('[db] 已迁移旧公告 key: announcement → announcement_modal');
    }
    if (oldEnabled) {
      db.prepare('INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)')
        .run('announcement_modal_enabled', oldEnabled.value, localNow());
      db.prepare('DELETE FROM site_settings WHERE key = ?').run('announcement_enabled');
      console.log('[db] 已迁移旧公告 key: announcement_enabled → announcement_modal_enabled');
    }
  } catch {}

  // Create default admin user if not exists
  try {
    const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!adminExists) {
      const hash = bcrypt.hashSync('admin123', 10);
      const now = localNow();
      db.prepare('INSERT INTO users (username, password, role, display_name, created_at) VALUES (?, ?, ?, ?, ?)')
        .run('admin', hash, 'admin', '管理员', now);
      console.log('[db] 已创建默认管理员账号: admin / admin123');
    }
  } catch {}
}

function openDatabase(dbPath) {
  const db = new Database(dbPath);
  initDatabase(db);
  return db;
}

function isSQLiteFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    return buf.toString('ascii', 0, 15) === 'SQLite format 3';
  } catch {
    return false;
  }
}

function getDbStats(curDb) {
  try {
    const questionCount = curDb.prepare('SELECT COUNT(*) as cnt FROM data_questions WHERE deleted_at IS NULL').get().cnt;
    const trashCount = curDb.prepare('SELECT COUNT(*) as cnt FROM data_questions WHERE deleted_at IS NOT NULL').get().cnt;
    const categoryCount = curDb.prepare('SELECT COUNT(*) as cnt FROM data_categories').get().cnt;
    return { questionCount, trashCount, categoryCount };
  } catch {
    return { questionCount: 0, trashCount: 0, categoryCount: 0 };
  }
}

// ========== Initialize DB on Startup ==========
const config = loadConfig();
let db;
try {
  db = openDatabase(config.currentPath);
  console.log(`[server] 数据库已加载: ${config.currentPath}`);
} catch (err) {
  console.error(`[server] 加载数据库失败: ${config.currentPath}`, err.message);
  if (config.currentPath !== DEFAULT_DB_PATH) {
    console.log('[server] 回退到默认数据库:', DEFAULT_DB_PATH);
    config.currentPath = DEFAULT_DB_PATH;
    config.recentPaths = [DEFAULT_DB_PATH];
    saveConfig(config);
    db = openDatabase(DEFAULT_DB_PATH);
  } else {
    process.exit(1);
  }
}

const getDb = () => db;
const setDb = (newDb) => { db = newDb; };

// ========== Middleware ==========
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ========== Routes ==========
const helpers = { md5, safeParse, sendError, localNow, extractImageUrls, stripImageUrls, buildUserContent };

// Auth middleware
const auth = require('./middleware/auth')(getDb);

// Auth routes (public)
const authRouter = require('./routes/auth')(getDb, helpers, auth);
app.use('/api/auth', authRouter);

// User management routes (admin only)
const usersRouter = require('./routes/users')(getDb, helpers, auth);
app.use('/api/users', usersRouter);

// Activity logs routes (admin only)
const activityLogsRouter = require('./routes/activity-logs')(getDb, helpers, auth);
app.use('/api/activity-logs', activityLogsRouter);

// Routes with read access for all users, write access for admin only
const questionsRouter = require('./routes/questions')(getDb, helpers, auth);
const trashRouter = require('./routes/trash')(getDb, helpers, auth);
const statsRouter = require('./routes/stats')(getDb, helpers, auth);
const categoriesRouter = require('./routes/categories')(getDb, helpers, auth);
const backupRouter = require('./routes/backup')(getDb, helpers, auth);
const aiRouter = require('./routes/ai')(getDb, helpers, auth);
const duplicatesRouter = require('./routes/duplicates')(getDb, helpers, auth);
const databaseRouter = require('./routes/database')(getDb, setDb, helpers, {
  config, DEFAULT_DB_PATH, UPLOADS_DIR, TMP_DIR, isSQLiteFile, openDatabase, getDbStats, loadConfig, saveConfig,
}, auth);
const quizRouter = require('./routes/quiz')(getDb, helpers, auth);

app.use('/api/questions', auth.authRequired, questionsRouter);
app.use('/api/trash', auth.authRequired, trashRouter);
app.use('/api/stats', auth.authRequired, statsRouter);
app.use('/api/categories', auth.authRequired, categoriesRouter);
app.use('/api/backup', auth.adminRequired, backupRouter);
app.use('/api/ai', auth.authRequired, aiRouter);
app.use('/api/ai/analyze', auth.authRequired);
app.use('/api/duplicates', auth.adminRequired, duplicatesRouter);
app.use('/api/database', auth.adminRequired, databaseRouter);
app.use('/api/quiz', auth.authRequired, quizRouter);

// External routes (no auth required - for yatori/OCS)
const externalRouter = require('./routes/external')(getDb, helpers);
app.use('/api/external', externalRouter);

// Site settings routes (GET public, PUT admin only)
const siteSettingsRouter = require('./routes/site-settings')(getDb, helpers, auth);
app.use('/api/site-settings', siteSettingsRouter);

// GET /api/refresh — merge stats + categories in one call
app.get('/api/refresh', auth.authRequired, (req, res) => {
  try {
    const curDb = getDb();
    const days = Math.max(7, Math.min(365, parseInt(req.query.days) || 30));
    const total = curDb.prepare('SELECT COUNT(*) as cnt FROM data_questions WHERE deleted_at IS NULL').get().cnt;
    const byType = curDb.prepare('SELECT type, COUNT(*) as cnt FROM data_questions WHERE deleted_at IS NULL GROUP BY type').all();
    const byCategory = curDb.prepare("SELECT COALESCE(category, '默认') as category, COUNT(*) as cnt FROM data_questions WHERE deleted_at IS NULL GROUP BY category").all();
    const dailyTrend = curDb.prepare(`
      SELECT date(created_at) as date, COUNT(*) as cnt
      FROM data_questions WHERE deleted_at IS NULL
      GROUP BY date(created_at)
      ORDER BY date DESC LIMIT ?
    `).all(days).reverse();
    const categories = curDb.prepare("SELECT id, name, score, created_at FROM data_categories ORDER BY id ASC").all();
    res.json({ total, byType, byCategory, dailyTrend, categories });
  } catch (err) {
    console.error('[Error] GET /api/refresh:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ========== Vue Router fallback ==========
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

// ========== Error handlers ==========
app.use((err, req, res, _next) => {
  console.error('[Unhandled Error]', req.method, req.originalUrl, err);
  res.status(500).json({ error: '服务器内部错误' });
});

process.on('unhandledRejection', (reason) => console.error('[Unhandled Rejection]', reason));
process.on('uncaughtException', (err) => console.error('[Uncaught Exception]', err));

// ========== Graceful shutdown ==========
function gracefulShutdown(signal) {
  console.log(`\n[server] 收到 ${signal}，正在关闭数据库连接...`);
  try {
    const curDb = getDb();
    curDb.pragma('wal_checkpoint(TRUNCATE)');
    curDb.close();
    console.log('[server] 数据库已安全关闭，WAL 已合并');
  } catch (e) {
    console.error('[server] 关闭数据库时出错:', e.message);
  }
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (process.platform === 'win32') {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// ========== Start ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] 题库管理已启动: http://localhost:${PORT}`);
  console.log(`[server] 当前数据库: ${config.currentPath}`);
});
