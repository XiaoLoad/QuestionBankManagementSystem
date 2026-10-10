#!/usr/bin/env node
/**
 * 一次性迁移脚本：将运行时数据从项目根目录集中到 data/ 目录
 *
 * 迁移内容：
 *   default.db / default.db-wal / default.db-shm  ->  data/
 *   db-config.json                                ->  data/
 *   databases/*                                   ->  data/databases/
 *   tmp-uploads/*                                 ->  data/tmp-uploads/
 * 并将 db-config.json 中指向旧位置的路径改写为新位置。
 *
 * 用法：node scripts/migrate-data-dir.js
 * 注意：迁移前必须停止正在运行的服务（Windows 下文件被占用无法移动）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

function moveIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.renameSync(src, dest);
  return true;
}

function moveDirContents(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  let count = 0;
  for (const name of fs.readdirSync(srcDir)) {
    fs.renameSync(path.join(srcDir, name), path.join(destDir, name));
    count++;
  }
  if (count > 0) console.log(`  - ${path.relative(ROOT, srcDir)}: 已移动 ${count} 个文件`);
  if (fs.existsSync(srcDir) && fs.readdirSync(srcDir).length === 0) fs.rmdirSync(srcDir);
  return count;
}

// 主流程
if (fs.existsSync(path.join(DATA, 'default.db'))) {
  console.log('[migrate] data/default.db 已存在，无需重复迁移。');
  process.exit(0);
}

try {
  fs.mkdirSync(path.join(DATA, 'databases'), { recursive: true });
  fs.mkdirSync(path.join(DATA, 'tmp-uploads'), { recursive: true });
  console.log('[migrate] 已创建 data/ 目录结构');
} catch (err) {
  console.error('[migrate] 创建 data/ 失败:', err.message);
  process.exit(1);
}

// 1. 数据库文件
for (const f of ['default.db', 'default.db-wal', 'default.db-shm']) {
  const src = path.join(ROOT, f);
  if (moveIfExists(src, path.join(DATA, f))) console.log(`  - ${f} -> data/${f}`);
  else if (f === 'default.db') console.log('  - 根目录未找到 default.db（跳过）');
}

// 2. 配置文件
const oldConfig = path.join(ROOT, 'db-config.json');
const newConfig = path.join(DATA, 'db-config.json');
const configMoved = moveIfExists(oldConfig, newConfig);
if (configMoved) console.log('  - db-config.json -> data/db-config.json');

// 3. 上传数据库与临时文件
moveDirContents(path.join(ROOT, 'databases'), path.join(DATA, 'databases'));
moveDirContents(path.join(ROOT, 'tmp-uploads'), path.join(DATA, 'tmp-uploads'));

// 4. 改写 db-config.json 中指向旧根目录的路径
if (configMoved) {
  try {
    const config = JSON.parse(fs.readFileSync(newConfig, 'utf8'));
    const rewrite = (p) => {
      if (typeof p !== 'string') return p;
      if (p.startsWith(path.join(ROOT, 'databases'))) {
        return path.join(DATA, 'databases', p.slice(path.join(ROOT, 'databases').length + 1));
      }
      if (p === path.join(ROOT, 'default.db')) return path.join(DATA, 'default.db');
      return p;
    };
    if (config.currentPath) config.currentPath = rewrite(config.currentPath);
    if (Array.isArray(config.recentPaths)) config.recentPaths = config.recentPaths.map(rewrite);
    fs.writeFileSync(newConfig, JSON.stringify(config, null, 2));
    console.log(`  - currentPath 已改写为: ${config.currentPath}`);
  } catch (err) {
    console.error('[migrate] 改写 db-config.json 失败:', err.message);
    process.exit(1);
  }
}

console.log('');
console.log('[migrate] 迁移完成。现在可以启动服务: yarn start');
