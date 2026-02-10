import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useAuth } from '../hooks/useAuth';
import { adminAPI, managerAPI, cleanerAPI } from '../services/api';
import { X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface ServicePoint {
  id: string;
  name: string;
  type: 'ATM' | 'BUS_STOP';
  address: string;
  latitude: number;
  longitude: number;
  companyId: string;
  company: {
    id: string;
    name: string;
  };
}

const MapView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState<[number, number]>([40.4093, 49.8671]); // Default to Baku, Azerbaijan

  useEffect(() => {
    loadServicePoints();
  }, [user]);

  const loadServicePoints = async () => {
    try {
      let response;
      if (user?.role === 'ADMIN') {
        response = await adminAPI.getServicePoints();
      } else if (user?.role === 'MANAGER') {
        response = await managerAPI.getServicePoints();
      } else if (user?.role === 'CLEANER') {
        response = await cleanerAPI.getAssignedPoints();
      } else {
        return;
      }

      const points = response.data.servicePoints || response.data.atms || [];
      setServicePoints(points);

      // Calculate center based on service points
      if (points.length > 0) {
        const avgLat = points.reduce((sum: number, p: ServicePoint) => sum + p.latitude, 0) / points.length;
        const avgLng = points.reduce((sum: number, p: ServicePoint) => sum + p.longitude, 0) / points.length;
        setCenter([avgLat, avgLng]);
      }
    } catch (error) {
      console.error('Failed to load service points:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-6xl h-[70vh] flex flex-col">
        {/* Header with close button */}
        <div className="bg-white px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Service Locations Map</h1>
            <p className="text-sm text-gray-600">Showing {servicePoints.length} locations</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close map"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Map container - reduced size */}
        <div className="flex-1 relative">
          <MapContainer
            center={center}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            className="leaflet-container rounded-b-lg"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {servicePoints.map((point) => (
              <Marker key={point.id} position={[point.latitude, point.longitude]}>
                <Popup>
                  <div className="p-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 uppercase">
                        {point.type}
                      </span>
                      <h3 className="font-semibold text-lg">{point.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{point.address}</p>
                    <p className="text-xs text-gray-500">
                      Company: {point.company.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Coordinates: {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default MapView;
