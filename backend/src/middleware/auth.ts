import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
        companyId?: string;
      };
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  // Try to get token from Authorization header or cookie
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔑 [FeedbackATM] Token from Authorization header');
    }
  }

  // If no header, check cookies (for portal integration)
  if (!token && req.headers.cookie) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🍪 [FeedbackATM] Checking cookies');
    }
    const cookies = req.headers.cookie.split(';').reduce((acc: any, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {});
    token = cookies['mint_session'];
    if (process.env.NODE_ENV !== 'production') {
      if (token) {
        console.log('✅ [FeedbackATM] Token found in cookie mint_session');
      } else {
        console.log('❌ [FeedbackATM] Token not found in cookie mint_session. Available cookies:', Object.keys(cookies));
      }
    }
  } else if (!token && process.env.NODE_ENV !== 'production') {
    console.log('❌ [FeedbackATM] No Authorization header and no cookies');
  }

  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('❌ [FeedbackATM] No token found, returning 401');
    }
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Security: Require JWT_SECRET to be set, no fallback
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('❌ FATAL: JWT_SECRET environment variable is required but not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as any;

    // Check if it's an access token
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type. Access token required.' });
    }

    // MintAuth uses 'sub' for username, we need to adapt this
    const username = decoded.sub || decoded.username;

    if (!username) {
      return res.status(403).json({ error: 'Invalid token: no username' });
    }

    // Get user role from MintAuth
    let roleFromMintAuth: string | null = null;
    let isAdminInMintAuth = false;
    const mintauthUrl = process.env.MINTAUTH_URL || 'http://mintauth-backend:8000';
    
    try {
      const response = await fetch(`${mintauthUrl}/auth/user-projects?username=${encodeURIComponent(username)}`);
      if (response.ok) {
        const data = await response.json() as { is_admin?: boolean; projects?: Array<{ project_name: string; role: string }> };
        // Check if user is admin in MintAuth - admins get ADMIN role automatically
        isAdminInMintAuth = data.is_admin === true;
        if (isAdminInMintAuth) {
          roleFromMintAuth = 'ADMIN';
        } else {
          // Find FeedbackATM project
          const feedbackAtmProject = data.projects?.find((p) => p.project_name === 'FeedbackATM');
          if (feedbackAtmProject) {
            roleFromMintAuth = feedbackAtmProject.role;
          }
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Failed to fetch user projects from MintAuth:', error);
      }
      // Continue with default role if MintAuth is unavailable
    }

    // Get user from database to get their role
    const dbUser = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        role: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (dbUser) {
      // User exists in database, use role from MintAuth if available, otherwise use DB role
      req.user = {
        id: dbUser.id,
        username: dbUser.username,
        role: roleFromMintAuth || dbUser.role,
        companyId: dbUser.companyId
      };
      
      // Check if user is active (if field exists, or via MintAuth)
      // For now, we rely on MintAuth /auth/user-projects which would fail if user is inactive
    } else {
      // User doesn't exist yet - will be created in /auth/verify
      // Use role from MintAuth if available, otherwise default
      const defaultRole = roleFromMintAuth || (username === 'admin' ? 'ADMIN' : 'CLEANER');
      req.user = {
        id: '', // Will be set after creation
        username: username,
        role: defaultRole,
        companyId: undefined
      };
    }

    next();
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('JWT verification failed:', (error as Error).message);
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc: any, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {});
    token = cookies['mint_session'];
  }

  if (token) {
    try {
      // Security: Require JWT_SECRET to be set, no fallback
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('❌ FATAL: JWT_SECRET environment variable is required but not set');
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Invalid token in optional auth: JWT_SECRET not configured');
        }
        return next();
      }
      
      const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as any;
      req.user = {
        id: decoded.sub || decoded.id || decoded.userId || String(decoded.user_id),
        username: decoded.sub || decoded.username,
        role: decoded.role || 'USER',
        companyId: decoded.companyId
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Invalid token in optional auth:', (error as Error).message);
      }
    }
  }

  next();
};
