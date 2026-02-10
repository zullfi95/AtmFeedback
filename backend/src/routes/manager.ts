import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateBody, validateParams } from '../validations/validate';
import {
  taskIdParamSchema,
  createTaskBodySchema,
  updateTaskBodySchema,
  taskCommentBodySchema,
  routeIdParamSchema,
  createRouteBodySchema,
  updateRouteBodySchema,
} from '../validations/manager';
import * as XLSX from 'xlsx';

const router = Router();
// Get all tasks for manager's company (MANAGER, OPERATIONS_MANAGER, PROJECT_LEAD, ADMIN, SUPERVISOR)
router.get('/tasks', authenticateToken, requireRole(['MANAGER', 'OPERATIONS_MANAGER', 'PROJECT_LEAD', 'ADMIN', 'SUPERVISOR', 'OBSERVER']), async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ error: 'Manager not assigned to a company' });
    }

    // First, update overdue tasks
    const now = new Date();
    await prisma.cleaningTask.updateMany({
      where: {
        servicePoint: {
          companyId: req.user.companyId
        },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        scheduledAt: {
          lt: now
        }
      },
      data: {
        status: 'OVERDUE'
      }
    });

    const tasks = await prisma.cleaningTask.findMany({
      where: {
        servicePoint: {
          companyId: req.user.companyId
        }
      },
      include: {
        servicePoint: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true
          }
        },
        cleaner: {
          select: {
            id: true,
            username: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Add comment to completed task (Manager only)
router.put('/tasks/:id/comment', authenticateToken, requireRole(['MANAGER']), validateParams(taskIdParamSchema), validateBody(taskCommentBodySchema), async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ error: 'Manager not assigned to a company' });
    }

    const { id } = req.params;
    const { managerNotes } = req.body;

    // First verify the task belongs to manager's company
    const task = await prisma.cleaningTask.findFirst({
      where: {
        id,
        servicePoint: {
          companyId: req.user.companyId
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found or not in your company' });
    }

    const updatedTask = await prisma.cleaningTask.update({
      where: { id },
      data: {
        managerNotes
      },
      include: {
        servicePoint: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true
          }
        },
        cleaner: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    res.json({ task: updatedTask });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get cleaners for company (ADMIN without companyId gets empty list)
router.get('/cleaners', authenticateToken, requireRole(['MANAGER', 'OPERATIONS_MANAGER', 'PROJECT_LEAD', 'ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    if (!req.user?.companyId) {
      if (req.user?.role === 'ADMIN') {
        const allCleaners = await prisma.user.findMany({
          where: { role: 'CLEANER' },
          select: { id: true, username: true },
          orderBy: { username: 'asc' }
        });
        return res.json({ cleaners: allCleaners });
      }
      return res.status(400).json({ error: 'Not assigned to a company' });
    }

    const cleaners = await prisma.user.findMany({
      where: { role: 'CLEANER', companyId: req.user.companyId },
      select: { id: true, username: true },
      orderBy: { username: 'asc' }
    });

    res.json({ cleaners });
  } catch (error) {
    console.error('Get cleaners error:', error);
    res.status(500).json({ error: 'Failed to fetch cleaners' });
  }
});

// Get company Service Points (Manager only)
router.get('/service-points', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ error: 'Manager not assigned to a company' });
    }

    const servicePoints = await prisma.servicePoint.findMany({
      where: {
        companyId: req.user.companyId
      },
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        latitude: true,
        longitude: true,
        companyId: true,
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

// Create cleaning task for Service Point (Manager only)
router.post('/tasks', authenticateToken, requireRole(['MANAGER']), validateBody(createTaskBodySchema), async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ error: 'Manager not assigned to a company' });
    }

    const { servicePointId, cleanerId, scheduledAt } = req.body;

    // Verify Service Point belongs to manager's company
    const servicePoint = await prisma.servicePoint.findFirst({
      where: {
        id: servicePointId,
        companyId: req.user.companyId
      }
    });

    if (!servicePoint) {
      return res.status(404).json({ error: 'Service Point not found in your company' });
    }

    // Verify cleaner exists and is a cleaner
    const cleaner = await prisma.user.findFirst({
      where: {
        id: cleanerId,
        role: 'CLEANER'
      }
    });

    if (!cleaner) {
      return res.status(404).json({ error: 'Cleaner not found' });
    }

    // Verify Service Point is assigned to this cleaner
    const assignment = await prisma.cleanerAssignment.findFirst({
      where: {
        cleanerId: cleanerId,
        servicePointId: servicePointId
      }
    });

    if (!assignment) {
      return res.status(400).json({ error: 'This Service Point is not assigned to the selected cleaner. Please assign it first.' });
    }

    const task = await prisma.cleaningTask.create({
      data: {
        servicePointId,
        cleanerId,
        scheduledAt: scheduledAt ? (typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt) : null,
        status: 'PENDING'
      },
      include: {
        servicePoint: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true
          }
        },
        cleaner: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    res.status(201).json({ task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update cleaning task (Manager only)
router.put('/tasks/:id', authenticateToken, requireRole(['MANAGER']), validateParams(taskIdParamSchema), validateBody(updateTaskBodySchema), async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ error: 'Manager not assigned to a company' });
    }

    const { id } = req.params;
    const { servicePointId, cleanerId, scheduledAt, status } = req.body;

    // Verify task belongs to manager's company
    const existingTask = await prisma.cleaningTask.findFirst({
      where: {
        id,
        servicePoint: {
          companyId: req.user.companyId
        }
      }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found or not in your company' });
    }

    // If changing Service Point or cleaner, verify assignment
    if (servicePointId && cleanerId && (servicePointId !== existingTask.servicePointId || cleanerId !== existingTask.cleanerId)) {
      const assignment = await prisma.cleanerAssignment.findFirst({
        where: {
          cleanerId: cleanerId,
          servicePointId: servicePointId
        }
      });

      if (!assignment) {
        return res.status(400).json({ error: 'This Service Point is not assigned to the selected cleaner' });
      }
    }

    const updateData: any = {};
    if (servicePointId) updateData.servicePointId = servicePointId;
    if (cleanerId) updateData.cleanerId = cleanerId;
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? (typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt) : null;
    if (status && ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'].includes(status)) {
      updateData.status = status;
    }

    const task = await prisma.cleaningTask.update({
      where: { id },
      data: updateData,
      include: {
        servicePoint: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true
          }
        },
        cleaner: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });

    res.json({ task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete cleaning task (Manager only)
router.delete('/tasks/:id', authenticateToken, requireRole(['MANAGER']), validateParams(taskIdParamSchema), async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ error: 'Manager not assigned to a company' });
    }

    const { id } = req.params;

    // Verify task belongs to manager's company and is in deletable status
    const task = await prisma.cleaningTask.findFirst({
      where: {
        id,
        servicePoint: {
          companyId: req.user.companyId
        },
        status: { in: ['PENDING', 'OVERDUE'] } // Only allow deletion of pending or overdue tasks
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found, not in your company, or cannot be deleted (only PENDING and OVERDUE tasks can be deleted)' });
    }

    await prisma.cleaningTask.delete({
      where: { id }
    });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Get company statistics (Manager only)
router.get('/stats', authenticateToken, requireRole(['MANAGER']), async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ error: 'Manager not assigned to a company' });
    }

    const [totalPoints, totalTasks, completedTasks, pendingTasks] = await Promise.all([
      prisma.servicePoint.count({
        where: { companyId: req.user.companyId }
      }),
      prisma.cleaningTask.count({
        where: {
          servicePoint: { companyId: req.user.companyId }
        }
      }),
      prisma.cleaningTask.count({
        where: {
          servicePoint: { companyId: req.user.companyId },
          status: 'COMPLETED'
        }
      }),
      prisma.cleaningTask.count({
        where: {
          servicePoint: { companyId: req.user.companyId },
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        }
      })
    ]);

    res.json({
      stats: {
        totalPoints,
        totalTasks,
        completedTasks,
        pendingTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : '0'
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Export tasks to Excel or CSV (Manager only)
router.get('/tasks/export', authenticateToken, requireRole(['MANAGER', 'OPERATIONS_MANAGER', 'PROJECT_LEAD', 'ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const format = (req.query.format as string) === 'csv' ? 'csv' : 'excel';
    const companyId = req.user?.companyId;
    if (!companyId && req.user?.role !== 'ADMIN') {
      return res.status(400).json({ error: 'Not assigned to a company' });
    }

    const tasks = await prisma.cleaningTask.findMany({
      where: companyId ? { servicePoint: { companyId } } : {},
      include: {
        servicePoint: { select: { name: true, type: true, address: true } },
        cleaner: { select: { username: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const rows = tasks.map((t: any) => ({
      'Point': t.servicePoint?.name ?? '',
      'Type': t.servicePoint?.type ?? '',
      'Address': t.servicePoint?.address ?? '',
      'Cleaner': t.cleaner?.username ?? '',
      'Status': t.status,
      'Scheduled': t.scheduledAt ? new Date(t.scheduledAt).toISOString() : '',
      'Completed': t.completedAt ? new Date(t.completedAt).toISOString() : ''
    }));

    if (format === 'csv') {
      const keys = rows.length ? Object.keys(rows[0]) : ['Point', 'Type', 'Address', 'Cleaner', 'Status', 'Scheduled', 'Completed'];
      const header = keys.join(',');
      const body = (rows as any[]).map(r => keys.map(k => `"${String((r as any)[k] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=tasks_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(Buffer.from('\uFEFF' + header + '\n' + body, 'utf-8'));
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=tasks_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buf);
  } catch (error) {
    console.error('Export tasks error:', error);
    res.status(500).json({ error: 'Failed to export tasks' });
  }
});

// --- Маршруты (Routes): группировка объектов и назначение клинера ---

// Get all routes for company (ADMIN without companyId gets empty list)
router.get('/routes', authenticateToken, requireRole(['MANAGER', 'OPERATIONS_MANAGER', 'PROJECT_LEAD', 'ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    if (!req.user?.companyId) {
      if (req.user?.role === 'ADMIN') {
        const allRoutes = await prisma.route.findMany({
          include: {
            cleaner: { select: { id: true, username: true } },
            routePoints: {
              orderBy: { orderNum: 'asc' },
              include: {
                servicePoint: { select: { id: true, name: true, type: true, address: true } }
              }
            }
          },
          orderBy: { orderNum: 'asc' }
        });
        return res.json({ routes: allRoutes });
      }
      return res.status(400).json({ error: 'Manager not assigned to a company' });
    }

    const routes = await prisma.route.findMany({
      where: { companyId: req.user.companyId! },
      include: {
        cleaner: { select: { id: true, username: true } },
        routePoints: {
          orderBy: { orderNum: 'asc' },
          include: {
            servicePoint: { select: { id: true, name: true, type: true, address: true } }
          }
        }
      },
      orderBy: { orderNum: 'asc' }
    });

    res.json({ routes });
  } catch (error) {
    console.error('Get routes error:', error);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

// Create route and sync cleaner assignments (объекты могут быть из разных компаний; клинер без привязки к компании)
router.post('/routes', authenticateToken, requireRole(['MANAGER', 'OPERATIONS_MANAGER', 'PROJECT_LEAD', 'ADMIN', 'SUPERVISOR']), validateBody(createRouteBodySchema), async (req, res) => {
  try {
    const effectiveCompanyId = req.user?.companyId ?? null;
    const isAdminNoCompany = req.user?.role === 'ADMIN' && !effectiveCompanyId;

    if (!effectiveCompanyId && !isAdminNoCompany) {
      return res.status(400).json({ error: 'Manager not assigned to a company' });
    }

    const { name, cleanerId, servicePointIds } = req.body;

    const pointIds = Array.isArray(servicePointIds) ? servicePointIds : [];

    // Клинер: только проверяем, что существует и роль CLEANER (привязка к компании не нужна)
    const cleaner = await prisma.user.findFirst({
      where: { id: cleanerId, role: 'CLEANER' }
    });
    if (!cleaner) {
      return res.status(404).json({ error: 'Cleaner not found' });
    }

    // Маршрут хранит companyId только для фильтрации (менеджер видит свои; админ — все). Объекты могут быть из любых компаний.
    const routeCompanyId = effectiveCompanyId ?? null;

    // Проверяем только существование объектов (не привязку к одной компании)
    if (pointIds.length > 0) {
      const points = await prisma.servicePoint.findMany({
        where: { id: { in: pointIds } }
      });
      if (points.length !== pointIds.length) {
        return res.status(400).json({ error: 'Some service points not found' });
      }
    }

    const maxOrder = await prisma.route.findFirst({
      where: routeCompanyId === null ? { companyId: null } : { companyId: routeCompanyId },
      orderBy: { orderNum: 'desc' },
      select: { orderNum: true }
    });
    const orderNum = (maxOrder?.orderNum ?? 0) + 1;

    const route = await prisma.route.create({
      data: {
        name: name.trim(),
        companyId: routeCompanyId,
        cleanerId,
        orderNum
      }
    });

    for (let i = 0; i < pointIds.length; i++) {
      await prisma.routePoint.create({
        data: { routeId: route.id, servicePointId: pointIds[i], orderNum: i }
      });
    }

    // Sync cleaner assignments: replace cleaner's assignments with route points
    await prisma.cleanerAssignment.deleteMany({ where: { cleanerId } });
    if (pointIds.length > 0) {
      await prisma.cleanerAssignment.createMany({
        data: pointIds.map((servicePointId: string) => ({ cleanerId, servicePointId })),
        skipDuplicates: true
      });
    }

    const created = await prisma.route.findUnique({
      where: { id: route.id },
      include: {
        cleaner: { select: { id: true, username: true } },
        routePoints: {
          orderBy: { orderNum: 'asc' },
          include: { servicePoint: { select: { id: true, name: true, type: true, address: true } } }
        }
      }
    });

    res.status(201).json({ route: created });
  } catch (error: any) {
    console.error('Create route error:', error);
    res.status(500).json({ error: error.message || 'Failed to create route' });
  }
});

// Update route and optionally sync cleaner assignments
router.put('/routes/:id', authenticateToken, requireRole(['MANAGER', 'OPERATIONS_MANAGER', 'PROJECT_LEAD', 'ADMIN', 'SUPERVISOR']), validateParams(routeIdParamSchema), validateBody(updateRouteBodySchema), async (req, res) => {
  try {
    const effectiveCompanyId = req.user?.companyId ?? null;
    const isAdminNoCompany = req.user?.role === 'ADMIN' && !effectiveCompanyId;

    const { id } = req.params;
    const { name, cleanerId, servicePointIds } = req.body;

    const existingWhere: any = { id };
    if (!isAdminNoCompany) existingWhere.companyId = effectiveCompanyId;
    const existing = await prisma.route.findFirst({
      where: existingWhere,
      include: { routePoints: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const updateData: any = {};
    if (name?.trim()) updateData.name = name.trim();
    if (cleanerId) {
      const cleaner = await prisma.user.findFirst({
        where: { id: cleanerId, role: 'CLEANER' }
      });
      if (!cleaner) return res.status(404).json({ error: 'Cleaner not found' });
      updateData.cleanerId = cleanerId;
    }

    await prisma.route.update({ where: { id }, data: updateData });

    if (Array.isArray(servicePointIds)) {
      await prisma.routePoint.deleteMany({ where: { routeId: id } });
      const points = await prisma.servicePoint.findMany({
        where: { id: { in: servicePointIds } }
      });
      for (let i = 0; i < servicePointIds.length; i++) {
        const spId = servicePointIds[i];
        if (points.some((p) => p.id === spId)) {
          await prisma.routePoint.create({
            data: { routeId: id, servicePointId: spId, orderNum: i }
          });
        }
      }

      const finalCleanerId = updateData.cleanerId || existing.cleanerId;
      await prisma.cleanerAssignment.deleteMany({ where: { cleanerId: finalCleanerId } });
      if (servicePointIds.length > 0) {
        await prisma.cleanerAssignment.createMany({
          data: servicePointIds.map((servicePointId: string) => ({ cleanerId: finalCleanerId, servicePointId })),
          skipDuplicates: true
        });
      }
    }

    const updated = await prisma.route.findUnique({
      where: { id },
      include: {
        cleaner: { select: { id: true, username: true } },
        routePoints: {
          orderBy: { orderNum: 'asc' },
          include: { servicePoint: { select: { id: true, name: true, type: true, address: true } } }
        }
      }
    });

    res.json({ route: updated });
  } catch (error: any) {
    console.error('Update route error:', error);
    res.status(500).json({ error: error.message || 'Failed to update route' });
  }
});

// Delete route (does not remove cleaner assignments - only removes route grouping)
router.delete('/routes/:id', authenticateToken, requireRole(['MANAGER', 'OPERATIONS_MANAGER', 'PROJECT_LEAD', 'ADMIN', 'SUPERVISOR']), validateParams(routeIdParamSchema), async (req, res) => {
  try {
    const effectiveCompanyId = req.user?.companyId ?? null;
    const isAdminNoCompany = req.user?.role === 'ADMIN' && !effectiveCompanyId;

    const whereRoute: any = { id: req.params.id };
    if (!isAdminNoCompany) whereRoute.companyId = effectiveCompanyId;
    const existing = await prisma.route.findFirst({
      where: whereRoute
    });

    if (!existing) {
      return res.status(404).json({ error: 'Route not found' });
    }

    await prisma.route.delete({ where: { id: req.params.id } });
    res.json({ message: 'Route deleted' });
  } catch (error: any) {
    console.error('Delete route error:', error);
    res.status(500).json({ error: 'Failed to delete route' });
  }
});

// Get dashboard statistics (Manager only)
router.get('/dashboard-stats', authenticateToken, requireRole(['MANAGER', 'OPERATIONS_MANAGER', 'PROJECT_LEAD', 'SUPERVISOR', 'OBSERVER']), async (req, res) => {
  try {
    if (!req.user?.companyId) {
      return res.status(400).json({ error: 'Manager not assigned to a company' });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 1. All service points for company with their status for today
    const servicePoints = await prisma.servicePoint.findMany({
      where: { companyId: req.user.companyId },
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
        }
      }
    });

    // 2. All cleaners for company with their tasks for today
    const cleaners = await prisma.user.findMany({
      where: { 
        role: 'CLEANER',
        companyId: req.user.companyId
      },
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
      prisma.servicePoint.count({ where: { companyId: req.user.companyId } }),
      prisma.cleaningTask.count({
        where: { 
          servicePoint: { companyId: req.user.companyId },
          scheduledAt: { gte: startOfDay, lte: endOfDay } 
        }
      }),
      prisma.cleaningTask.count({
        where: {
          servicePoint: { companyId: req.user.companyId },
          scheduledAt: { gte: startOfDay, lte: endOfDay },
          status: 'COMPLETED'
        }
      })
    ]);

    res.json({
      servicePoints: servicePoints.map(sp => ({
        ...sp,
        todayTask: sp.cleaningTasks[0] || null,
        status: sp.cleaningTasks[0]?.status || 'PENDING'
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

export default router;
