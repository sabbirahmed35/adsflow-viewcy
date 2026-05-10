import { useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { X, Plus, Search, MapPin } from 'lucide-react';
import clsx from 'clsx';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PinnedLocation {
  id: string;
  lat: number;
  lng: number;
  radiusMiles: number;
  label?: string;
}

// ─── Radius options ───────────────────────────────────────────────────────────
const RADIUS_OPTIONS = [1, 2, 5, 10, 15, 20, 25, 30, 40, 50];

// ─── Miles to meters ─────────────────────────────────────────────────────────
const milesToMeters = (miles: number) => miles * 1609.34;

// ─── Geocode search ───────────────────────────────────────────────────────────
async function geocodeSearch(query: string): Promise<Array<{ lat: number; lng: number; label: string }>> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
    { headers: { 'Accept-Language': 'en' } }
  );
  const data = await res.json();
  return data.map((item: any) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    label: item.display_name.split(',').slice(0, 3).join(','),
  }));
}

// ─── Map click handler ────────────────────────────────────────────────────────
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ─── Single pin row ───────────────────────────────────────────────────────────
function PinRow({
  pin,
  onRemove,
  onRadiusChange,
}: {
  pin: PinnedLocation;
  onRemove: () => void;
  onRadiusChange: (miles: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 bg-blue-50 rounded-lg border border-blue-100">
      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
        <MapPin className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">
          {pin.label || `(${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)})`}
        </p>
        <p className="text-xs text-gray-400">
          ({pin.lat.toFixed(4)}, {pin.lng.toFixed(4)})
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">+</span>
        <select
          value={pin.radiusMiles}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}mi</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="w-5 h-5 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface MapLocationPickerProps {
  value: PinnedLocation[];
  onChange: (pins: PinnedLocation[]) => void;
}

export function MapLocationPicker({ value, onChange }: MapLocationPickerProps) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ lat: number; lng: number; label: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [defaultRadius, setDefaultRadius] = useState(10);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const addPin = useCallback((lat: number, lng: number, label?: string) => {
    const newPin: PinnedLocation = {
      id: `${Date.now()}`,
      lat,
      lng,
      radiusMiles: defaultRadius,
      label,
    };
    onChange([...value, newPin]);
  }, [value, onChange, defaultRadius]);

  const removePin = useCallback((id: string) => {
    onChange(value.filter((p) => p.id !== id));
  }, [value, onChange]);

  const updateRadius = useCallback((id: string, miles: number) => {
    onChange(value.map((p) => p.id === id ? { ...p, radiusMiles: miles } : p));
  }, [value, onChange]);

  const handleSearch = async (q: string) => {
    setSearch(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await geocodeSearch(q);
        setSearchResults(results);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const selectResult = (result: { lat: number; lng: number; label: string }) => {
    addPin(result.lat, result.lng, result.label);
    setSearch('');
    setSearchResults([]);
  };

  const center: [number, number] = value.length > 0
    ? [value[value.length - 1].lat, value[value.length - 1].lng]
    : [40.7128, -74.0060];

  return (
    <div className="space-y-3">
      {/* Pinned locations list */}
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((pin) => (
            <PinRow
              key={pin.id}
              pin={pin}
              onRemove={() => removePin(pin.id)}
              onRadiusChange={(miles) => updateRadius(pin.id, miles)}
            />
          ))}
        </div>
      )}

      {/* Controls bar */}
      <div className="flex items-center gap-2">
        {/* Search box */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            className="input pl-8 pr-3 text-sm"
            placeholder="Search locations…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          )}
          {searchResults.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => selectResult(r)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span className="text-gray-700 text-xs leading-snug">{r.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Default radius */}
        <select
          value={defaultRadius}
          onChange={(e) => setDefaultRadius(Number(e.target.value))}
          className="text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}mi</option>
          ))}
        </select>

        {/* Toggle map */}
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
            showMap
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          )}
        >
          <MapPin className="w-3.5 h-3.5" />
          {showMap ? 'Hide map' : 'Show map'}
        </button>
      </div>

      {/* Map */}
      {showMap && (
        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <div className="bg-blue-50 border-b border-blue-100 px-3 py-2 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs text-blue-700 font-medium">Click anywhere on the map to drop a pin</span>
          </div>
          <MapContainer
            center={center}
            zoom={value.length > 0 ? 9 : 4}
            style={{ height: '300px', width: '100%' }}
            key={value.length === 0 ? 'empty' : 'has-pins'}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapClickHandler onMapClick={(lat, lng) => addPin(lat, lng)} />
            {value.map((pin) => (
              <div key={pin.id}>
                <Marker position={[pin.lat, pin.lng]} />
                <Circle
                  center={[pin.lat, pin.lng]}
                  radius={milesToMeters(pin.radiusMiles)}
                  pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2 }}
                />
              </div>
            ))}
          </MapContainer>
        </div>
      )}

      {value.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-1">
          No locations added — search or click the map to add targeting areas
        </p>
      )}
    </div>
  );
}
