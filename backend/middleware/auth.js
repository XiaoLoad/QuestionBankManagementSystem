const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'question-bank-manager-secret-key-2024';

/**
 * 鉴权中间件工厂函数
 * @param {Function} getDb - 获取数据库实例的函数
 * @returns {Object} 包含 authRequired 和 adminRequired 中间件
 */
module.exports = function (getDb) {
  /**
   * 必须登录中间件
   * 解析 JWT token，将用户信息挂载到 req.user
   */
  const authRequired = (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未登录，请先登录' });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET);

      // 查询用户是否存在且启用
      const db = getDb();
      const user = db.prepare('SELECT id, username, role, display_name, is_active FROM users WHERE id = ?').get(decoded.id);

      if (!user) {
        return res.status(401).json({ error: '用户不存在' });
      }

      if (!user.is_active) {
        return res.status(401).json({ error: '账号已被禁用' });
      }

      // 将用户信息挂载到 req 对象
      req.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.display_name
      };

      next();
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: '无效的登录凭证' });
      }
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: '登录已过期，请重新登录' });
      }
      return res.status(500).json({ error: '认证失败' });
    }
  };

  /**
   * 必须是管理员中间件
   * 先验证登录，再检查角色
   */
  const adminRequired = (req, res, next) => {
    authRequired(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '权限不足，需要管理员权限' });
      }
      next();
    });
  };

  return { authRequired, adminRequired, JWT_SECRET };
};
