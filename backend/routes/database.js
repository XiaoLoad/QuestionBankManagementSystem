const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = function (getDb, setDb, helpers, ctx) {
  const { sendError } = helpers;
  const { config, DEFAULT_DB_PATH, UPLOADS_DIR, TMP_DIR, isSQLiteFile, openDatabase, getDbStats, loadConfig, saveConfig } = ctx;
  const router = express.Router();

  const upload = multer({
    dest: TMP_DIR,
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.originalname.endsWith('.db') || file.mimetype === 'application/octet-stream' || file.mimetype === 'application/x-sqlite3') {
        cb(null, true);
      } else {
        cb(new Error('只允许上传 .db 文件'));
      }
    },
  });

  // ========== Shared helpers ==========

  function updateRecentPaths(newPath) {
    const recent = (config.recentPaths || []).filter(p => p !== newPath);
    recent.unshift(newPath);
    config.recentPaths = recent.slice(0, 10);
  }

  function buildDbResponse(message, dbPath) {
    const stats = getDbStats(getDb());
    let fileSize = 0;
    try { fileSize = fs.statSync(dbPath).size; } catch {}
    return { message, currentPath: dbPath, recentPaths: config.recentPaths, fileSize, ...stats };
  }

  function closeCurrentDb() {
    try {
      const curDb = getDb();
      curDb.pragma('wal_checkpoint(TRUNCATE)');
      curDb.close();
    } catch (closeErr) {
      console.error('[db] 关闭旧数据库出错:', closeErr.message);
    }
  }

  function switchTo(newDb, newPath) {
    setDb(newDb);
    config.currentPath = newPath;
    updateRecentPaths(newPath);
    saveConfig(config);
  }

  // ========== Routes ==========

  // GET /api/database — current db info
  router.get('/', (req, res) => {
    try {
      const cfg = loadConfig();
      const dbPath = cfg.currentPath;
      let fileSize = 0;
      try { fileSize = fs.statSync(dbPath).size; } catch {}
      const stats = getDbStats(getDb());
      res.json({ currentPath: dbPath, recentPaths: cfg.recentPaths || [], fileSize, ...stats });
    } catch (err) {
      sendError(res, err, 'GET /api/database');
    }
  });

  // POST /api/database/switch — switch to another db
  router.post('/switch', (req, res) => {
    try {
      const { dbPath: newPath } = req.body;
      if (!newPath || typeof newPath !== 'string') {
        return res.status(400).json({ error: '请提供数据库文件路径' });
      }
      const absPath = path.isAbsolute(newPath) ? newPath : path.join(__dirname, '..', newPath);
      if (!fs.existsSync(absPath)) {
        return res.status(400).json({ error: '数据库文件不存在，请使用「新建数据库」功能创建' });
      }
      if (absPath === config.currentPath) {
        return res.status(400).json({ error: '该数据库已是当前使用的数据库' });
      }
      if (!isSQLiteFile(absPath)) {
        return res.status(400).json({ error: '该文件不是合法的 SQLite 数据库' });
      }
      let newDb;
      try { newDb = openDatabase(absPath); } catch (openErr) {
        return res.status(400).json({ error: `数据库打开失败: ${openErr.message}` });
      }
      closeCurrentDb();
      switchTo(newDb, absPath);
      console.log(`[server] 数据库已切换至: ${absPath}`);
      res.json(buildDbResponse('数据库切换成功', absPath));
    } catch (err) {
      sendError(res, err, 'POST /api/database/switch');
    }
  });

  // POST /api/database/create — create a new empty db and switch to it
  router.post('/create', (req, res) => {
    try {
      const { dbPath: newPath } = req.body;
      if (!newPath || typeof newPath !== 'string') {
        return res.status(400).json({ error: '请提供数据库文件路径' });
      }
      const absPath = path.isAbsolute(newPath) ? newPath : path.join(__dirname, '..', newPath);
      if (fs.existsSync(absPath)) {
        return res.status(400).json({ error: '该文件已存在，请使用「切换数据库」功能' });
      }
      const dir = path.dirname(absPath);
      if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch (mkdirErr) {
          return res.status(400).json({ error: `无法创建目录: ${mkdirErr.message}` });
        }
      }
      let newDb;
      try { newDb = openDatabase(absPath); } catch (createErr) {
        return res.status(500).json({ error: `创建数据库失败: ${createErr.message}` });
      }
      closeCurrentDb();
      switchTo(newDb, absPath);
      console.log(`[server] 新建数据库并切换至: ${absPath}`);
      res.json(buildDbResponse('数据库创建成功', absPath));
    } catch (err) {
      sendError(res, err, 'POST /api/database/create');
    }
  });

  // POST /api/database/upload — upload a .db file and switch to it
  router.post('/upload', upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '请上传 .db 文件' });
      }
      const uploadedPath = req.file.path;
      const originalName = req.query.desiredName || req.file.originalname;

      if (!isSQLiteFile(uploadedPath)) {
        try { fs.unlinkSync(uploadedPath); } catch {}
        return res.status(400).json({ error: '该文件不是合法的 SQLite 数据库' });
      }

      const safeName = originalName.replace(/[^a-zA-Z0-9_\-\.一-龥]/g, '_');
      const targetPath = path.join(UPLOADS_DIR, safeName);
      try {
        fs.copyFileSync(uploadedPath, targetPath);
        fs.unlinkSync(uploadedPath);
      } catch (copyErr) {
        try { fs.unlinkSync(uploadedPath); } catch {}
        return res.status(500).json({ error: `保存数据库文件失败: ${copyErr.message}` });
      }

      closeCurrentDb();

      let newDb;
      try { newDb = openDatabase(targetPath); } catch (openErr) {
        return res.status(400).json({ error: `数据库打开失败: ${openErr.message}` });
      }

      switchTo(newDb, targetPath);
      console.log(`[server] 上传数据库并切换至: ${targetPath}`);
      res.json(buildDbResponse('数据库上传并切换成功', targetPath));
    } catch (err) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      sendError(res, err, 'POST /api/database/upload');
    }
  });

  // POST /api/database/reset — switch back to default db
  router.post('/reset', (req, res) => {
    try {
      if (config.currentPath === DEFAULT_DB_PATH) {
        return res.status(400).json({ error: '当前已是默认数据库' });
      }
      closeCurrentDb();
      let newDb;
      try { newDb = openDatabase(DEFAULT_DB_PATH); } catch (openErr) {
        return res.status(500).json({ error: `打开默认数据库失败: ${openErr.message}` });
      }
      switchTo(newDb, DEFAULT_DB_PATH);
      console.log(`[server] 已切回默认数据库: ${DEFAULT_DB_PATH}`);
      res.json(buildDbResponse('已切回默认数据库', DEFAULT_DB_PATH));
    } catch (err) {
      sendError(res, err, 'POST /api/database/reset');
    }
  });

  // DELETE /api/database/recent — remove a path from recent list and delete the file
  router.delete('/recent', (req, res) => {
    try {
      const { dbPath: removePath, deleteFile } = req.body;
      if (!removePath || typeof removePath !== 'string') {
        return res.status(400).json({ error: '请提供要删除的数据库路径' });
      }
      if (removePath === config.currentPath) {
        return res.status(400).json({ error: '不能删除当前正在使用的数据库' });
      }
      const recent = (config.recentPaths || []).filter(p => p !== removePath);
      config.recentPaths = recent;
      saveConfig(config);

      // Delete the actual file if requested and it's in the databases/ directory
      let fileDeleted = false;
      if (deleteFile && removePath !== DEFAULT_DB_PATH) {
        try {
          const uploadsAbs = path.resolve(UPLOADS_DIR);
          const removeAbs = path.resolve(removePath);
          if (removeAbs.startsWith(uploadsAbs + path.sep) && fs.existsSync(removeAbs)) {
            fs.unlinkSync(removeAbs);
            fileDeleted = true;
          }
        } catch (delErr) {
          console.error('[db] 删除数据库文件失败:', delErr.message);
        }
      }

      res.json({
        message: fileDeleted ? '已从列表中移除并删除文件' : '已从列表中移除',
        recentPaths: recent,
      });
    } catch (err) {
      sendError(res, err, 'DELETE /api/database/recent');
    }
  });

  return router;
};
