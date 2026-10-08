const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { localNow } = require('../utils');

// 登录锁定配置
const LOCKOUT_CONFIG = {
  maxAttempts: 5,           // 最大失败次数
  lockDuration: 15 * 60,    // 锁定时长（秒），15分钟
  delayIncrement: 2,        // 每次失败增加的延迟（秒）
  maxDelay: 10,             // 最大延迟（秒）
};

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
   * 用户登录（支持账号锁定）
   */
  router.post('/login', (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
      }

      const db = getDb();
      const now = new Date();
      const nowStr = localNow();

      // 查询用户（包含锁定信息）
      const user = db.prepare(
        'SELECT id, username, password, role, display_name, is_active, failed_attempts, locked_until FROM users WHERE username = ?'
      ).get(username);

      if (!user) {
        // 用户名不存在也返回相同错误，防止用户名枚举
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      // 检查账号是否被锁定
      if (user.locked_until) {
        const lockTime = new Date(user.locked_until);
        if (now < lockTime) {
          const remainingSeconds = Math.ceil((lockTime - now) / 1000);
          const remainingMinutes = Math.ceil(remainingSeconds / 60);
          return res.status(423).json({
            error: `账号已锁定，请 ${remainingMinutes} 分钟后再试`,
            locked_until: user.locked_until,
          });
        } else {
          // 锁定已过期，重置失败次数
          db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
          user.failed_attempts = 0;
          user.locked_until = null;
        }
      }

      if (!user.is_active) {
        return res.status(401).json({ error: '账号已被禁用，请联系管理员' });
      }

      const validPassword = bcrypt.compareSync(password, user.password);
      if (!validPassword) {
        // 密码错误，增加失败次数
        const newAttempts = (user.failed_attempts || 0) + 1;
        let lockUntil = null;
        let errorMsg = '用户名或密码错误';

        if (newAttempts >= LOCKOUT_CONFIG.maxAttempts) {
          // 达到最大失败次数，锁定账号
          lockUntil = new Date(now.getTime() + LOCKOUT_CONFIG.lockDuration * 1000).toISOString();
          const lockMinutes = LOCKOUT_CONFIG.lockDuration / 60;
          errorMsg = `密码错误次数过多，账号已锁定 ${lockMinutes} 分钟`;
          db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?')
            .run(newAttempts, lockUntil, user.id);
        } else {
          // 未达到锁定次数，记录失败
          db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?')
            .run(newAttempts, user.id);
          // 计算渐进延迟
          const delay = Math.min(newAttempts * LOCKOUT_CONFIG.delayIncrement, LOCKOUT_CONFIG.maxDelay);
          errorMsg = `用户名或密码错误（还可尝试 ${LOCKOUT_CONFIG.maxAttempts - newAttempts} 次）`;
        }

        // 记录失败日志
        try {
          db.prepare('INSERT INTO user_activity_logs (user_id, action, details, created_at) VALUES (?, ?, ?, ?)')
            .run(user.id, 'login_failed', `尝试次数: ${newAttempts}`, nowStr);
        } catch {}

        // 渐进延迟（同步等待）
        if (!lockUntil) {
          const delayMs = Math.min(user.failed_attempts * LOCKOUT_CONFIG.delayIncrement * 1000, LOCKOUT_CONFIG.maxDelay * 1000);
          // 使用 Atomics.wait 实现同步延迟
          const sab = new SharedArrayBuffer(4);
          const int32 = new Int32Array(sab);
          Atomics.wait(int32, 0, 0, delayMs);
        }

        return res.status(401).json({ error: errorMsg });
      }

      // 登录成功，重置失败次数
      if (user.failed_attempts > 0) {
        db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
      }

      // 生成 JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        auth.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // 更新最后登录时间
      db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowStr, user.id);

      // 记录登录日志
      try {
        db.prepare('INSERT INTO user_activity_logs (user_id, action, created_at) VALUES (?, ?, ?)')
          .run(user.id, 'login', nowStr);
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
