import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Navigation, Car, Shield, Clock, DollarSign, CheckCircle2,
  User, Phone, Star, Menu, X, ChevronRight, AlertCircle, RefreshCw,
  Compass, ExternalLink, Search
} from 'lucide-react';
import { supabase } from './supabaseClient';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Corregir iconos por defecto de Leaflet en Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SERVICE_TIERS = [
  { id: 'TRANSY X', name: 'TRANSY X', desc: 'Económico • 4 pasajeros', base: 4.5, perMile: 1.65, perMin: 0.25, eta: '3 min' },
  { id: 'TRANSY XL', name: 'TRANSY XL', desc: 'SUV / Grupos • 6 pasajeros', base: 7.5, perMile: 2.35, perMin: 0.35, eta: '5 min' },
  { id: 'TRANSY VIP', name: 'TRANSY VIP', desc: 'Ejecutivo / Aeropuertos', base: 14.0, perMile: 3.1, perMin: 0.45, eta: '8 min' }
];

export default function App() {
  const [role, setRole] = useState('passenger'); // passenger | driver | admin
  const [rides, setRides] = useState([]);
  const [dbError, setDbError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Estado de ubicaciones y mapa
  const [pickupText, setPickupText] = useState('Hamden Center, Hamden, CT');
  const [dropoffText, setDropoffText] = useState('Tweed New Haven Airport (HVN), New Haven, CT');
  const [pickupCoords, setPickupCoords] = useState({ lat: 41.3839, lng: -72.9026 });
  const [dropoffCoords, setDropoffCoords] = useState({ lat: 41.2638, lng: -72.8868 });

  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [routeStats, setRouteStats] = useState({ miles: 9.8, minutes: 18 });
  const [selectedTier, setSelectedTier] = useState('TRANSY X');
  const [passengerName, setPassengerName] = useState('Cliente Transy');
  const [gpsLoading, setGpsLoading] = useState(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroup = useRef(null);

  // Cargar viajes desde Supabase
  const fetchRides = async () => {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setDbError(error.message);
    } else {
      setDbError(null);
      setRides(data || []);
    }
  };

  useEffect(() => {
    fetchRides();
    const channel = supabase
      .channel('rides-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => {
        fetchRides();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Inicializar mapa Leaflet
  useEffect(() => {
    if (role !== 'passenger') return;
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, { zoomControl: false }).setView([pickupCoords.lat, pickupCoords.lng], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    layerGroup.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [role]);

  // Calcular ruta real por carretera con OSRM y dibujar en el mapa
  useEffect(() => {
    const updateRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${pickupCoords.lng},${pickupCoords.lat};${dropoffCoords.lng},${dropoffCoords.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.routes && json.routes.length > 0) {
          const route = json.routes[0];
          const miles = +(route.distance * 0.000621371).toFixed(1);
          const minutes = Math.max(3, Math.round(route.duration / 60));
          setRouteStats({ miles, minutes });

          if (mapInstance.current && layerGroup.current) {
            layerGroup.current.clearLayers();
            const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            const polyline = L.polyline(coords, { color: '#10b981', weight: 5 }).addTo(layerGroup.current);

            L.marker([pickupCoords.lat, pickupCoords.lng]).addTo(layerGroup.current).bindPopup('Origen');
            L.marker([dropoffCoords.lat, dropoffCoords.lng]).addTo(layerGroup.current).bindPopup('Destino');

            mapInstance.current.fitBounds(polyline.getBounds(), { padding: [35, 35] });
          }
        }
      } catch (err) {
        console.error('Error calculando ruta:', err);
      }
    };

    updateRoute();
  }, [pickupCoords, dropoffCoords, role]);

  // Buscar direcciones reales con Photon (OpenStreetMap)
  const searchAddress = async (query, type) => {
    if (type === 'pickup') setPickupText(query);
    else setDropoffText(query);

    if (query.trim().length < 3) {
      type === 'pickup' ? setPickupSuggestions([]) : setDropoffSuggestions([]);
      return;
    }

    try {
      // Sesgo geográfico hacia Connecticut / Tri-State
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=41.38&lon=-72.90&limit=5`);
      const data = await res.json();
      const formatted = (data.features || []).map((f) => {
        const p = f.properties;
        const label = [p.name, p.street, p.housenumber, p.city || p.town, p.state].filter(Boolean).join(', ');
        return {
          label: label || query,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0]
        };
      });
      if (type === 'pickup') setPickupSuggestions(formatted);
      else setDropoffSuggestions(formatted);
    } catch (e) {
      console.error(e);
    }
  };

  // Obtener GPS real del dispositivo
  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta GPS.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPickupCoords({ lat, lng });
        setPickupSuggestions([]);
        try {
          const res = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`);
          const data = await res.json();
          const p = data.features?.[0]?.properties;
          const label = p ? [p.name, p.street, p.city || p.town, p.state].filter(Boolean).join(', ') : `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          setPickupText(label);
        } catch {
          setPickupText(`Mi ubicación GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
        setGpsLoading(false);
      },
      () => {
        alert('No se pudo obtener el GPS. Activa los permisos de ubicación en tu teléfono.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const calculatePrice = (tier) => {
    const raw = tier.base + routeStats.miles * tier.perMile + routeStats.minutes * tier.perMin;
    return raw.toFixed(2);
  };

  const handleRequestRide = async () => {
    setLoading(true);
    const tierObj = SERVICE_TIERS.find((t) => t.id === selectedTier) || SERVICE_TIERS[0];
    const fare = parseFloat(calculatePrice(tierObj));

    const { error } = await supabase.from('rides').insert([
      {
        passenger_name: passengerName || 'Cliente Transy',
        pickup: pickupText,
        dropoff: dropoffText,
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        dropoff_lat: dropoffCoords.lat,
        dropoff_lng: dropoffCoords.lng,
        distance_miles: routeStats.miles,
        duration_min: routeStats.minutes,
        service_type: tierObj.name,
        fare,
        status: 'pending'
      }
    ]);

    setLoading(false);
    if (error) {
      setDbError(error.message);
    } else {
      fetchRides();
      alert('¡Viaje solicitado! Cambia a Conductor para aceptarlo.');
    }
  };

  const updateRideStatus = async (id, newStatus) => {
    const { error } = await supabase.from('rides').update({ status: newStatus }).eq('id', id);
    if (!error) fetchRides();
  };

  const activeRides = rides.filter((r) => r.status !== 'completed' && r.status !== 'cancelled');
  const completedRides = rides.filter((r) => r.status === 'completed');
  const totalRevenue = completedRides.reduce((sum, r) => sum + Number(r.fare || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-lg">
              T
            </div>
            <div>
              <h1 className="font-bold tracking-wider text-base leading-none">TRANSY</h1>
              <span className="text-[11px] text-emerald-400 font-medium">GPS & Supabase Live</span>
            </div>
          </div>

          <nav className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs sm:text-sm">
            <button
              onClick={() => setRole('passenger')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${role === 'passenger' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'}`}
            >
              Pasajero
            </button>
            <button
              onClick={() => setRole('driver')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${role === 'driver' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'}`}
            >
              Conductor ({activeRides.length})
            </button>
            <button
              onClick={() => setRole('admin')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${role === 'admin' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'}`}
            >
              Admin
            </button>
          </nav>
        </div>
      </header>

      {dbError && (
        <div className="max-w-xl mx-auto mt-4 px-4">
          <div className="bg-red-950/80 border border-red-500/50 text-red-200 p-3 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>Error Supabase: {dbError}</span>
          </div>
        </div>
      )}

      {/* VISTA PASAJERO */}
      {role === 'passenger' && (
        <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
          {/* Mapa Interactivo */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-xl h-56 sm:h-64 bg-slate-900">
            <div ref={mapRef} className="w-full h-full z-10" />
            <button
              onClick={handleUseCurrentGPS}
              disabled={gpsLoading}
              className="absolute bottom-3 right-3 z-20 bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg"
            >
              <Compass className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
              {gpsLoading ? 'Ubicando...' : 'Usar mi GPS'}
            </button>
          </div>

          {/* Buscador de Direcciones */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase">Connecticut Express</span>
              <span className="text-xs text-slate-400">{routeStats.miles} mi • {routeStats.minutes} min</span>
            </div>

            {/* Input Origen */}
            <div className="relative">
              <label className="text-xs text-slate-400 mb-1 block">Punto de partida</label>
              <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 focus-within:border-emerald-500">
                <MapPin className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={pickupText}
                  onChange={(e) => searchAddress(e.target.value, 'pickup')}
                  placeholder="Escribe dirección o ciudad..."
                  className="bg-transparent w-full text-sm text-white focus:outline-none"
                />
              </div>
              {pickupSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden">
                  {pickupSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setPickupText(item.label);
                        setPickupCoords({ lat: item.lat, lng: item.lng });
                        setPickupSuggestions([]);
                      }}
                      className="w-full text-left px-3 py-2.5 text-xs hover:bg-slate-800 border-b border-slate-800/60 last:border-0 flex items-center gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input Destino */}
            <div className="relative">
              <label className="text-xs text-slate-400 mb-1 block">Destino</label>
              <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 focus-within:border-emerald-500">
                <Navigation className="w-4 h-4 text-amber-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={dropoffText}
                  onChange={(e) => searchAddress(e.target.value, 'dropoff')}
                  placeholder="¿A dónde vas? (Ej. JFK Airport, New Haven...)"
                  className="bg-transparent w-full text-sm text-white focus:outline-none"
                />
              </div>
              {dropoffSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden">
                  {dropoffSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setDropoffText(item.label);
                        setDropoffCoords({ lat: item.lat, lng: item.lng });
                        setDropoffSuggestions([]);
                      }}
                      className="w-full text-left px-3 py-2.5 text-xs hover:bg-slate-800 border-b border-slate-800/60 last:border-0 flex items-center gap-2"
                    >
                      <Navigation className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tarifas */}
            <div className="space-y-2 pt-2">
              {SERVICE_TIERS.map((tier) => {
                const active = selectedTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition text-left ${
                      active ? 'bg-emerald-950/40 border-emerald-500' : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                        <Car className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm">{tier.name}</div>
                        <div className="text-xs text-slate-400">{tier.desc}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-base text-white">$ {calculatePrice(tier)}</div>
                      <div className="text-[11px] text-emerald-400">{tier.eta}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleRequestRide}
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/20 text-sm"
            >
              {loading ? 'Solicitando...' : `Confirmar ${selectedTier}`}
            </button>
          </div>
        </main>
      )}

      {/* VISTA CONDUCTOR */}
      {role === 'driver' && (
        <main className="max-w-xl mx-auto px-4 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Panel del Conductor</h2>
            <button onClick={fetchRides} className="text-xs text-emerald-400 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </button>
          </div>

          {activeRides.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
              No hay solicitudes activas en este momento.
            </div>
          ) : (
            activeRides.map((ride) => {
              const driverNet = (Number(ride.fare) * 0.85).toFixed(2);
              const mapsDestination = ride.dropoff_lat && ride.dropoff_lng
                ? `${ride.dropoff_lat},${ride.dropoff_lng}`
                : encodeURIComponent(ride.dropoff);

              return (
                <div key={ride.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 uppercase">
                        {ride.service_type} • {ride.status}
                      </span>
                      <div className="text-xs text-slate-400 mt-1">{ride.distance_miles} mi • {ride.duration_min} min</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-400">$ {driverNet}</div>
                      <div className="text-[11px] text-slate-400">Tu ganancia (85%)</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Recoger:</strong> {ride.pickup}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Navigation className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span><strong>Destino:</strong> {ride.dropoff}</span>
                    </div>
                  </div>

                  {/* Botón Abrir Navegación GPS */}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${mapsDestination}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <ExternalLink className="w-4 h-4 text-emerald-400" />
                    Navegar con GPS (Google / Apple Maps)
                  </a>

                  {/* Botones de flujo de viaje */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {ride.status === 'pending' && (
                      <button
                        onClick={() => updateRideStatus(ride.id, 'accepted')}
                        className="col-span-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm"
                      >
                        Aceptar Viaje
                      </button>
                    )}
                    {ride.status === 'accepted' && (
                      <button
                        onClick={() => updateRideStatus(ride.id, 'in_progress')}
                        className="col-span-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold py-2.5 rounded-xl text-sm"
                      >
                        Pasajero a bordo (Iniciar viaje)
                      </button>
                    )}
                    {ride.status === 'in_progress' && (
                      <button
                        onClick={() => updateRideStatus(ride.id, 'completed')}
                        className="col-span-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm"
                      >
                        Finalizar y Cobrar ($ {ride.fare})
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </main>
      )}

      {/* VISTA ADMINISTRACIÓN */}
      {role === 'admin' && (
        <main className="max-w-3xl mx-auto px-4 pt-6 space-y-4">
          <h2 className="text-lg font-bold">Administración Transy</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div className="text-xs text-slate-400">Viajes Completados</div>
              <div className="text-xl font-black mt-1">{completedRides.length}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div className="text-xs text-slate-400">Facturación Bruta</div>
              <div className="text-xl font-black text-emerald-400 mt-1">$ {totalRevenue.toFixed(2)}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div className="text-xs text-slate-400">Comisión App (15%)</div>
              <div className="text-xl font-black text-amber-400 mt-1">$ {(totalRevenue * 0.15).toFixed(2)}</div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-3 border-b border-slate-800 text-xs font-bold text-slate-400 uppercase">Historial en Supabase</div>
            <div className="divide-y divide-slate-800">
              {rides.map((r) => (
                <div key={r.id} className="p-3 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-white">{r.pickup} → {r.dropoff}</div>
                    <div className="text-slate-400">{r.service_type} • Estado: {r.status}</div>
                  </div>
                  <div className="font-bold text-emerald-400">$ {Number(r.fare).toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}