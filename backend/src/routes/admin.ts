import { Router } from 'express';
import { UserRole, ServicePointType } from '@prisma/client';
import { prisma } from '../db';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateBody, validateParams } from '../validations/validate';
import {
  createUserBodySchema,
  updateUserBodySchema,
  userIdParamSchema,
  createCompanyBodySchema,
  updateCompanyBodySchema,
  companyIdParamSchema,
  createServicePointBodySchema,
  updateServicePointBodySchema,
  servicePointIdParamSchema,
  assignPointsBodySchema,
} from '../validations/admin';
import bcrypt from 'bcryptjs';
import { createUserInMintAuth, updateUserInMintAuth, deleteUserFromMintAuth, getTokenFromRequest } from '../utils/mintauthSync';
import { buildTasksExcel, buildReportPdf, buildReportZip } from '../utils/reportExport';

const router = Router();

// Get all users (Admin only)
router.get('/users', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true
          }
        },
        assignedPoints: {
          select: {
            servicePoint: {
              select: {
                id: true,
                name: true,
                type: true,
                address: true
              }
            }
          }
        },
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user (ADMIN, PROJECT_LEAD only)
router.post('/users', authenticateToken, requireRole(['ADMIN', 'PROJECT_LEAD']), validateBody(createUserBodySchema), async (req, res) => {
  try {
    const { username, email, password, role, companyId } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email: email || undefined,
        password: hashedPassword,
        role: role as UserRole,
        companyId: companyId || null
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        companyId: true,
        createdAt: true
      }
    });

    // Sync user to MintAuth in the background
    const adminToken = getTokenFromRequest(req);
    createUserInMintAuth({
      username: user.username,
      email: user.email || undefined,
      password, // Use plain password for MintAuth
      role: user.role,
      adminToken
    }).catch(err => {
      console.error('Background MintAuth sync failed:', err);
      // Don't fail the request if MintAuth sync fails
    });

    res.status(201).json({ user });
  } catch (error: any) {
    console.error('Create user error:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

// Update user (ADMIN, PROJECT_LEAD only)
router.put('/users/:id', authenticateToken, requireRole(['ADMIN', 'PROJECT_LEAD']), validateParams(userIdParamSchema), validateBody(updateUserBodySchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, companyId } = req.body;

    // Get current user data to get username for MintAuth sync
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: { username: true }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        username,
        email,
        role: role as UserRole,
        companyId: companyId || null
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        companyId: true,
        createdAt: true
      }
    });

    // Sync user update to MintAuth in the background
    const adminToken = getTokenFromRequest(req);
    updateUserInMintAuth({
      username: currentUser.username, // Use old username to find user in MintAuth
      email: user.email || undefined,
      role: user.role,
      adminToken
    }).catch(err => {
      console.error('Background MintAuth sync failed:', err);
      // Don't fail the request if MintAuth sync fails
    });

    res.json({ user });
  } catch (error: any) {
    console.error('Update user error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
    } else if (error.code === 'P2002') {
      res.status(409).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
});

