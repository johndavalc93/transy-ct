import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Navigation, Car, Shield, AlertCircle, RefreshCw,
  Compass, ExternalLink, MessageCircle, MessageSquare, User, X, Move, Calendar, Clock
} from 'lucide-react';
import { supabase } from './supabaseClient';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// CONFIGURACIÓN RÁPIDA (Pon aquí tu PIN y tu número de teléfono)
const ACCESS_PIN = '1804';
const DRIVER_PHONE = '13234554002'; // Formato: 1 + código de área + número (sin espacios ni guiones)

const TRANSLATIONS = {
  es: {
    subtitle: 'Traslados Privados en Connecticut',
    passengerTab: 'Pasajero',
    driverTab: 'Conductor',
    adminTab: 'Admin',
    restrictedTitle: 'Acceso Restringido',
    restrictedDesc: 'Ingresa tu PIN de conductor para abrir el panel de',
    pinError: 'PIN incorrecto. Intenta de nuevo.',
    cancel: 'Cancelar',
    enter: 'Entrar',
    useGps: 'Usar mi GPS',
    locating: 'Ubicando...',
    pinModeBtn: 'Mover pin en mapa',
    pinModeActive: 'Toca o arrastra el pin verde',
    pinHint: 'Arrastra el pin verde o toca el mapa para elegir el punto exacto de recogida.',
    gpsAlert: 'Activa los permisos de ubicación en tu teléfono para usar el GPS.',
    noGpsSupport: 'Tu navegador no soporta GPS.',
    expressHeader: 'Connecticut Express',
    nowOption: 'Viajar ahora',
    scheduleOption: 'Programar fecha y hora',
    dateLabel: 'Fecha',
    timeLabel: 'Hora',
    scheduledBadge: 'Programado',
    nowBadge: 'Inmediato',
    yourName: 'Tu nombre',
    namePlaceholder: 'Ej. Carlos Mendoza',
    pickupLabel: 'Punto de partida',
    pickupPlaceholder: 'Escribe tu dirección exacta...',
    dropoffLabel: 'Destino',
    dropoffPlaceholder: 'Escribe dirección exacta o aeropuerto...',
    searchingAddr: 'Buscando sugerencias...',
    requesting: 'Solicitando...',
    confirmBtn: 'Confirmar',
    defaultPassenger: 'Pasajero Transy',
    originWord: 'Origen',
    dropoffWord: 'Destino',
    serviceWord: 'Servicio',
    whenWord: 'Cuándo',
    nowValue: 'Lo antes posible (Ahora)',
    smsBtn: 'Enviar Mensaje (SMS)',
    whatsappBtn: 'WhatsApp',
    bookAnother: 'Pedir otro viaje',
    cancelRide: 'Cancelar solicitud',
    smsTemplate: (name, pickup, dropoff, whenText) =>
      `Hola, soy ${name}. Solicité un viaje Transy (${whenText}) desde ${pickup} hasta ${dropoff}.`,
    tiers: [
      { id: 'TRANSY X', name: 'TRANSY X', desc: 'Económico • 4 pasajeros', base: 4.5, perMile: 1.65, perMin: 0.25, eta: '3 min' },
      { id: 'TRANSY XL', name: 'TRANSY XL', desc: 'SUV / Grupos • 6 pasajeros', base: 7.5, perMile: 2.35, perMin: 0.35, eta: '5 min' },
      { id: 'TRANSY VIP', name: 'TRANSY VIP', desc: 'Ejecutivo / Aeropuertos', base: 14.0, perMile: 3.1, perMin: 0.45, eta: '8 min' }
    ],
    statuses: {
      pending: { title: 'Solicitud recibida • Buscando confirmación', badge: 'Pendiente', color: 'text-amber-400 bg-amber-500/20' },
      accepted: { title: '¡Viaje confirmado! Conductor asignado', badge: 'Aceptado', color: 'text-emerald-400 bg-emerald-500/20' },
      in_progress: { title: 'Viaje en curso hacia tu destino', badge: 'En ruta', color: 'text-sky-400 bg-sky-500/20' },
      completed: { title: 'Viaje finalizado. ¡Gracias por viajar con Transy!', badge: 'Completado', color: 'text-slate-300 bg-slate-700' }
    }
  },
  en: {
    subtitle: 'Connecticut Private Rides',
    passengerTab: 'Passenger',
    driverTab: 'Driver',
    adminTab: 'Admin',
    restrictedTitle: 'Restricted Access',
    restrictedDesc: 'Enter your driver PIN to open the panel for',
    pinError: 'Incorrect PIN. Please try again.',
    cancel: 'Cancel',
    enter: 'Enter',
    useGps: 'Use my GPS',
    locating: 'Locating...',
    pinModeBtn: 'Move pin on map',
    pinModeActive: 'Tap or drag green pin',
    pinHint: 'Drag the green pin or tap the map to pick your exact pickup spot.',
    gpsAlert: 'Please enable location permissions on your phone to use GPS.',
    noGpsSupport: 'Your browser does not support GPS.',
    expressHeader: 'Connecticut Express',
    nowOption: 'Ride now',
    scheduleOption: 'Schedule date & time',
    dateLabel: 'Date',
    timeLabel: 'Time',
    scheduledBadge: 'Scheduled',
    nowBadge: 'Immediate',
    yourName: 'Your name',
    namePlaceholder: 'e.g. John Smith',
    pickupLabel: 'Pickup location',
    pickupPlaceholder: 'Type your exact address...',
    dropoffLabel: 'Destination',
    dropoffPlaceholder: 'Type exact address or airport...',
    searchingAddr: 'Searching suggestions...',
    requesting: 'Requesting...',
    confirmBtn: 'Confirm',
    defaultPassenger: 'Transy Passenger',
    originWord: 'Pickup',
    dropoffWord: 'Dropoff',
    serviceWord: 'Service',
    whenWord: 'When',
    nowValue: 'As soon as possible (Now)',
    smsBtn: 'Send Text (SMS)',
    whatsappBtn: 'WhatsApp',
    bookAnother: 'Book another ride',
    cancelRide: 'Cancel request',
    smsTemplate: (name, pickup, dropoff, whenText) =>
      `Hi, I'm ${name}. I requested a Transy ride (${whenText}) from ${pickup} to ${dropoff}.`,
    tiers: [
      { id: 'TRANSY X', name: 'TRANSY X', desc: 'Economy • Up to 4 passengers', base: 4.5, perMile: 1.65, perMin: 0.25, eta: '3 min' },
      { id: 'TRANSY XL', name: 'TRANSY XL', desc: 'SUV / Groups • Up to 6 passengers', base: 7.5, perMile: 2.35, perMin: 0.35, eta: '5 min' },
      { id: 'TRANSY VIP', name: 'TRANSY VIP', desc: 'Executive / Airports', base: 14.0, perMile: 3.1, perMin: 0.45, eta: '8 min' }
    ],
    statuses: {
      pending: { title: 'Request received • Awaiting confirmation', badge: 'Pending', color: 'text-amber-400 bg-amber-500/20' },
      accepted: { title: 'Ride confirmed! Driver assigned', badge: 'Accepted', color: 'text-emerald-400 bg-emerald-500/20' },
      in_progress: { title: 'Ride in progress to your destination', badge: 'In Transit', color: 'text-sky-400 bg-sky-500/20' },
      completed: { title: 'Ride completed. Thank you for riding with Transy!', badge: 'Completed', color: 'text-slate-300 bg-slate-700' }
    }
  }
};

