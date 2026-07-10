import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AppError } from './error.js';

const ROLE_HIERARCHY = {
  guest: 0,
  user: 1,
  moderator: 2,
  admin: 3,
};

export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = header.slice(7);
    const decoded = verifyToken(token);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    // 无效 token 按游客处理，由 requireAuth 负责拦截受保护路由
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) {
    return next(new AppError(401, 'unauthorized', '未认证，请先登录'));
  }
  next();
}

export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'unauthorized', '未认证，请先登录'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'forbidden', '权限不足'));
    }
    next();
  };
}

export function hasMinimumRole(userRole, requiredRole) {
  return (ROLE_HIERARCHY[userRole] ?? -1) >= (ROLE_HIERARCHY[requiredRole] ?? 99);
}