// Delete user (ADMIN, PROJECT_LEAD only)
router.delete('/users/:id', authenticateToken, requireRole(['ADMIN', 'PROJECT_LEAD']), validateParams(userIdParamSchema), async (req, res) => {
  try {
    const { id } = req.params;

    // Get user data before deletion for MintAuth sync
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      select: { username: true }
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.user.delete({
      where: { id }
    });

    // Sync user deletion to MintAuth in the background
    const adminToken = getTokenFromRequest(req);
    deleteUserFromMintAuth(userToDelete.username, adminToken).catch(err => {
      console.error('Background MintAuth sync failed:', err);
      // Don't fail the request if MintAuth sync fails
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
});

// Get all companies
router.get('/companies', authenticateToken, requireRole(['ADMIN', 'PROJECT_LEAD']), async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        _count: {
          select: {
            users: true,
            servicePoints: true
          }
        },
        servicePoints: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true
          }
        },
        users: {
          select: {
            id: true,
            username: true,
            role: true,
            assignedPoints: {
              select: {
                servicePoint: {
                  select: {
                    id: true,
                    name: true,
                    type: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ companies });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Create company (Admin only)
router.post('/companies', authenticateToken, requireRole(['ADMIN']), validateBody(createCompanyBodySchema), async (req, res) => {
  try {
    const { name, description, address } = req.body;

    const company = await prisma.company.create({
      data: {
        name,
        description,
        address
      }
    });

    res.status(201).json({ company });
  } catch (error: any) {
    console.error('Create company error:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Company name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create company' });
    }
  }
});

// Update company (Admin only)
router.put('/companies/:id', authenticateToken, requireRole(['ADMIN']), validateParams(companyIdParamSchema), validateBody(updateCompanyBodySchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, address } = req.body;

    const company = await prisma.company.update({
      where: { id },
      data: {
        name,
        description,
        address
      }
    });

    res.json({ company });
  } catch (error: any) {
    console.error('Update company error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Company not found' });
    } else {
      res.status(500).json({ error: 'Failed to update company' });
    }
  }
});

// Delete company (Admin only)
router.delete('/companies/:id', authenticateToken, requireRole(['ADMIN']), validateParams(companyIdParamSchema), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.company.delete({
      where: { id }
    });

    res.json({ message: 'Company deleted successfully' });
  } catch (error: any) {
    console.error('Delete company error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Company not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete company' });
    }
  }
});

// Get all Service Points
router.get('/service-points', authenticateToken, requireRole(['ADMIN', 'PROJECT_LEAD']), async (req, res) => {
  try {
    const servicePoints = await prisma.servicePoint.findMany({
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            cleaningTasks: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ servicePoints });
  } catch (error) {
    console.error('Get service points error:', error);
    res.status(500).json({ error: 'Failed to fetch service points' });
  }
});

// Create Service Point (Admin only)
router.post('/service-points', authenticateToken, requireRole(['ADMIN']), validateBody(createServicePointBodySchema), async (req, res) => {
  try {
    const { name, type, address, latitude, longitude, companyId } = req.body;

    const servicePoint = await prisma.servicePoint.create({
      data: {
        name,
        type: (type as ServicePointType) || ServicePointType.ATM,
        address,
        latitude,
        longitude,
        companyId
      },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json({ servicePoint });
  } catch (error) {
    console.error('Create service point error:', error);
    res.status(500).json({ error: 'Failed to create service point' });
  }
});

// Update Service Point (Admin only)
router.put('/service-points/:id', authenticateToken, requireRole(['ADMIN']), validateParams(servicePointIdParamSchema), validateBody(updateServicePointBodySchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, address, latitude, longitude, companyId } = req.body;

    const servicePoint = await prisma.servicePoint.update({
      where: { id },
      data: {
        name,
        type: type ? (type as ServicePointType) : undefined,
        address,
        latitude: latitude !== undefined ? latitude : undefined,
        longitude: longitude !== undefined ? longitude : undefined,
        companyId
      },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.json({ servicePoint });
  } catch (error: any) {
    console.error('Update service point error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Service point not found' });
    } else {
      res.status(500).json({ error: 'Failed to update service point' });
    }
  }
});

// Delete Service Point (Admin only)
router.delete('/service-points/:id', authenticateToken, requireRole(['ADMIN']), validateParams(servicePointIdParamSchema), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.servicePoint.delete({
      where: { id }
    });

    res.json({ message: 'Service point deleted successfully' });
  } catch (error: any) {
    console.error('Delete service point error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Service point not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete service point' });
    }
  }
});

