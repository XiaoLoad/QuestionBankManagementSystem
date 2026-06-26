const express = require('express');
const bcrypt = require('bcryptjs');
const { localNow } = require('../utils');

/**
 * 用户管理路由工厂函数（仅管理员）
 * @param {Function} getDb - 获取数据库实例的函数
 * @param {Object} helpers - 工具函数
 * @param {Object} auth - 鉴权中间件 { authRequired, adminRequired }
 * @returns {Object} Express Router
 */
module.exports = function (getDb, helpers, auth) {
  const router = express.Router();

  // 所有路由都需要管理员权限
  router.use(auth.adminRequired);

  /**
   * GET /api/users
   * 获取用户列表（含分类限制）
   */
  router.get('/', (req, res) => {
    try {
      const db = getDb();
      const users = db.prepare(`
        SELECT id, username, role, display_name, restriction_mode, created_at, updated_at, last_login_at, is_active
        FROM users
        ORDER BY created_at DESC
      `).all();

      // 附带每个用户的分类限制
      const restrictions = db.prepare('SELECT user_id, category FROM user_category_restrictions').all();
      const restrictionMap = {};
      for (const r of restrictions) {
        if (!restrictionMap[r.user_id]) restrictionMap[r.user_id] = [];
        restrictionMap[r.user_id].push(r.category);
      }

      const result = users.map(u => ({
        ...u,
        restrictedCategories: restrictionMap[u.id] || [],
      }));

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: '获取用户列表失败: ' + err.message });
    }
  });

  /**
   * POST /api/users
   * 创建用户
   */
  router.post('/', (req, res) => {
    try {
      const { username, password, displayName, role, restrictedCategories, restrictionMode } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
      }

      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: '用户名长度应为3-20个字符' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: '密码长度不能少于6位' });
      }

      const validRoles = ['admin', 'user'];
      const userRole = validRoles.includes(role) ? role : 'user';
      const validModes = ['allow', 'block'];
      const userRestrictionMode = validModes.includes(restrictionMode) ? restrictionMode : 'allow';

      const db = getDb();

      // 检查用户名是否已存在
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) {
        return res.status(400).json({ error: '用户名已存在' });
      }

      const hash = bcrypt.hashSync(password, 10);
      const now = localNow();

      const createUser = db.transaction(() => {
        const result = db.prepare(`
          INSERT INTO users (username, password, role, display_name, restriction_mode, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(username, hash, userRole, displayName || username, userRestrictionMode, now, now);

        const userId = result.lastInsertRowid;

        // 写入分类限制
        if (Array.isArray(restrictedCategories) && restrictedCategories.length > 0) {
          const insertRestriction = db.prepare('INSERT OR IGNORE INTO user_category_restrictions (user_id, category, created_at) VALUES (?, ?, ?)');
          for (const cat of restrictedCategories) {
            insertRestriction.run(userId, cat, now);
          }
        }

        return userId;
      });

      const userId = createUser();

      res.json({
        id: userId,
        username,
        role: userRole,
        displayName: displayName || username,
        message: '用户创建成功'
      });
    } catch (err) {
      res.status(500).json({ error: '创建用户失败: ' + err.message });
    }
  });

  /**
   * PUT /api/users/:id
   * 修改用户信息
   */
  router.put('/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { displayName, role, isActive, restrictedCategories, restrictionMode } = req.body;

      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      // 不能修改自己的角色和状态
      if (parseInt(id) === req.user.id) {
        if (role !== undefined && role !== user.role) {
          return res.status(400).json({ error: '不能修改自己的角色' });
        }
        if (isActive !== undefined && isActive !== user.is_active) {
          return res.status(400).json({ error: '不能禁用自己的账号' });
        }
      }

      const validRoles = ['admin', 'user'];
      const updates = [];
      const params = [];

      if (displayName !== undefined) {
        updates.push('display_name = ?');
        params.push(displayName);
      }

      if (role !== undefined && validRoles.includes(role)) {
        updates.push('role = ?');
        params.push(role);
      }

      if (isActive !== undefined) {
        updates.push('is_active = ?');
        params.push(isActive ? 1 : 0);
      }

      if (restrictionMode !== undefined) {
        const validModes = ['allow', 'block'];
        if (validModes.includes(restrictionMode)) {
          updates.push('restriction_mode = ?');
          params.push(restrictionMode);
        }
      }

      const updateUser = db.transaction(() => {
        // 更新用户基本信息
        if (updates.length > 0) {
          updates.push('updated_at = ?');
          params.push(localNow());
          params.push(id);
          db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        }

        // 更新分类限制（传入数组时才更新，不传则不变）
        if (Array.isArray(restrictedCategories)) {
          db.prepare('DELETE FROM user_category_restrictions WHERE user_id = ?').run(id);
          if (restrictedCategories.length > 0) {
            const now = localNow();
            const insertRestriction = db.prepare('INSERT OR IGNORE INTO user_category_restrictions (user_id, category, created_at) VALUES (?, ?, ?)');
            for (const cat of restrictedCategories) {
              insertRestriction.run(id, cat, now);
            }
          }
        }
      });

      updateUser();

      res.json({ message: '用户信息更新成功' });
    } catch (err) {
      res.status(500).json({ error: '修改用户信息失败: ' + err.message });
    }
  });

  /**
   * DELETE /api/users/:id
   * 删除用户（永久删除）
   */
  router.delete('/:id', (req, res) => {
    try {
      const { id } = req.params;

      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      // 不能删除自己
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: '不能删除自己的账号' });
      }

      // 不能删除默认管理员
      if (user.username === 'admin') {
        return res.status(400).json({ error: '不能删除默认管理员账号' });
      }

      // 先清理该用户的活动日志（外键约束）
      db.prepare('DELETE FROM user_activity_logs WHERE user_id = ?').run(id);

      db.prepare('DELETE FROM users WHERE id = ?').run(id);

      res.json({ message: '用户已删除' });
    } catch (err) {
      res.status(500).json({ error: '删除用户失败: ' + err.message });
    }
  });

  /**
   * POST /api/users/:id/reset-password
   * 重置用户密码
   */
  router.post('/:id/reset-password', (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: '新密码长度不能少于6位' });
      }

      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

      if (!user) {
        return res.status(404).json({ error: '用户不存在' });
      }

      const hash = bcrypt.hashSync(newPassword, 10);
      const now = localNow();
      db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?').run(hash, now, id);

      res.json({ message: '密码重置成功' });
    } catch (err) {
      res.status(500).json({ error: '重置密码失败: ' + err.message });
    }
  });

  return router;
};
