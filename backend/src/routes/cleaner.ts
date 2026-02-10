import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateBody, validateParams } from '../validations/validate';
import { taskIdParamSchema, servicePointIdParamSchema, completeTaskBodySchema } from '../validations/cleaner';
import multer from 'multer';
import path from 'path';

const router = Router();

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cleaning-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get assigned cleaning tasks (Cleaner only)
router.get('/tasks', authenticateToken, requireRole(['CLEANER']), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // If user.id is empty, user hasn't been created in DB yet - need to create them first
    if (!req.user.id || req.user.id === '') {
      console.warn(`User ${req.user.username} not found in database, attempting to create...`);
      
      // Try to find user by username first
      let dbUser = await prisma.user.findUnique({
        where: { username: req.user.username }
      });

      // If still not found, create user
      if (!dbUser) {
        const defaultRole = req.user.role || 'CLEANER';
        dbUser = await prisma.user.create({
          data: {
            username: req.user.username,
            role: defaultRole as any,
            // Password is not needed as auth is handled by MintAuth
            password: 'N/A' // Placeholder, not used
          }
        });
        console.log(`✅ Created user ${req.user.username} with role ${defaultRole}`);
      }

      // Update req.user.id for this request
      req.user.id = dbUser.id;
    }

    // First, update overdue tasks for this cleaner
    const now = new Date();
    await prisma.cleaningTask.updateMany({
      where: {
        cleanerId: req.user.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        scheduledAt: {
          lt: now
        }
      },
      data: {
        status: 'OVERDUE'
      }
    });

    // Get assigned Point IDs for this cleaner
    const assignments = await prisma.cleanerAssignment.findMany({
      where: { cleanerId: req.user.id },
      select: { servicePointId: true }
    });
    const assignedPointIds = assignments.map(a => a.servicePointId);

    // If no points assigned, return empty array
    if (assignedPointIds.length === 0) {
      return res.json({ tasks: [] });
    }

    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check for existing tasks for today
    const existingTasks = await prisma.cleaningTask.findMany({
      where: {
        cleanerId: req.user.id,
        servicePointId: {
          in: assignedPointIds
        },
        scheduledAt: {
          gte: today,
          lt: tomorrow
        }
      },
      select: {
        servicePointId: true
      }
    });

    const existingTaskPointIds = new Set(existingTasks.map(t => t.servicePointId));

    // Create tasks for assigned points that don't have tasks for today
    const pointsWithoutTasks = assignedPointIds.filter(id => !existingTaskPointIds.has(id));
    
    if (pointsWithoutTasks.length > 0) {
      console.log(`📋 Creating ${pointsWithoutTasks.length} tasks for cleaner ${req.user.username}`);
      
      await prisma.cleaningTask.createMany({
        data: pointsWithoutTasks.map(servicePointId => ({
          servicePointId,
          cleanerId: req.user.id,
          scheduledAt: today,
          status: 'PENDING'
        })),
        skipDuplicates: true
      });
    }

    // Get all tasks (including newly created ones)
    const tasks = await prisma.cleaningTask.findMany({
      where: {
        cleanerId: req.user.id,
        servicePointId: {
          in: assignedPointIds
        },
        scheduledAt: {
          gte: today,
          lt: tomorrow
        },
        status: {
          in: ['PENDING', 'IN_PROGRESS', 'OVERDUE']
        }
      },
      include: {
        servicePoint: {
          include: {
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        scheduledAt: 'asc'
      }
    });

    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Start working on a task (Cleaner only)
router.put('/tasks/:id/start', authenticateToken, requireRole(['CLEANER']), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;

    const task = await prisma.cleaningTask.update({
      where: {
        id,
        cleanerId: req.user.id,
        status: 'PENDING'
      },
      data: {
        status: 'IN_PROGRESS'
      },
      include: {
        servicePoint: true
      }
    });

    res.json({ task });
  } catch (error: any) {
    console.error('Start task error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Task not found or already started' });
    } else {
      res.status(500).json({ error: 'Failed to start task' });
    }
  }
});

// Multer for 3 named photo fields: до уборки, после уборки, повреждения
const uploadThree = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
}).fields([
  { name: 'photoBefore', maxCount: 1 },
  { name: 'photoAfter', maxCount: 1 },
  { name: 'photoDamage', maxCount: 1 }
]);

