import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import archiver from 'archiver';

const getDateRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

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
    const doc = new PDFDocument({ margin: 50 });
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Отчёт FeedbackATM', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Дата: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(12).text('Сводка за сегодня');
    doc.fontSize(10)
      .text(`Всего точек: ${totalPoints}`)
      .text(`Задач на сегодня: ${totalTasks}`)
      .text(`Выполнено: ${completedTasks}`);
    doc.moveDown(2);

    doc.fontSize(12).text('Задачи (последние 100)');
    doc.moveDown(0.5);
    let y = doc.y;
    const rowHeight = 18;
    const cols = [80, 80, 120, 80, 100];
    doc.fontSize(8).text('Точка', 50, y).text('Тип', 130, y).text('Клинер', 210, y).text('Статус', 290, y).text('Завершено', 370, y);
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
        .text(t.completedAt ? new Date(t.completedAt).toLocaleTimeString() : '', 370, y);
      y += rowHeight;
    }

    doc.end();
  });
}

export async function buildReportZip(prisma: any): Promise<Buffer> {
  const [excelBuf, pdfBuf] = await Promise.all([
    buildTasksExcel(prisma),
    buildReportPdf(prisma)
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
    archive.finalize();
  });
}
