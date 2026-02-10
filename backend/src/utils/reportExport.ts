import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';

const getDateRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

function resolvePhotoPath(photoUrl: string | null | undefined): string | null {
  if (!photoUrl || typeof photoUrl !== 'string') return null;
  const name = path.basename(photoUrl.split('?')[0]);
  if (!name) return null;
  const full = path.join(UPLOADS_DIR, name);
  return fs.existsSync(full) ? full : null;
}

function collectTaskPhotoPaths(t: any): string[] {
  const out: string[] = [];
  const before = resolvePhotoPath(t.photoBefore);
  const after = resolvePhotoPath(t.photoAfter);
  const damage = resolvePhotoPath(t.photoDamage);
  if (before) out.push(before);
  if (after) out.push(after);
  if (damage) out.push(damage);
  if (t.photos) {
    try {
      const arr = JSON.parse(t.photos);
      if (Array.isArray(arr)) for (const url of arr) {
        const p = resolvePhotoPath(url);
        if (p && !out.includes(p)) out.push(p);
      }
    } catch (_) {}
  }
  return out;
}

export async function buildTasksExcel(prisma: any): Promise<Buffer> {
  const { start, end } = getDateRange();
  const tasks = await prisma.cleaningTask.findMany({
    where: { scheduledAt: { gte: start, lt: end } },
    include: {
      servicePoint: { select: { name: true, type: true, address: true } },
      cleaner: { select: { username: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });
  const rows = tasks.map((t: any) => ({
    'Точка': t.servicePoint?.name ?? '',
    'Тип': t.servicePoint?.type ?? '',
    'Адрес': t.servicePoint?.address ?? '',
    'Клинер': t.cleaner?.username ?? '',
    'Статус': t.status,
    'Запланировано': t.scheduledAt ? new Date(t.scheduledAt).toLocaleString() : '',
    'Завершено': t.completedAt ? new Date(t.completedAt).toLocaleString() : ''
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  XLSX.utils.book_append_sheet(wb, ws, 'Задачи');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

const AZ = {
  title: 'FeedbackATM Hesabatı',
  date: 'Tarix',
  summaryToday: 'Bu gün üçün xülasə',
  totalPoints: 'Cəmi nöqtələr',
  tasksToday: 'Bu gün üçün tapşırıqlar',
  completed: 'Tamamlanan',
  tasksLast100: 'Tapşırıqlar (son 100)',
  point: 'Nöqtə',
  type: 'Növ',
  cleaner: 'Təmizləyici',
  status: 'Status',
  completedAt: 'Tamamlanma vaxtı',
  photos: 'Fotoşəkillər',
  before: 'Əvvəl',
  after: 'Sonra',
  damage: 'Zədə'
};

function getUnicodeFontPath(): string | null {
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/TTF/DejaVuSans.ttf',
    path.join(process.cwd(), 'fonts', 'DejaVuSans.ttf')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function buildReportPdf(prisma: any): Promise<Buffer> {
  const { start, end } = getDateRange();
  const [totalPoints, totalTasks, completedTasks] = await Promise.all([
    prisma.servicePoint.count(),
    prisma.cleaningTask.count({ where: { scheduledAt: { gte: start, lt: end } } }),
    prisma.cleaningTask.count({
      where: { scheduledAt: { gte: start, lt: end }, status: 'COMPLETED' }
    })
  ]);
  const tasks = await prisma.cleaningTask.findMany({
    where: { scheduledAt: { gte: start, lt: end } },
    include: {
      servicePoint: { select: { name: true, type: true } },
      cleaner: { select: { username: true } }
    },
    orderBy: { completedAt: 'desc' },
    take: 100
  });

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, autoFirstPage: true });
    const fontPath = getUnicodeFontPath();
    if (fontPath) {
      try {
        doc.registerFont('Unicode', fontPath);
        doc.font('Unicode');
      } catch (_) {}
    }
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(AZ.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`${AZ.date}: ${new Date().toLocaleDateString('az-AZ')}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(12).text(AZ.summaryToday);
    doc.fontSize(10)
      .text(`${AZ.totalPoints}: ${totalPoints}`)
      .text(`${AZ.tasksToday}: ${totalTasks}`)
      .text(`${AZ.completed}: ${completedTasks}`);
    doc.moveDown(2);

    doc.fontSize(12).text(AZ.tasksLast100);
    doc.moveDown(0.5);
    let y = doc.y;
    const rowHeight = 18;
    doc.fontSize(8).text(AZ.point, 50, y).text(AZ.type, 130, y).text(AZ.cleaner, 210, y).text(AZ.status, 290, y).text(AZ.completedAt, 370, y);
    y += rowHeight;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 8;

    for (const t of tasks) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.fontSize(8)
        .text((t.servicePoint as any)?.name?.slice(0, 18) ?? '', 50, y)
        .text((t.servicePoint as any)?.type ?? '', 130, y)
        .text((t.cleaner as any)?.username ?? '', 210, y)
        .text(t.status, 290, y)
        .text(t.completedAt ? new Date(t.completedAt).toLocaleTimeString('az-AZ') : '', 370, y);
      y += rowHeight;
    }

    doc.moveDown(2);
    doc.fontSize(12).text(AZ.photos);
    doc.moveDown(0.5);
    const imgWidth = 120;
    const imgHeight = 90;
    const gap = 8;
    for (const t of tasks) {
      const photoPaths: { path: string; label: string }[] = [];
      const before = resolvePhotoPath(t.photoBefore);
      const after = resolvePhotoPath(t.photoAfter);
      const damage = resolvePhotoPath(t.photoDamage);
      if (before) photoPaths.push({ path: before, label: AZ.before });
      if (after) photoPaths.push({ path: after, label: AZ.after });
      if (damage) photoPaths.push({ path: damage, label: AZ.damage });
      if (t.photos) {
        try {
          const arr = JSON.parse(t.photos);
          if (Array.isArray(arr)) for (const url of arr) {
            const p = resolvePhotoPath(url);
            if (p && !photoPaths.some(x => x.path === p)) photoPaths.push({ path: p, label: '' });
          }
        } catch (_) {}
      }
      if (photoPaths.length === 0) continue;
      const pointName = (t.servicePoint as any)?.name ?? t.id;
      if (doc.y > 650) {
        doc.addPage();
        doc.y = 50;
      }
      doc.fontSize(9).text(`${pointName} (${(t.cleaner as any)?.username ?? ''})`, { continued: false });
      doc.moveDown(0.3);
      let x = 50;
      let rowY = doc.y;
      for (const { path: filePath, label } of photoPaths) {
        if (x + imgWidth > 550) {
          x = 50;
          rowY += 10 + imgHeight + gap;
          if (rowY > 700) {
            doc.addPage();
            rowY = 50;
          }
        }
        try {
          doc.fontSize(7).text(label || '', x, rowY);
          doc.image(filePath, x, rowY + 10, { width: imgWidth, height: imgHeight, fit: [imgWidth, imgHeight] });
          x += imgWidth + gap;
        } catch (_) {}
      }
      doc.y = rowY + 10 + imgHeight + gap;
      doc.moveDown(0.5);
    }

    doc.end();
  });
}

export async function buildReportZip(prisma: any): Promise<Buffer> {
  const { start, end } = getDateRange();
  const [excelBuf, pdfBuf, tasksWithPhotos] = await Promise.all([
    buildTasksExcel(prisma),
    buildReportPdf(prisma),
    prisma.cleaningTask.findMany({
      where: { scheduledAt: { gte: start, lt: end }, status: 'COMPLETED' },
      select: {
        id: true,
        photoBefore: true,
        photoAfter: true,
        photoDamage: true,
        photos: true,
        servicePoint: { select: { name: true } }
      }
    })
  ]);
  const dateStr = new Date().toISOString().split('T')[0];
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    archive.append(excelBuf, { name: `report_${dateStr}.xlsx` });
    archive.append(pdfBuf, { name: `report_${dateStr}.pdf` });
    const pointName = (t: any) => (t.servicePoint?.name ?? t.id).replace(/[^\w\-.]/g, '_').slice(0, 40);
    let photoIndex = 0;
    for (const t of tasksWithPhotos) {
      const paths = collectTaskPhotoPaths(t);
      const base = pointName(t);
      paths.forEach((filePath, i) => {
        const ext = path.extname(filePath) || '.jpg';
        const entryName = `photos/${base}_${t.id.slice(-6)}_${i + 1}${ext}`;
        try {
          archive.file(filePath, { name: entryName });
        } catch (_) {}
      });
    }
    archive.finalize();
  });
}