// Complete a cleaning task with photos (Cleaner only)
// Can complete from PENDING or IN_PROGRESS status. Accepts photoBefore, photoAfter, photoDamage (+ legacy 'photos' array)
router.put('/tasks/:id/complete', authenticateToken, requireRole(['CLEANER']), validateParams(taskIdParamSchema), (req, res, next) => {
  uploadThree(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload error' });
    next();
  });
}, validateBody(completeTaskBodySchema), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;
    const { notes } = req.body;
    const files = req.files as { photoBefore?: Express.Multer.File[]; photoAfter?: Express.Multer.File[]; photoDamage?: Express.Multer.File[] };
    const photoBefore = files?.photoBefore?.[0] ? `/uploads/${files.photoBefore[0].filename}` : null;
    const photoAfter = files?.photoAfter?.[0] ? `/uploads/${files.photoAfter[0].filename}` : null;
    const photoDamage = files?.photoDamage?.[0] ? `/uploads/${files.photoDamage[0].filename}` : null;

    // Find task - allow completion from PENDING or IN_PROGRESS
    const task = await prisma.cleaningTask.findFirst({
      where: {
        id,
        cleanerId: req.user.id,
        status: {
          in: ['PENDING', 'IN_PROGRESS']
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found or already completed' });
    }

    // Update task to completed
    const updatedTask = await prisma.cleaningTask.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        photoBefore: photoBefore || undefined,
        photoAfter: photoAfter || undefined,
        photoDamage: photoDamage || undefined,
        notes: notes || null
      },
      include: {
        servicePoint: {
          include: {
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    res.json({ task: updatedTask });
  } catch (error: any) {
    console.error('Complete task error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Task not found' });
    } else {
      res.status(500).json({ error: 'Failed to complete task' });
    }
  }
});

// Complete task by service point ID (alternative endpoint)
router.put('/complete-by-point/:servicePointId', authenticateToken, requireRole(['CLEANER']), validateParams(servicePointIdParamSchema), (req, res, next) => {
  uploadThree(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload error' });
    next();
  });
}, validateBody(completeTaskBodySchema), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { servicePointId } = req.params;
    const { notes } = req.body;
    const files = req.files as { photoBefore?: Express.Multer.File[]; photoAfter?: Express.Multer.File[]; photoDamage?: Express.Multer.File[] };
    const photoBefore = files?.photoBefore?.[0] ? `/uploads/${files.photoBefore[0].filename}` : null;
    const photoAfter = files?.photoAfter?.[0] ? `/uploads/${files.photoAfter[0].filename}` : null;
    const photoDamage = files?.photoDamage?.[0] ? `/uploads/${files.photoDamage[0].filename}` : null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let task = await prisma.cleaningTask.findFirst({
      where: {
        servicePointId,
        cleanerId: req.user.id,
        scheduledAt: { gte: today, lt: tomorrow },
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      }
    });

    if (!task) {
      task = await prisma.cleaningTask.create({
        data: { servicePointId, cleanerId: req.user.id, scheduledAt: today, status: 'PENDING' }
      });
    }

    const updatedTask = await prisma.cleaningTask.update({
      where: { id: task.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        photoBefore: photoBefore || undefined,
        photoAfter: photoAfter || undefined,
        photoDamage: photoDamage || undefined,
        notes: notes || null
      },
      include: {
        servicePoint: {
          include: {
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    res.json({ task: updatedTask });
  } catch (error: any) {
    console.error('Complete task by point error:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Get task history for cleaner
router.get('/history', authenticateToken, requireRole(['CLEANER']), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // If user.id is empty, user hasn't been created in DB yet - need to create them first
    if (!req.user.id || req.user.id === '') {
      console.warn(`User ${req.user.username} not found in database, attempting to create...`);
      
      // Try to find user by username first
      let dbUser = await prisma.user.findUnique({
        where: { username: req.user.username }
      });

      // If still not found, create user
      if (!dbUser) {
        const defaultRole = req.user.role || 'CLEANER';
        dbUser = await prisma.user.create({
          data: {
            username: req.user.username,
            role: defaultRole as any,
            // Password is not needed as auth is handled by MintAuth
            password: 'N/A' // Placeholder, not used
          }
        });
        console.log(`✅ Created user ${req.user.username} with role ${defaultRole}`);
      }

      // Update req.user.id for this request
      req.user.id = dbUser.id;
    }

    const tasks = await prisma.cleaningTask.findMany({
      where: {
        cleanerId: req.user.id
      },
      include: {
        servicePoint: {
          include: {
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 50 // Limit to last 50 tasks
    });

    res.json({ tasks });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get assigned points for cleaner
router.get('/assigned-points', authenticateToken, requireRole(['CLEANER']), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // If user.id is empty, user hasn't been created in DB yet - need to create them first
    if (!req.user.id || req.user.id === '') {
      console.warn(`User ${req.user.username} not found in database, attempting to create...`);
      
      // Try to find user by username first
      let dbUser = await prisma.user.findUnique({
        where: { username: req.user.username }
      });

      // If still not found, create user
      if (!dbUser) {
        const defaultRole = req.user.role || 'CLEANER';
        dbUser = await prisma.user.create({
          data: {
            username: req.user.username,
            role: defaultRole as any,
            // Password is not needed as auth is handled by MintAuth
            password: 'N/A' // Placeholder, not used
          }
        });
        console.log(`✅ Created user ${req.user.username} with role ${defaultRole}`);
      }

      // Update req.user.id for this request
      req.user.id = dbUser.id;
    }

    const assignments = await prisma.cleanerAssignment.findMany({
      where: { cleanerId: req.user.id },
      include: {
        servicePoint: {
          include: {
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    const servicePoints = assignments.map(a => a.servicePoint);

    res.json({ 
      servicePoints,
      // Backwards compatibility
      atms: servicePoints
    });
  } catch (error) {
    console.error('Get assigned points error:', error);
    res.status(500).json({ error: 'Failed to fetch assigned points' });
  }
});

export default router;
