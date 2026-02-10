import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationPickerProps {
  latitude: number | string;
  longitude: number | string;
  onLocationChange: (lat: number, lng: number) => void;
  height?: string;
}

// Component to handle map clicks
function MapClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onLocationChange(lat, lng);
    },
  });
  return null;
}

// Component to update map center when coordinates change
function MapUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  
  return null;
}

const LocationPicker = ({ latitude, longitude, onLocationChange, height = '300px' }: LocationPickerProps) => {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [hasInitialPosition, setHasInitialPosition] = useState(false);
  
  // Default coordinates for Baku, Azerbaijan
  const DEFAULT_LAT = 40.4093;
  const DEFAULT_LNG = 49.8671;

  useEffect(() => {
    const lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
    const lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
    
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      setPosition([lat, lng]);
      if (!hasInitialPosition) {
        setHasInitialPosition(true);
      }
    } else if (!hasInitialPosition) {
      // Default to Baku, Azerbaijan if no valid coordinates
      setPosition([DEFAULT_LAT, DEFAULT_LNG]);
    }
  }, [latitude, longitude, hasInitialPosition]);

  const handleLocationChange = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    onLocationChange(lat, lng);
  };

  if (!position) {
    return <div className="w-full" style={{ height }}>Loading map...</div>;
  }

  return (
    <div className="w-full" style={{ height }}>
      <MapContainer
        center={position}
        zoom={12}
        style={{ height: '100%', width: '100%', borderRadius: '0.375rem' }}
        className="border border-gray-300"
        key={`${position[0]}-${position[1]}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onLocationChange={handleLocationChange} />
        <MapUpdater lat={position[0]} lng={position[1]} />
        <Marker position={position} />
      </MapContainer>
      <p className="mt-2 text-sm text-gray-500 text-center">
        Click on the map to set location coordinates
      </p>
    </div>
  );
};

export default LocationPicker;

