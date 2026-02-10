import { UserRole, CleaningStatus, ServicePointType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';

async function main() {
  console.log('🌱 Seeding database with Baku, Azerbaijan data...');

  // 1. Clear existing data (optional but good for a clean swap)
  // We do it in reverse order of dependencies
  await prisma.cleaningTask.deleteMany({});
  await prisma.cleanerAssignment.deleteMany({});
  await prisma.user.deleteMany({ where: { role: { in: [UserRole.MANAGER, UserRole.CLEANER] } } });
  await prisma.servicePoint.deleteMany({});
  await prisma.company.deleteMany({});

  // 2. Create admin user (if not exists)
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  // 3. Create Companies
  const companiesData = [
    { id: 'unibank', name: 'Unibank', address: 'Baku, Azerbaijan', description: 'Unibank Commercial Bank' },
    { id: 'pashabank', name: 'Pasha Bank', address: 'Baku, Azerbaijan', description: 'Pasha Bank OJSC' },
    { id: 'kapitalbank', name: 'Kapital Bank', address: 'Baku, Azerbaijan', description: 'Kapital Bank OJSC' },
    { id: 'mintcliner', name: 'Mint Cliner', address: 'Baku, Azerbaijan', description: 'Public Transport Infrastructure' },
  ];

  const companies: any = {};
  for (const c of companiesData) {
    companies[c.id] = await prisma.company.create({ data: c });
  }

  console.log('✅ Companies created: Unibank, Pasha Bank, Kapital Bank, Mint Cliner');

  // 4. Create Service Points (ATMs and Bus Stops) in Baku
  // Center: 40.4093, 49.8671
  const points: any[] = [];

  // Unibank (7 ATMs)
  for (let i = 1; i <= 7; i++) {
    points.push(await prisma.servicePoint.create({
      data: {
        id: `unibank-atm-${i}`,
        name: `Unibank ATM #${i}`,
        type: ServicePointType.ATM,
        address: `Baku, Street ${i * 10}, Branch ${i}`,
        latitude: 40.3700 + (Math.random() * 0.05),
        longitude: 49.8200 + (Math.random() * 0.08),
        companyId: companies['unibank'].id,
      }
    }));
  }

  // Pasha Bank (5 ATMs)
  for (let i = 1; i <= 5; i++) {
    points.push(await prisma.servicePoint.create({
      data: {
        id: `pasha-atm-${i}`,
        name: `Pasha Bank ATM #${i}`,
        type: ServicePointType.ATM,
        address: `Baku, Ave ${i * 5}, Center ${i}`,
        latitude: 40.3800 + (Math.random() * 0.04),
        longitude: 49.8400 + (Math.random() * 0.06),
        companyId: companies['pashabank'].id,
      }
    }));
  }

  // Kapital Bank (3 ATMs)
  for (let i = 1; i <= 3; i++) {
    points.push(await prisma.servicePoint.create({
      data: {
        id: `kapital-atm-${i}`,
        name: `Kapital Bank ATM #${i}`,
        type: ServicePointType.ATM,
        address: `Baku, Metro ${i}`,
        latitude: 40.3900 + (Math.random() * 0.03),
        longitude: 49.8500 + (Math.random() * 0.05),
        companyId: companies['kapitalbank'].id,
      }
    }));
  }

  // Mint Cliner (10 Bus Stops)
  for (let i = 1; i <= 10; i++) {
    points.push(await prisma.servicePoint.create({
      data: {
        id: `mint-stop-${i}`,
        name: `Bus Stop #${i}`,
        type: ServicePointType.BUS_STOP,
        address: `Baku, Main Road, Stop ${i}`,
        latitude: 40.4000 + (Math.random() * 0.06),
        longitude: 49.8600 + (Math.random() * 0.1),
        companyId: companies['mintcliner'].id,
      }
    }));
  }

  console.log('✅ Service Points created (25 total)');

  // 5. Create Users (Managers and Cleaners)
  const commonPassword = await bcrypt.hash('cleaner123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);

  // Managers
  const managers = [
    { username: 'manager_unibank', email: 'm1@unibank.az', role: UserRole.MANAGER, companyId: companies['unibank'].id },
    { username: 'manager_mint', email: 'm2@mint.az', role: UserRole.MANAGER, companyId: companies['mintcliner'].id },
  ];

  for (const m of managers) {
    await prisma.user.create({ data: { ...m, password: managerPassword } });
  }

  // Cleaners (6 cleaners total)
  const cleanersData = [
    { username: 'cleaner_ali', email: 'ali@mint.az', companyId: companies['mintcliner'].id },
    { username: 'cleaner_vusal', email: 'vusal@mint.az', companyId: companies['mintcliner'].id },
    { username: 'cleaner_leila', email: 'leila@mint.az', companyId: companies['mintcliner'].id },
    { username: 'cleaner_samir', email: 'samir@unibank.az', companyId: companies['unibank'].id },
    { username: 'cleaner_elvin', email: 'elvin@pashabank.az', companyId: companies['pashabank'].id },
    { username: 'cleaner_nargiz', email: 'nargiz@kapital.az', companyId: companies['kapitalbank'].id },
  ];

  const cleaners: any[] = [];
  for (const c of cleanersData) {
    cleaners.push(await prisma.user.create({ 
      data: { ...c, role: UserRole.CLEANER, password: commonPassword } 
    }));
  }

  console.log('✅ Users created (2 Managers, 6 Cleaners)');

  // 6. Assign Points to Cleaners
  // Assign bus stops to Mint cleaners
  const busStops = points.filter(p => p.type === ServicePointType.BUS_STOP);
  for (let i = 0; i < busStops.length; i++) {
    const cleanerIdx = i % 3; // Ali, Vusal, Leila
    await prisma.cleanerAssignment.create({
      data: { cleanerId: cleaners[cleanerIdx].id, servicePointId: busStops[i].id }
    });
  }

  // Assign Unibank ATMs to Samir
  const unibankATMs = points.filter(p => p.companyId === companies['unibank'].id);
  for (const atm of unibankATMs) {
    await prisma.cleanerAssignment.create({
      data: { cleanerId: cleaners[3].id, servicePointId: atm.id }
    });
  }

  console.log('✅ Cleaner assignments created');

  // 7. Create Today's Tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Create some tasks for today
  for (let i = 0; i < 15; i++) {
    const point = points[i];
    const assignments = await prisma.cleanerAssignment.findMany({ where: { servicePointId: point.id } });
    if (assignments.length > 0) {
      const status = i < 5 ? CleaningStatus.COMPLETED : (i < 10 ? CleaningStatus.IN_PROGRESS : CleaningStatus.PENDING);
      await prisma.cleaningTask.create({
        data: {
          servicePointId: point.id,
          cleanerId: assignments[0].cleanerId,
          status: status,
          scheduledAt: today,
          completedAt: status === CleaningStatus.COMPLETED ? new Date() : null,
          notes: status === CleaningStatus.COMPLETED ? 'Everything is clean' : null,
          photos: status === CleaningStatus.COMPLETED ? JSON.stringify(['/uploads/sample.jpg']) : null
        }
      });
    }
  }

  console.log('✅ Sample tasks created');
  console.log('🎉 Database seeded successfully with Baku data!');
  console.log('--------------------------------------------------');
  console.log('Logins:');
  console.log('Admin: admin / admin123');
  console.log('Manager (Mint): manager_mint / manager123');
  console.log('Cleaners: cleaner_ali, cleaner_vusal, cleaner_leila, cleaner_samir... / cleaner123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
