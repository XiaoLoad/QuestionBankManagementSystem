#!/usr/bin/env node
/**
 * 数据库初始化脚本
 * 运行此脚本将创建 default.db 并初始化表结构和默认数据。
 * 如果 default.db 已存在，不会覆盖（安全运行）。
 *
 * 用法: node db-init.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { localNow } = require('./utils');

const DB_PATH = path.join(__dirname, 'default.db');

if (fs.existsSync(DB_PATH)) {
  console.log('[db-init] default.db 已存在，跳过初始化。');
  process.exit(0);
}

console.log('[db-init] 正在创建 default.db ...');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS data_questions (
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
    images      TEXT,
    analysis    TEXT,
    ai_answer   TEXT
  );

  CREATE TABLE IF NOT EXISTS data_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    score       INTEGER,
    notes       TEXT,
    created_at  DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_questions_type ON data_questions(type);
  CREATE INDEX IF NOT EXISTS idx_questions_category ON data_questions(category);
  CREATE INDEX IF NOT EXISTS idx_questions_created_at ON data_questions(created_at);
  CREATE INDEX IF NOT EXISTS idx_questions_deleted_at ON data_questions(deleted_at);

  CREATE TABLE IF NOT EXISTS ai_providers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    base_url    TEXT NOT NULL,
    api_key     TEXT NOT NULL,
    model       TEXT DEFAULT '',
    is_default  INTEGER DEFAULT 0,
    enabled     INTEGER DEFAULT 1,
    created_at  DATETIME,
    updated_at  DATETIME
  );

  CREATE TABLE IF NOT EXISTS external_config (
    key         TEXT PRIMARY KEY,
    value       TEXT,
    updated_at  DATETIME
  );

  CREATE TABLE IF NOT EXISTS external_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL,
    content     TEXT NOT NULL,
    type        TEXT,
    result      TEXT NOT NULL,
    answer      TEXT,
    cost_ms     INTEGER,
    created_at  DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_ext_logs_created ON external_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_ext_logs_source ON external_logs(source);

  CREATE TABLE IF NOT EXISTS users (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    username          TEXT NOT NULL UNIQUE,
    password          TEXT NOT NULL,
    role              TEXT NOT NULL DEFAULT 'user',
    display_name      TEXT,
    restriction_mode  TEXT DEFAULT 'allow',
    created_at        DATETIME,
    updated_at        DATETIME,
    last_login_at     DATETIME,
    is_active         INTEGER DEFAULT 1,
    failed_attempts   INTEGER DEFAULT 0,
    locked_until      DATETIME,
    can_use_admin_ai  INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_category_restrictions (
    user_id      INTEGER NOT NULL,
    category     TEXT NOT NULL,
    created_at   DATETIME,
    PRIMARY KEY (user_id, category),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_ai_providers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    name        TEXT NOT NULL,
    base_url    TEXT NOT NULL,
    api_key     TEXT NOT NULL,
    model       TEXT DEFAULT '',
    is_default  INTEGER DEFAULT 0,
    enabled     INTEGER DEFAULT 1,
    created_at  DATETIME,
    updated_at  DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_user_ai_providers_user ON user_ai_providers(user_id);

  CREATE TABLE IF NOT EXISTS site_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT,
    updated_at  DATETIME
  );
`);

// Insert default category
const now = localNow();
db.prepare("INSERT OR IGNORE INTO data_categories (name, created_at) VALUES (?, ?)").run('默认', now);

// Insert default admin user
const adminHash = bcrypt.hashSync('admin123', 10);
db.prepare("INSERT OR IGNORE INTO users (username, password, role, display_name, created_at) VALUES (?, ?, ?, ?, ?)")
  .run('admin', adminHash, 'admin', '管理员', now);

db.close();

console.log('[db-init] default.db 创建完成！');
console.log('[db-init]   - data_questions 表已就绪');
console.log('[db-init]   - data_categories 表已就绪（默认分类）');
console.log('[db-init]   - ai_providers 表已就绪（AI 服务商配置）');
console.log('[db-init]   - external_config 表已就绪（题库对接配置）');
console.log('[db-init]   - external_logs 表已就绪（对接查询日志）');
console.log('[db-init]   - users 表已就绪（用户管理）');
console.log('[db-init]   - site_settings 表已就绪（网站设置）');
console.log('[db-init]   - 默认管理员账号: admin / admin123');
console.log('[db-init]   - 性能索引已创建');