// Assign points to cleaner (Admin only)
router.post('/users/:id/assign-points', authenticateToken, requireRole(['ADMIN']), validateParams(userIdParamSchema), validateBody(assignPointsBodySchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { pointIds } = req.body;

    // Verify user is a cleaner
    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'CLEANER') {
      return res.status(400).json({ error: 'Can only assign points to cleaners' });
    }

    // Delete existing assignments
    await prisma.cleanerAssignment.deleteMany({
      where: { cleanerId: id }
    });

    // Create new assignments
    if (pointIds.length > 0) {
      await prisma.cleanerAssignment.createMany({
        data: pointIds.map((servicePointId: string) => ({
          cleanerId: id,
          servicePointId
        })),
        skipDuplicates: true
      });
    }

    // Return updated user with assigned points
    const updatedUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
        assignedPoints: {
          select: {
            servicePoint: {
              select: {
                id: true,
                name: true,
                type: true,
                address: true
              }
            }
          }
        }
      }
    });

    res.json({ user: updatedUser });
  } catch (error: any) {
    console.error('Assign points error:', error);
    res.status(500).json({ error: 'Failed to assign points' });
  }
});

// Get assigned points for cleaner (Admin only)
router.get('/users/:id/assigned-points', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    const assignments = await prisma.cleanerAssignment.findMany({
      where: { cleanerId: id },
      select: {
        servicePoint: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
            latitude: true,
            longitude: true,
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

    res.json({ servicePoints: assignments.map(a => a.servicePoint) });
  } catch (error) {
    console.error('Get assigned points error:', error);
    res.status(500).json({ error: 'Failed to fetch assigned points' });
  }
});

// Get dashboard statistics (Admin only)
router.get('/dashboard-stats', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 1. All service points with their status for today
    const servicePoints = await prisma.servicePoint.findMany({
      include: {
        company: { select: { id: true, name: true } },
        cleaningTasks: {
          where: {
            scheduledAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            cleaner: { select: { id: true, username: true } }
          }
        },
        cleanerAssignments: {
          include: {
            cleaner: { select: { id: true, username: true } }
          }
        }
      }
    });

    // 2. All cleaners with their tasks for today
    const cleaners = await prisma.user.findMany({
      where: { role: UserRole.CLEANER },
      select: {
        id: true,
        username: true,
        company: { select: { id: true, name: true } },
        cleaningTasks: {
          where: {
            scheduledAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          include: {
            servicePoint: { select: { id: true, name: true, type: true, address: true } }
          }
        }
      }
    });

    // 3. General stats
    const [totalPoints, totalTasks, completedTasks] = await Promise.all([
      prisma.servicePoint.count(),
      prisma.cleaningTask.count({
        where: { scheduledAt: { gte: startOfDay, lte: endOfDay } }
      }),
      prisma.cleaningTask.count({
        where: {
          scheduledAt: { gte: startOfDay, lte: endOfDay },
          status: 'COMPLETED'
        }
      })
    ]);

    res.json({
      servicePoints: servicePoints.map(sp => ({
        ...sp,
        todayTask: sp.cleaningTasks[0] || null,
        status: sp.cleaningTasks[0]?.status || 'PENDING',
        assignedCleaners: sp.cleanerAssignments.map(ca => ca.cleaner)
      })),
      cleaners: cleaners.map(c => ({
        ...c,
        todayTasks: c.cleaningTasks
      })),
      stats: {
        totalPoints,
        todayTotalTasks: totalTasks,
        todayCompletedTasks: completedTasks,
        todayPendingTasks: totalTasks - completedTasks
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Export reports: Excel, PDF, ZIP (Admin only)
router.get('/reports/export', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const format = String(req.query.format || 'excel').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'excel' || format === 'xlsx') {
      const buf = await buildTasksExcel(prisma);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=report_${dateStr}.xlsx`);
      return res.send(buf);
    }

    if (format === 'pdf') {
      const buf = await buildReportPdf(prisma);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=report_${dateStr}.pdf`);
      return res.send(buf);
    }

    if (format === 'zip' || format === 'rar') {
      const buf = await buildReportZip(prisma);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=report_${dateStr}.zip`);
      return res.send(buf);
    }

    return res.status(400).json({ error: 'Invalid format. Use excel, pdf, or zip' });
  } catch (error) {
    console.error('Reports export error:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

export default router;
