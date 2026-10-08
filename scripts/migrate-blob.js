#!/usr/bin/env node
/**
 * 数据库迁移脚本：将 options/answers 从 TEXT 转为 BLOB
 * 
 * 问题：question-bank-manager 用 JSON.stringify() 写入 options/answers，
 *       产生 TEXT 类型数据；但 yatori-go-quesbank 的 Go 代码期望 BLOB ([]byte)。
 * 
 * 修复：将现有 TEXT 数据转为 BLOB（Buffer），使 yatori 可以正常读取。
 * 
 * 用法: node migrate-blob.js [数据库路径]
 *       默认路径: ./default.db
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.argv[2] || path.join(__dirname, 'default.db');

console.log(`[migrate] 数据库路径: ${DB_PATH}`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// 统计需要迁移的记录数
const totalRows = db.prepare('SELECT COUNT(*) as cnt FROM data_questions').get().cnt;
console.log(`[migrate] 共 ${totalRows} 条题目记录`);

// 查找 options/answers 为 TEXT 类型的记录
const textOptions = db.prepare("SELECT COUNT(*) as cnt FROM data_questions WHERE typeof(options) = 'text' AND options IS NOT NULL").get().cnt;
const textAnswers = db.prepare("SELECT COUNT(*) as cnt FROM data_questions WHERE typeof(answers) = 'text' AND answers IS NOT NULL").get().cnt;

console.log(`[migrate] options 为 TEXT 的记录: ${textOptions} 条`);
console.log(`[migrate] answers 为 TEXT 的记录: ${textAnswers} 条`);

if (textOptions === 0 && textAnswers === 0) {
  console.log('[migrate] 无需迁移，所有数据已是 BLOB 格式。');
  db.close();
  process.exit(0);
}

// 执行迁移
const migrateOptions = db.prepare(`
  UPDATE data_questions SET options = CAST(options AS BLOB) 
  WHERE typeof(options) = 'text' AND options IS NOT NULL
`);

const migrateAnswers = db.prepare(`
  UPDATE data_questions SET answers = CAST(answers AS BLOB) 
  WHERE typeof(answers) = 'text' AND answers IS NOT NULL
`);

const migrateAll = db.transaction(() => {
  const r1 = migrateOptions.run();
  console.log(`[migrate] 已转换 ${r1.changes} 条 options: TEXT → BLOB`);
  
  const r2 = migrateAnswers.run();
  console.log(`[migrate] 已转换 ${r2.changes} 条 answers: TEXT → BLOB`);
  
  return r1.changes + r2.changes;
});

const totalMigrated = migrateAll();

// 验证迁移结果
const remainingTextOptions = db.prepare("SELECT COUNT(*) as cnt FROM data_questions WHERE typeof(options) = 'text' AND options IS NOT NULL").get().cnt;
const remainingTextAnswers = db.prepare("SELECT COUNT(*) as cnt FROM data_questions WHERE typeof(answers) = 'text' AND answers IS NOT NULL").get().cnt;

console.log(`[migrate] 迁移后剩余 TEXT options: ${remainingTextOptions} 条`);
console.log(`[migrate] 迁移后剩余 TEXT answers: ${remainingTextAnswers} 条`);

if (remainingTextOptions === 0 && remainingTextAnswers === 0) {
  console.log(`[migrate] ✅ 迁移完成！共转换 ${totalMigrated} 个字段。`);
} else {
  console.log(`[migrate] ⚠️ 还有部分数据未转换，请检查。`);
}

db.close();