export default function App() {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('transy_lang');
    if (saved === 'en' || saved === 'es') return saved;
    return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
  });

  const t = TRANSLATIONS[lang];

  const changeLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('transy_lang', newLang);
  };

  const [role, setRole] = useState('passenger'); // passenger | driver | admin
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinModalTarget, setPinModalTarget] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);

  const [rides, setRides] = useState([]);
  const [currentRideId, setCurrentRideId] = useState(() => localStorage.getItem('transy_active_ride') || null);
  const [dbError, setDbError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Estado de programación (Ahora vs Fecha y Hora)
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState('06:00');
  const [rideScheduleMeta, setRideScheduleMeta] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('transy_ride_schedule') || '{}');
    } catch {
      return {};
    }
  });

  // Estado de ubicaciones y mapa
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [pickupCoords, setPickupCoords] = useState({ lat: 41.3839, lng: -72.9026 });
  const [dropoffCoords, setDropoffCoords] = useState({ lat: 41.2638, lng: -72.8868 });
  const [pinAdjustMode, setPinAdjustMode] = useState(false);

  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const [searchingType, setSearchingType] = useState(null);
  const searchTimerRef = useRef(null);

  const [routeStats, setRouteStats] = useState({ miles: 9.8, minutes: 18 });
  const [selectedTier, setSelectedTier] = useState('TRANSY X');
  const [passengerName, setPassengerName] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroup = useRef(null);
  const pinAdjustModeRef = useRef(false);

  useEffect(() => {
    pinAdjustModeRef.current = pinAdjustMode;
  }, [pinAdjustMode]);

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

  const handleRoleSwitch = (targetRole) => {
    if (targetRole === 'passenger' || isUnlocked) {
      setRole(targetRole);
      return;
    }
    setPinModalTarget(targetRole);
    setPinInput('');
    setPinError(false);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === ACCESS_PIN) {
      setIsUnlocked(true);
      setRole(pinModalTarget);
      setPinModalTarget(null);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const applyPickupPinLocation = async (lat, lng, fillIfEmpty = false) => {
    setPickupCoords({ lat, lng });
    if (!fillIfEmpty && pickupText.trim()) return;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      const addr = data.address || {};
      const street = [addr.house_number, addr.road].filter(Boolean).join(' ') || data.name;
      const cityState = [addr.city || addr.town || addr.village || addr.county, addr.state_code || addr.state].filter(Boolean).join(', ');
      const label = [street, cityState].filter(Boolean).join(', ');
      if (label && (!pickupText.trim() || fillIfEmpty)) {
        setPickupText(label);
      }
    } catch {
      // Mantiene el texto actual del usuario
    }
  };

  useEffect(() => {
    if (role !== 'passenger') return;
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([pickupCoords.lat, pickupCoords.lng], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    map.on('click', (e) => {
      if (!pinAdjustModeRef.current) return;
      applyPickupPinLocation(e.latlng.lat, e.latlng.lng, false);
    });

    layerGroup.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [role]);

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

            const pickupMarker = L.marker([pickupCoords.lat, pickupCoords.lng], { draggable: true }).addTo(layerGroup.current);
            pickupMarker.on('dragend', () => {
              const pos = pickupMarker.getLatLng();
              applyPickupPinLocation(pos.lat, pos.lng, false);
            });

            L.marker([dropoffCoords.lat, dropoffCoords.lng]).addTo(layerGroup.current);

            mapInstance.current.fitBounds(polyline.getBounds(), { padding: [35, 35] });
          }
        }
      } catch (err) {
        console.error('Error calculando ruta:', err);
      }
    };

    updateRoute();
  }, [pickupCoords, dropoffCoords, role]);

  const geocodeExactText = async (rawText, type) => {
    const clean = rawText.trim();
    if (!clean) return null;

    const withoutHouseNum = clean.replace(/^\d+\s+/, '');
    const queries = withoutHouseNum !== clean ? [clean, `${clean}, CT`, `${withoutHouseNum}, CT`] : [clean, `${clean}, CT`];

    for (const q of queries) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=us&limit=1&q=${encodeURIComponent(q)}`, {
          headers: { Accept: 'application/json' }
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          if (type === 'pickup') setPickupCoords(coords);
          else setDropoffCoords(coords);
          return coords;
        }
      } catch {
        // continúa al siguiente intento
      }
    }
    return null;
  };

  const searchAddress = (query, type) => {
    if (type === 'pickup') setPickupText(query);
    else setDropoffText(query);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (query.trim().length < 3) {
      type === 'pickup' ? setPickupSuggestions([]) : setDropoffSuggestions([]);
      setSearchingType(null);
      return;
    }

    setSearchingType(type);

    searchTimerRef.current = setTimeout(async () => {
      try {
        const typedTrimmed = query.trim();
        const withoutNum = typedTrimmed.replace(/^\d+\s+/, '');
        const searchTerm = withoutNum.length >= 3 ? withoutNum : typedTrimmed;

        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=6&q=${encodeURIComponent(searchTerm)}`;
        const nomRes = await fetch(nomUrl, { headers: { Accept: 'application/json' } });
        const nomData = await nomRes.json();

        let formatted = [];
        if (Array.isArray(nomData) && nomData.length > 0) {
          formatted = nomData.map((item) => {
            const addr = item.address || {};
            const streetName = item.name || addr.road || item.display_name.split(',')[0];
            const area = [
              addr.city || addr.town || addr.village || addr.hamlet || addr.county,
              addr.state_code || addr.state
            ]
              .filter(Boolean)
              .join(', ');

            const hasUserNumber = /^\d+/.test(typedTrimmed);
            const userPrefix = hasUserNumber ? typedTrimmed.split(/\s+/)[0] : '';
            const startsWithNum = /^\d+/.test(streetName);
            const finalStreet = hasUserNumber && !startsWithNum ? `${userPrefix} ${streetName}` : streetName;
            const fullLabel = area && !finalStreet.toLowerCase().includes(area.toLowerCase()) ? `${finalStreet}, ${area}` : finalStreet;

            return {
              title: finalStreet,
              subtitle: area || item.display_name,
              label: fullLabel,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon)
            };
          });
        }

        if (type === 'pickup') setPickupSuggestions(formatted);
        else setDropoffSuggestions(formatted);
      } catch (e) {
        console.error('Error buscando dirección:', e);
      } finally {
        setSearchingType(null);
      }
    }, 250);
  };

  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) {
      alert(t.noGpsSupport);
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
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          const addr = data.address || {};
          const street = [addr.house_number, addr.road].filter(Boolean).join(' ') || data.name;
          const cityState = [addr.city || addr.town || addr.village || addr.county, addr.state_code || addr.state].filter(Boolean).join(', ');
          const label = [street, cityState].filter(Boolean).join(', ') || `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
          setPickupText(label);
        } catch {
          setPickupText(`GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
        setGpsLoading(false);
      },
      () => {
        alert(t.gpsAlert);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const calculatePrice = (tier) => {
    const raw = tier.base + routeStats.miles * tier.perMile + routeStats.minutes * tier.perMin;
    return raw.toFixed(2);
  };

  const formatScheduleText = (scheduledFlag, dateVal, timeVal) => {
    if (!scheduledFlag || !dateVal || !timeVal) return t.nowValue;
    return `${dateVal} • ${timeVal}`;
  };

  const handleRequestRide = async () => {
    const basePickup = pickupText.trim() || `Pin (${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)})`;
    const finalDropoff = dropoffText.trim() || 'New Haven, CT';
    const whenLabel = formatScheduleText(isScheduled, scheduledDate, scheduledTime);
    const storedPickup = isScheduled ? `${basePickup} [${whenLabel}]` : basePickup;

    setLoading(true);
    if (pickupText.trim()) {
      await geocodeExactText(basePickup, 'pickup');
    }
    if (dropoffText.trim()) {
      await geocodeExactText(finalDropoff, 'dropoff');
    }

    const tierObj = t.tiers.find((item) => item.id === selectedTier) || t.tiers[0];
    const fare = parseFloat(calculatePrice(tierObj));

    const { data, error } = await supabase
      .from('rides')
      .insert([
        {
          passenger_name: passengerName.trim() || t.defaultPassenger,
          pickup: storedPickup,
          dropoff: finalDropoff,
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
      ])
      .select()
      .single();

    setLoading(false);
    setPinAdjustMode(false);
    if (error) {
      setDbError(error.message);
    } else if (data) {
      const updatedMeta = { ...rideScheduleMeta, [data.id]: whenLabel };
      setRideScheduleMeta(updatedMeta);
      localStorage.setItem('transy_ride_schedule', JSON.stringify(updatedMeta));
      setCurrentRideId(data.id);
      localStorage.setItem('transy_active_ride', data.id);
      fetchRides();
    }
  };

  const handleDismissTrackedRide = () => {
    setCurrentRideId(null);
    localStorage.removeItem('transy_active_ride');
  };

  const updateRideStatus = async (id, newStatus) => {
    const { error } = await supabase.from('rides').update({ status: newStatus }).eq('id', id);
    if (!error) fetchRides();
  };

  const trackedRide = rides.find((r) => r.id === currentRideId);
  const activeRides = rides.filter((r) => r.status !== 'completed' && r.status !== 'cancelled');
  const completedRides = rides.filter((r) => r.status === 'completed');
  const totalRevenue = completedRides.reduce((sum, r) => sum + Number(r.fare || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div
            onClick={() => {
              const next = logoTaps + 1;
              if (next >= 5) {
                setLogoTaps(0);
                handleRoleSwitch('driver');
              } else {
                setLogoTaps(next);
              }
            }}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-lg">
              T
            </div>
            <div>
              <h1 className="font-bold tracking-wider text-base leading-none">TRANSY</h1>
              <span className="text-[11px] text-emerald-400 font-medium">{t.subtitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-bold">
              <button
                onClick={() => changeLang('en')}
                className={`px-2 py-1 rounded-md transition ${lang === 'en' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                EN
              </button>
              <button
                onClick={() => changeLang('es')}
                className={`px-2 py-1 rounded-md transition ${lang === 'es' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                ES
              </button>
            </div>

            {isUnlocked && (
              <nav className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setRole('passenger')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${role === 'passenger' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'}`}
                >
                  {t.passengerTab}
                </button>
                <button
                  onClick={() => setRole('driver')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${role === 'driver' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'}`}
                >
                  {t.driverTab} ({activeRides.length})
                </button>
                <button
                  onClick={() => setRole('admin')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${role === 'admin' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'}`}
                >
                  {t.adminTab}
                </button>
              </nav>
            )}
          </div>
        </div>
      </header>

      {pinModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handlePinSubmit} className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-xs space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Shield className="w-5 h-5" />
              {t.restrictedTitle}
            </div>
            <p className="text-xs text-slate-400">
              {t.restrictedDesc} <strong className="text-white uppercase">{pinModalTarget}</strong>.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] text-white focus:border-emerald-500 focus:outline-none"
            />
            {pinError && <p className="text-xs text-red-400 text-center">{t.pinError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPinModalTarget(null)}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
              >
                {t.enter}
              </button>
            </div>
          </form>
        </div>
      )}

      {dbError && (
        <div className="max-w-xl mx-auto mt-4 px-4">
          <div className="bg-red-950/80 border border-red-500/50 text-red-200 p-3 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>Supabase Error: {dbError}</span>
          </div>
        </div>
      )}

      {role === 'passenger' && (
        <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
          <div className="space-y-1.5">
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-xl h-56 sm:h-64 bg-slate-900">
              <div ref={mapRef} className="w-full h-full z-10" />

              <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPinAdjustMode((prev) => !prev)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg border transition ${
                    pinAdjustMode
                      ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                      : 'bg-slate-900/90 hover:bg-slate-800 text-white border-slate-700'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  {pinAdjustMode ? t.pinModeActive : t.pinModeBtn}
                </button>

                <button
                  type="button"
                  onClick={handleUseCurrentGPS}
                  disabled={gpsLoading}
                  className="bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-emerald-500/40 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg"
                >
                  <Compass className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
                  {gpsLoading ? t.locating : t.useGps}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 px-1">{t.pinHint}</p>
          </div>

          {trackedRide ? (
            <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${t.statuses[trackedRide.status]?.color || 'bg-slate-800 text-white'}`}>
                  {t.statuses[trackedRide.status]?.badge || trackedRide.status}
                </span>
                <span className="text-lg font-black text-white">$ {Number(trackedRide.fare).toFixed(2)}</span>
              </div>

              <div>
                <h2 className="text-base font-bold text-white">
                  {t.statuses[trackedRide.status]?.title}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t.serviceWord} {trackedRide.service_type} • {trackedRide.distance_miles} mi ({trackedRide.duration_min} min)
                </p>
              </div>

              <div className="space-y-2 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>{t.whenWord}:</strong> {rideScheduleMeta[trackedRide.id] || t.nowValue}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>{t.originWord}:</strong> {trackedRide.pickup}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Navigation className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span><strong>{t.dropoffWord}:</strong> {trackedRide.dropoff}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <a
                  href={`sms:+${DRIVER_PHONE}?&body=${encodeURIComponent(
                    t.smsTemplate(
                      trackedRide.passenger_name,
                      trackedRide.pickup,
                      trackedRide.dropoff,
                      rideScheduleMeta[trackedRide.id] || t.nowValue
                    )
                  )}`}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  {t.smsBtn}
                </a>

                <a
                  href={`https://wa.me/${DRIVER_PHONE}?text=${encodeURIComponent(
                    t.smsTemplate(
                      trackedRide.passenger_name,
                      trackedRide.pickup,
                      trackedRide.dropoff,
                      rideScheduleMeta[trackedRide.id] || t.nowValue
                    )
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t.whatsappBtn}
                </a>
              </div>

              {trackedRide.status === 'completed' || trackedRide.status === 'cancelled' ? (
                <button
                  onClick={handleDismissTrackedRide}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl text-xs"
                >
                  {t.bookAnother}
                </button>
              ) : (
                <button
                  onClick={() => {
                    updateRideStatus(trackedRide.id, 'cancelled');
                    handleDismissTrackedRide();
                  }}
                  className="w-full bg-transparent hover:bg-red-950/40 text-slate-400 hover:text-red-300 font-medium py-2 rounded-xl text-xs"
                >
                  {t.cancelRide}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase">{t.expressHeader}</span>
                <span className="text-xs text-slate-400">{routeStats.miles} mi • {routeStats.minutes} min</span>
              </div>

              {/* Selector: Viajar ahora vs Programar fecha y hora */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsScheduled(false)}
                  className={`py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                    !isScheduled ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {t.nowOption}
                </button>
                <button
                  type="button"
                  onClick={() => setIsScheduled(true)}
                  className={`py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                    isScheduled ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {t.scheduleOption}
                </button>
              </div>

              {isScheduled && (
                <div className="grid grid-cols-2 gap-2.5 bg-slate-950/70 border border-emerald-500/30 p-3 rounded-xl">
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">{t.dateLabel}</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">{t.timeLabel}</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t.yourName}</label>
                <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 focus-within:border-emerald-500">
                  <User className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className="bg-transparent w-full text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="relative">
                <label className="text-xs text-slate-400 mb-1 block">{t.pickupLabel}</label>
                <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 focus-within:border-emerald-500">
                  <MapPin className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={pickupText}
                    onChange={(e) => searchAddress(e.target.value, 'pickup')}
                    onBlur={() => {
                      setTimeout(() => {
                        setPickupSuggestions([]);
                        geocodeExactText(pickupText, 'pickup');
                      }, 180);
                    }}
                    placeholder={t.pickupPlaceholder}
                    className="bg-transparent w-full text-sm text-white focus:outline-none"
                  />
                  {pickupText && (
                    <button
                      type="button"
                      onClick={() => {
                        setPickupText('');
                        setPickupSuggestions([]);
                      }}
                      className="text-slate-400 hover:text-white ml-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {(searchingType === 'pickup' || pickupSuggestions.length > 0) && (
                  <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-40 overflow-hidden max-h-60 overflow-y-auto">
                    {searchingType === 'pickup' && pickupSuggestions.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs text-slate-400">{t.searchingAddr}</div>
                    ) : (
                      pickupSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setPickupText(item.label);
                            setPickupCoords({ lat: item.lat, lng: item.lng });
                            setPickupSuggestions([]);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-800 border-b border-slate-800/70 last:border-0 flex items-start gap-2.5"
                        >
                          <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{item.title}</div>
                            {item.subtitle && <div className="text-[11px] text-slate-400 truncate">{item.subtitle}</div>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="text-xs text-slate-400 mb-1 block">{t.dropoffLabel}</label>
                <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 focus-within:border-emerald-500">
                  <Navigation className="w-4 h-4 text-amber-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={dropoffText}
                    onChange={(e) => searchAddress(e.target.value, 'dropoff')}
                    onBlur={() => {
                      setTimeout(() => {
                        setDropoffSuggestions([]);
                        geocodeExactText(dropoffText, 'dropoff');
                      }, 180);
                    }}
                    placeholder={t.dropoffPlaceholder}
                    className="bg-transparent w-full text-sm text-white focus:outline-none"
                  />
                  {dropoffText && (
                    <button
                      type="button"
                      onClick={() => {
                        setDropoffText('');
                        setDropoffSuggestions([]);
                      }}
                      className="text-slate-400 hover:text-white ml-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {(searchingType === 'dropoff' || dropoffSuggestions.length > 0) && (
                  <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-40 overflow-hidden max-h-60 overflow-y-auto">
                    {searchingType === 'dropoff' && dropoffSuggestions.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs text-slate-400">{t.searchingAddr}</div>
                    ) : (
                      dropoffSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setDropoffText(item.label);
                            setDropoffCoords({ lat: item.lat, lng: item.lng });
                            setDropoffSuggestions([]);
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-800 border-b border-slate-800/70 last:border-0 flex items-start gap-2.5"
                        >
                          <Navigation className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{item.title}</div>
                            {item.subtitle && <div className="text-[11px] text-slate-400 truncate">{item.subtitle}</div>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2">
                {t.tiers.map((tier) => {
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
                        <div className="text-[11px] text-emerald-400">{isScheduled ? t.scheduledBadge : tier.eta}</div>
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
                {loading ? t.requesting : `${t.confirmBtn} ${selectedTier}`}
              </button>
            </div>
          )}
        </main>
      )}

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
                      <div className="text-sm font-bold text-white mt-1.5">{ride.passenger_name}</div>
                      <div className="text-xs text-slate-400">{ride.distance_miles} mi • {ride.duration_min} min</div>
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

                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${mapsDestination}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <ExternalLink className="w-4 h-4 text-emerald-400" />
                    Navegar con GPS (Google / Apple Maps)
                  </a>

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
                    <div className="font-semibold text-white">{r.passenger_name}: {r.pickup} → {r.dropoff}</div>
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
