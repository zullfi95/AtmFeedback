import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, CheckCircle, XCircle, FileSpreadsheet, FileText, Archive, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../utils/leafletConfig';

export default function AdminOverview() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | 'zip' | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.4093, 49.8671]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const photoUrl = (url: string | null | undefined) =>
    url ? (url.startsWith('http') ? url : `/feedbackatm/api${url}`) : null;

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const response = await adminAPI.getDashboardStats();
      if (response.data) {
        setData(response.data);

        const points = response.data.servicePoints || [];
        if (points.length > 0) {
          const pointsWithCoords = points.filter((p: any) => p.latitude && p.longitude);
          if (pointsWithCoords.length > 0) {
            const avgLat = pointsWithCoords.reduce((sum: number, p: any) => sum + p.latitude, 0) / pointsWithCoords.length;
            const avgLng = pointsWithCoords.reduce((sum: number, p: any) => sum + p.longitude, 0) / pointsWithCoords.length;
            setMapCenter([avgLat, avgLng]);
          }
        }
      }
    } catch (error) {
      console.error('Dashboard stats error:', error);
      toast.error(t('dashboard.admin.overview.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async (format: 'excel' | 'pdf' | 'zip') => {
    setExporting(format);
    try {
      const res = await adminAPI.exportReport(format);
      const blob = res.data as Blob;
      const ext = format === 'excel' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'zip';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${new Date().toISOString().split('T')[0]}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('common.success'));
    } catch (err) {
      console.error('Export report error:', err);
      toast.error(t('common.error'));
    } finally {
      setExporting(null);
    }
  };

  const createCustomIcon = (color: string) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  if (loading || !data) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex justify-between items-end gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('dashboard.admin.overview.title')}</h1>
          <p className="text-sm text-gray-600">{t('dashboard.admin.overview.subtitle')}</p>
        </div>
        <p className="text-sm font-medium text-gray-500 shrink-0">{new Date().toLocaleDateString()}</p>
      </div>

      {/* Stats — компактные карточки */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dashboard.admin.overview.totalPoints')}</h3>
            <MapPin className="h-4 w-4 text-gray-400" />
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">{data.stats?.totalPoints || 0}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dashboard.admin.overview.tasksToday')}</h3>
            <Clock className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">{data.stats?.todayTotalTasks || 0}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dashboard.admin.overview.completed')}</h3>
            <CheckCircle className="h-4 w-4 text-green-400" />
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-green-600">{data.stats?.todayCompletedTasks || 0}</p>
        </div>
      </div>

      {/* Отчётность — выгрузка Excel, PDF, ZIP */}
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('dashboard.admin.overview.reports')}</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleExportReport('excel')}
            disabled={!!exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t('dashboard.admin.overview.exportExcel')}
          </button>
          <button
            type="button"
            onClick={() => handleExportReport('pdf')}
            disabled={!!exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            {t('dashboard.admin.overview.exportPdf')}
          </button>
          <button
            type="button"
            onClick={() => handleExportReport('zip')}
            disabled={!!exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-600 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            <Archive className="h-4 w-4" />
            {t('dashboard.admin.overview.exportZip')}
          </button>
        </div>
      </div>

      {/* Карта — уменьшенная высота */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="px-4 py-2 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-sm font-bold text-gray-800">{t('dashboard.admin.overview.statusMap')}</h2>
          <div className="flex space-x-3 text-xs text-gray-600">
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981] mr-1" />{t('dashboard.admin.overview.cleaned')}</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] mr-1" />{t('dashboard.admin.overview.pending')}</span>
          </div>
        </div>
        <div className="h-[220px] sm:h-[260px]">
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {(data.servicePoints || []).map((point: any) => (
              <Marker
                key={point.id}
                position={[point.latitude, point.longitude]}
                icon={createCustomIcon(point.status === 'COMPLETED' ? '#10b981' : '#ef4444')}
              >
                <Popup>
                  <div className="p-1 min-w-[140px]">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-gray-100 uppercase">{point.type}</span>
                      <span className="font-bold text-sm">{point.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{point.address}</p>
                    <div className="border-t pt-2">
                      <p className="text-xs">{t('dashboard.status')}: <span className={point.status === 'COMPLETED' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{point.status === 'COMPLETED' ? t('dashboard.admin.overview.cleaned') : t('dashboard.admin.overview.pending')}</span></p>
                      {point.assignedCleaners && point.assignedCleaners.length > 0 && (
                        <p className="text-xs mt-1">
                          {point.assignedCleaners.length > 1 ? t('dashboard.admin.overview.assignedCleaners') : t('dashboard.admin.overview.assignedCleaner')}: <b>{point.assignedCleaners.map((c: any) => c.username).join(', ')}</b>
                        </p>
                      )}
                      {point.todayTask?.cleaner && (
                        <p className="text-xs mt-1">{t('dashboard.admin.overview.todayTask')}: <b>{point.todayTask.cleaner.username}</b></p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Таблица клинеров — компактные строки */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-800">{t('dashboard.admin.overview.cleanerShiftsProgress')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dashboard.admin.overview.cleaner')}</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dashboard.admin.overview.assignedPoints')}</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dashboard.admin.overview.progress')}</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dashboard.admin.overview.details')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(data.cleaners || []).map((cleaner: any) => {
                const total = cleaner.todayTasks?.length || 0;
                const completed = (cleaner.todayTasks || []).filter((t: any) => t.status === 'COMPLETED').length;
                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <tr key={cleaner.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary-light flex items-center justify-center text-primary-dark font-bold text-sm">
                          {cleaner.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{cleaner.username}</div>
                          <div className="text-xs text-gray-500">{cleaner.company?.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <div className="flex flex-wrap gap-1 max-h-14 overflow-y-auto">
                        {(cleaner.todayTasks || []).map((task: any) => (
                          <span key={task.id} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${
                            task.status === 'COMPLETED' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`}>
                            {task.status === 'COMPLETED' ? <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> : <XCircle className="w-2.5 h-2.5 mr-0.5" />}
                            {task.servicePoint?.name}
                          </span>
                        ))}
                        {total === 0 && <span className="text-xs text-gray-400 italic">{t('dashboard.admin.overview.noTasksScheduledToday')}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="w-20 bg-gray-200 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${percent === 100 ? 'bg-green-600' : 'bg-primary'}`} style={{ width: `${percent}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{completed}/{total} ({percent}%)</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="space-y-1">
                        {(cleaner.todayTasks || []).filter((task: any) => task.status === 'COMPLETED').map((task: any) => {
                          const before = photoUrl(task.photoBefore);
                          const after = photoUrl(task.photoAfter);
                          const damage = photoUrl(task.photoDamage);
                          const hasPhotos = before || after || damage;
                          const legacyUrls = (() => { try { const p = task.photos && JSON.parse(task.photos); return Array.isArray(p) ? p : []; } catch { return []; } })();
                          return (
                            <div key={task.id} className="flex flex-wrap items-center gap-1 text-gray-500">
                              <span className="font-medium shrink-0">{task.completedAt ? new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                              <span className="shrink-0">{task.servicePoint?.name}</span>
                              {(hasPhotos || legacyUrls.length > 0) && (
                                <div className="flex items-center gap-0.5 mt-0.5">
                                  {before && (
                                    <button
                                      type="button"
                                      onClick={() => setLightboxUrl(before)}
                                      className="block rounded overflow-hidden border border-gray-200 hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                      title={t('dashboard.admin.overview.photoBefore')}
                                    >
                                      <img src={before} alt="" className="w-8 h-8 object-cover" />
                                    </button>
                                  )}
                                  {after && (
                                    <button
                                      type="button"
                                      onClick={() => setLightboxUrl(after)}
                                      className="block rounded overflow-hidden border border-gray-200 hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                      title={t('dashboard.admin.overview.photoAfter')}
                                    >
                                      <img src={after} alt="" className="w-8 h-8 object-cover" />
                                    </button>
                                  )}
                                  {damage && (
                                    <button
                                      type="button"
                                      onClick={() => setLightboxUrl(damage)}
                                      className="block rounded overflow-hidden border border-gray-200 hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                      title={t('dashboard.admin.overview.photoDamage')}
                                    >
                                      <img src={damage} alt="" className="w-8 h-8 object-cover" />
                                    </button>
                                  )}
                                  {legacyUrls.map((url: string, idx: number) => {
                                    const u = photoUrl(url);
                                    if (!u) return null;
                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setLightboxUrl(u)}
                                        className="block rounded overflow-hidden border border-gray-200 hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                        title={t('dashboard.admin.overview.photo')}
                                      >
                                        <img src={u} alt="" className="w-8 h-8 object-cover" />
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lightbox: раскрытие фото по клику */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t('dashboard.admin.overview.photo')}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-1 rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Close"
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
