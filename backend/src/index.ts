import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { prisma } from './db';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());

// Trust proxy for rate limiting (important for nginx proxy)
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'feedbackatm-backend' });
});

// Routes
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import cleanerRoutes from './routes/cleaner';
import managerRoutes from './routes/manager';

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cleaner', cleanerRoutes);
app.use('/api/manager', managerRoutes);

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Function to generate daily tasks for all assigned points
async function generateDailyTasks() {
  try {
    console.log('🔄 Starting daily task generation...');
    
    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all cleaner assignments
    const assignments = await prisma.cleanerAssignment.findMany({
      select: {
        cleanerId: true,
        servicePointId: true
      }
    });

    console.log(`📋 Found ${assignments.length} cleaner assignments`);

    // Group assignments by cleaner
    const assignmentsByCleaner = new Map<string, string[]>();
    for (const assignment of assignments) {
      if (!assignmentsByCleaner.has(assignment.cleanerId)) {
        assignmentsByCleaner.set(assignment.cleanerId, []);
      }
      assignmentsByCleaner.get(assignment.cleanerId)!.push(assignment.servicePointId);
    }

    let totalCreated = 0;

    // For each cleaner, check which points don't have tasks for today
    for (const [cleanerId, servicePointIds] of assignmentsByCleaner.entries()) {
      // Get existing tasks for today
      const existingTasks = await prisma.cleaningTask.findMany({
        where: {
          cleanerId,
          servicePointId: {
            in: servicePointIds
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
      const pointsWithoutTasks = servicePointIds.filter(id => !existingTaskPointIds.has(id));

      if (pointsWithoutTasks.length > 0) {
        // Create tasks for points without tasks
        await prisma.cleaningTask.createMany({
          data: pointsWithoutTasks.map(servicePointId => ({
            servicePointId,
            cleanerId,
            scheduledAt: today,
            status: 'PENDING'
          })),
          skipDuplicates: true
        });

        totalCreated += pointsWithoutTasks.length;
        console.log(`✅ Created ${pointsWithoutTasks.length} tasks for cleaner ${cleanerId}`);
      }
    }

    console.log(`🎉 Daily task generation completed. Created ${totalCreated} tasks total.`);
  } catch (error) {
    console.error('❌ Error generating daily tasks:', error);
  }
}

// Schedule daily task generation at midnight (00:00) every day
// Cron format: minute hour day month dayOfWeek
cron.schedule('0 0 * * *', async () => {
  console.log('⏰ Scheduled task generation triggered at midnight');
  await generateDailyTasks();
}, {
  timezone: 'UTC'
});

// Also run immediately on startup (for testing and immediate task creation)
console.log('🔄 Running initial task generation...');
generateDailyTasks().catch(console.error);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 FeedbackATM Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log('⏰ Daily task generation scheduled for 00:00 UTC every day');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});
