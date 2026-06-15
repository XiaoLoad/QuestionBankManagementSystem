const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { localNow } = require('../utils');

/**
 * 认证路由工厂函数
 * @param {Function} getDb - 获取数据库实例的函数
 * @param {Object} helpers - 工具函数
 * @param {Object} auth - 鉴权中间件 { authRequired, adminRequired, JWT_SECRET }
 * @returns {Object} Express Router
 */
module.exports = function (getDb, helpers, auth) {
  const router = express.Router();

  /**
   * POST /api/auth/login
   * 用户登录
   */
  router.post('/login', (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
      }

      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

      if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      if (!user.is_active) {
        return res.status(401).json({ error: '账号已被禁用，请联系管理员' });
      }

      const validPassword = bcrypt.compareSync(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      // 生成 JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        auth.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // 更新最后登录时间
      const now = localNow();
      db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id);

      // 记录登录日志
      try {
        db.prepare('INSERT INTO user_activity_logs (user_id, action, created_at) VALUES (?, ?, ?)')
          .run(user.id, 'login', now);
      } catch {}

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          displayName: user.display_name
        }
      });
    } catch (err) {
      res.status(500).json({ error: '登录失败: ' + err.message });
    }
  });

  /**
   * GET /api/auth/me
   * 获取当前登录用户信息
   */
  router.get('/me', auth.authRequired, (req, res) => {
    try {
      res.json({ user: req.user });
    } catch (err) {
      res.status(500).json({ error: '获取用户信息失败: ' + err.message });
    }
  });

  /**
   * POST /api/auth/change-password
   * 修改密码
   */
  router.post('/change-password', auth.authRequired, (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: '旧密码和新密码不能为空' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: '新密码长度不能少于6位' });
      }

      const db = getDb();
      const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);

      const validPassword = bcrypt.compareSync(oldPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: '旧密码错误' });
      }

      const hash = bcrypt.hashSync(newPassword, 10);
      const now = localNow();
      db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?').run(hash, now, req.user.id);

      res.json({ message: '密码修改成功' });
    } catch (err) {
      res.status(500).json({ error: '修改密码失败: ' + err.message });
    }
  });

  return router;
};
