import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../validations/validate';
import { loginBodySchema } from '../validations/auth';

const router = Router();

// Login - прокси на MintAuth
router.post('/login', validateBody(loginBodySchema), async (req, res) => {
  try {
    console.log('🔐 FeedbackATM: Login attempt started (proxying to MintAuth)');
    const { username, password } = req.body;

    const mintauthUrl = process.env.MINTAUTH_URL || 'http://mintauth-backend:8000';
    
    try {
      console.log('🔄 Proxying login request to MintAuth:', mintauthUrl);
      
      // Проксируем запрос на MintAuth
      const response = await fetch(`${mintauthUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({ detail: 'Login failed' }));
        console.log('❌ MintAuth login failed:', response.status, errorData.detail);
        return res.status(response.status).json({ 
          error: errorData.detail || 'Invalid credentials' 
        });
      }

      // Копируем все Set-Cookie заголовки от MintAuth
      // Node fetch/undici может не поддерживать headers.raw(), поэтому используем getSetCookie()
      let setCookieHeaders: string[] = [];
      if (typeof (response.headers as any).getSetCookie === 'function') {
        setCookieHeaders = (response.headers as any).getSetCookie() || [];
      } else if (typeof (response.headers as any).raw === 'function') {
        setCookieHeaders = (response.headers as any).raw()['set-cookie'] || [];
      } else {
        const singleCookie = response.headers.get('set-cookie');
        if (singleCookie) {
          setCookieHeaders = [singleCookie];
        }
      }

      if (setCookieHeaders.length > 0) {
        console.log('🍪 Copying cookies from MintAuth:', setCookieHeaders.length, 'cookies');
        res.setHeader('Set-Cookie', setCookieHeaders);
      } else {
        console.warn('⚠️ No Set-Cookie headers received from MintAuth');
      }

      // Возвращаем успешный ответ и данные от MintAuth (если есть)
      // Это позволяет фронту сохранять токены в localStorage как fallback
      let responseData: any = null;
      try {
        responseData = await response.json();
      } catch (error) {
        // Если тело не JSON, продолжаем без него
      }

      console.log('✅ Login successful via MintAuth');
      res.json({
        ...(responseData || {}),
        user: responseData?.user || {
          username: username,
        }
      });
    } catch (error: any) {
      console.error('❌ MintAuth login error:', error);
      return res.status(500).json({ error: 'Failed to connect to authentication service' });
    }
  } catch (error: any) {
    console.error('💥 Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify JWT token (mainly for portal authentication)
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'No user found in token' });
    }

    // Try to find or create user in our database
    let user = await prisma.user.findUnique({
      where: { username: req.user.username },
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

    // If user doesn't exist, create them (auto-provisioning)
    if (!user) {
      // Role comes from MintAuth via middleware (req.user.role)
      const defaultRole = req.user.username === 'admin' ? 'ADMIN' : 'CLEANER';
      const userRole = (req.user.role || defaultRole) as 'ADMIN' | 'PROJECT_LEAD' | 'OPERATIONS_MANAGER' | 'MANAGER' | 'SUPERVISOR' | 'OBSERVER' | 'CLEANER';
      
      user = await prisma.user.create({
        data: {
          username: req.user.username,
          password: '', // Password handled by MintAuth
          role: userRole,
          companyId: req.user.companyId || null
        },
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
    } else {
      // Sync role from MintAuth if it has changed
      if (req.user.role && req.user.role !== user.role) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: req.user.role as 'ADMIN' | 'PROJECT_LEAD' | 'OPERATIONS_MANAGER' | 'MANAGER' | 'SUPERVISOR' | 'OBSERVER' | 'CLEANER' },
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
      }
    }

    res.json({
      admin: user, // Keeping 'admin' for compatibility with FeedbackQR
      user: user
    });
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Alias for /me to match expected /auth/me path
router.get('/auth/me', authenticateToken, (req, res, next) => {
  const handler = router.stack[router.stack.length - 2].handle;
  return handler(req, res, next);
});

export default router;
