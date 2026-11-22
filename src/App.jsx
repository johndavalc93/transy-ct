import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  MapPin, Navigation, Car, Shield, DollarSign, Clock,
  CheckCircle, XCircle, User, Phone, Star, Sliders,
  RefreshCw, Radio, ChevronRight, Sparkles
} from 'lucide-react';

const DESTINATIONS = [
  { id: 'hvn', name: 'Tweed New Haven Airport (HVN)', miles: 6.5, baseTime: '14 min' },
  { id: 'union', name: 'New Haven Union Station', miles: 4.8, baseTime: '11 min' },
  { id: 'bdl', name: 'Bradley International Airport (BDL)', miles: 48.0, baseTime: '52 min' },
  { id: 'stamford', name: 'Stamford Transportation Center', miles: 42.5, baseTime: '48 min' },
  { id: 'jfk', name: 'JFK International Airport (NY)', miles: 86.0, baseTime: '1 hr 45 min' },
];

const PICKUPS = [
  'Hamden Center (Whitney Ave)',
  'Yale University / Downtown New Haven',
  'Milford Plaza / Post Rd',
  'Meriden Transit Center',
];

const TIERS = [
  { id: 'X', name: 'Transy X', desc: 'Económico • 4 pasajeros', ratePerMile: 2.1, baseFare: 5.0, eta: '3 min' },
  { id: 'XL', name: 'Transy XL', desc: 'SUV / Grupos • 6 pasajeros', ratePerMile: 2.9, baseFare: 8.5, eta: '5 min' },
  { id: 'VIP', name: 'Transy VIP', desc: 'Ejecutivo • Aeropuertos', ratePerMile: 3.8, baseFare: 14.0, eta: '6 min' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('rider'); // 'rider' | 'driver' | 'admin'
  const [brandName, setBrandName] = useState('TRANSY');
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  // Estado Cliente
  const [pickup, setPickup] = useState(PICKUPS[0]);
  const [destination, setDestination] = useState(DESTINATIONS[0]);
  const [selectedTier, setSelectedTier] = useState('X');
  const [promoApplied, setPromoApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Estado Conductor
  const [driverOnline, setDriverOnline] = useState(true);

  // Estado Admin
  const [commissionRate, setCommissionRate] = useState(0.15); // 15% plataforma
  const [surgeMultiplier, setSurgeMultiplier] = useState(1.0);

  // Cargar viajes iniciales y suscribirse a cambios en tiempo real
  useEffect(() => {
    fetchRides();

    const channel = supabase
      .channel('realtime-rides')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRides((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setRides((prev) =>
              prev.map((r) => (r.id === payload.new.id ? payload.new : r))
            );
          } else if (payload.eventType === 'DELETE') {
            setRides((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchRides() {
    setLoading(true);
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      setDbError(error.message);
    } else {
      setDbError(null);
      setRides(data || []);
    }
    setLoading(false);
  }

  const calculateFare = (tierObj) => {
    const raw = (tierObj.baseFare + destination.miles * tierObj.ratePerMile) * surgeMultiplier;
    const discounted = promoApplied ? raw * 0.85 : raw;
    return Number(discounted.toFixed(2));
  };

  // Crear solicitud de viaje en Supabase
  async function handleRequestRide() {
    setSubmitting(true);
    const tierObj = TIERS.find((t) => t.id === selectedTier);
    const fare = calculateFare(tierObj);
    const driverEarnings = Number((fare * (1 - commissionRate)).toFixed(2));

    const { data, error } = await supabase
      .from('rides')
      .insert([
        {
          pickup_address: pickup,
          dropoff_address: destination.name,
          tier: selectedTier,
          fare,
          driver_earnings: driverEarnings,
          status: 'requested',
        },
      ])
      .select()
      .single();

    if (error) {
      alert('Error al solicitar viaje: ' + error.message);
    } else if (data) {
      setRides((prev) => (prev.some((r) => r.id === data.id) ? prev : [data, ...prev]));
    }
    setSubmitting(false);
  }

  // Actualizar estado del viaje en Supabase
  async function updateRideStatus(rideId, newStatus) {
    const { data, error } = await supabase
      .from('rides')
      .update({ status: newStatus })
      .eq('id', rideId)
      .select()
      .single();

    if (error) {
      alert('Error actualizando estado: ' + error.message);
    } else if (data) {
      setRides((prev) => prev.map((r) => (r.id === data.id ? data : r)));
    }
  }

  const activeRiderRide = rides.find((r) =>
    ['requested', 'accepted', 'arrived', 'in_progress'].includes(r.status)
  );
  const pendingRequests = rides.filter((r) => r.status === 'requested');
  const activeDriverRide = rides.find((r) =>
    ['accepted', 'arrived', 'in_progress'].includes(r.status)
  );
  const completedRides = rides.filter((r) => r.status === 'completed');
  const totalRevenue = completedRides.reduce((acc, r) => acc + Number(r.fare || 0), 0);
  const totalDriverNet = completedRides.reduce((acc, r) => acc + Number(r.driver_earnings || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Barra superior de navegación */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-lg">
              {brandName.slice(0, 1)}
            </div>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value.toUpperCase())}
              className="bg-transparent font-extrabold tracking-wider text-lg text-white focus:outline-none border-b border-transparent focus:border-emerald-500 w-32"
              title="Haz clic para cambiar el nombre"
            />
            <span className="hidden sm:inline-flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/30">
              <Radio className="w-3 h-3 animate-pulse" /> Supabase Live
            </span>
          </div>

          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTab('rider')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'rider' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              App Cliente
            </button>
            <button
              onClick={() => setActiveTab('driver')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'driver' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              App Conductor
              {pendingRequests.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'admin' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Admin
            </button>
          </div>
        </div>
      </header>

      {/* Aviso de error de conexión o RLS si ocurre */}
      {dbError && (
        <div className="max-w-3xl mx-auto mt-4 px-4">
          <div className="bg-red-500/15 border border-red-500/40 text-red-200 p-4 rounded-2xl text-sm">
            <p className="font-bold">Aviso de Base de Datos (Supabase):</p>
            <p className="mt-1">{dbError}</p>
            <p className="mt-2 text-xs text-red-300">
              Verifica tu archivo .env y asegúrate de desactivar RLS temporalmente o crear políticas públicas en la tabla "rides".
            </p>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4 pb-16">
        {/* ================= VISTA 1: APP CLIENTE ================= */}
        {activeTab === 'rider' && (
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-br from-emerald-900/50 via-slate-900 to-slate-900 p-5 border-b border-slate-800">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold">
                  Connecticut Express
                </span>
                <button
                  onClick={fetchRides}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  title="Sincronizar"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <h2 className="text-xl font-bold text-white mb-4">¿A dónde vamos hoy?</h2>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Punto de partida</label>
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <select
                      value={pickup}
                      onChange={(e) => setPickup(e.target.value)}
                      className="bg-transparent text-sm text-white w-full focus:outline-none"
                    >
                      {PICKUPS.map((p) => (
                        <option key={p} value={p} className="bg-slate-900">
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Destino</label>
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5">
                    <Navigation className="w-4 h-4 text-amber-400 shrink-0" />
                    <select
                      value={destination.id}
                      onChange={(e) =>
                        setDestination(DESTINATIONS.find((d) => d.id === e.target.value))
                      }
                      className="bg-transparent text-sm text-white w-full focus:outline-none"
                    >
                      {DESTINATIONS.map((d) => (
                        <option key={d.id} value={d.id} className="bg-slate-900">
                          {d.name} ({d.miles} mi)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5">
              {activeRiderRide ? (
                <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
                      {activeRiderRide.status === 'requested' && 'Buscando conductor...'}
                      {activeRiderRide.status === 'accepted' && 'Conductor en camino'}
                      {activeRiderRide.status === 'arrived' && 'Tu conductor llegó'}
                      {activeRiderRide.status === 'in_progress' && 'Viaje en curso'}
                    </span>
                    <span className="text-lg font-extrabold text-white">
                      ${Number(activeRiderRide.fare).toFixed(2)}
                    </span>
                  </div>

                  <div className="text-sm space-y-1.5 text-slate-300">
                    <p><span className="text-slate-500">Origen:</span> {activeRiderRide.pickup_address}</p>
                    <p><span className="text-slate-500">Destino:</span> {activeRiderRide.dropoff_address}</p>
                    <p><span className="text-slate-500">Categoría:</span> {brandName} {activeRiderRide.tier}</p>
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                      <User className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">Jhon Valencia • 4.98 ★</p>
                      <p className="text-xs text-slate-400">Mazda 3 Blanco • Placa BT 94756</p>
                    </div>
                  </div>

                  {activeRiderRide.status === 'requested' && (
                    <button
                      onClick={() => updateRideStatus(activeRiderRide.id, 'cancelled')}
                      className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-bold transition"
                    >
                      Cancelar solicitud
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400">
                      Elige tu servicio ({destination.baseTime})
                    </span>
                    {surgeMultiplier > 1 && (
                      <span className="text-xs text-amber-400 font-semibold">
                        Tarifa dinámica {surgeMultiplier}x
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5 mb-4">
                    {TIERS.map((tier) => {
                      const price = calculateFare(tier);
                      const isSelected = selectedTier === tier.id;
                      return (
                        <button
                          key={tier.id}
                          onClick={() => setSelectedTier(tier.id)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-500'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-slate-900 text-emerald-400">
                              <Car className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-sm text-white">
                                {brandName} {tier.id}
                              </p>
                              <p className="text-xs text-slate-400">{tier.desc}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-extrabold text-base text-white">${price.toFixed(2)}</p>
                            <p className="text-xs text-emerald-400">{tier.eta}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between mb-4 px-1">
                    <button
                      onClick={() => setPromoApplied(!promoApplied)}
                      className="text-xs flex items-center gap-1.5 text-emerald-400 hover:underline"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {promoApplied ? 'Descuento 15% aplicado (CT15)' : 'Aplicar promo primer viaje (-15%)'}
                    </button>
                    <span className="text-xs text-slate-400">Apple Pay / •••• 4321</span>
                  </div>

                  <button
                    onClick={handleRequestRide}
                    disabled={submitting}
                    className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {submitting ? 'Conectando...' : `Confirmar ${brandName} ${selectedTier}`}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ================= VISTA 2: APP CONDUCTOR ================= */}
        {activeTab === 'driver' && (
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-5 space-y-5">
            <div className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div>
                <p className="text-xs text-slate-400">Estado del Conductor</p>
                <p className={`font-bold text-base ${driverOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {driverOnline ? 'En línea • Recibiendo viajes' : 'Desconectado'}
                </p>
              </div>
              <button
                onClick={() => setDriverOnline(!driverOnline)}
                className={`px-4 py-2 rounded-xl font-bold text-xs transition ${
                  driverOnline
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {driverOnline ? 'Conectado' : 'Conectarse'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400">Ganancia Neta Hoy</p>
                <p className="text-2xl font-extrabold text-emerald-400 mt-1">
                  ${totalDriverNet.toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400">Viajes Completados</p>
                <p className="text-2xl font-extrabold text-white mt-1">{completedRides.length}</p>
              </div>
            </div>

            {!driverOnline ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                Conéctate para empezar a recibir solicitudes en tiempo real.
              </div>
            ) : activeDriverRide ? (
              <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300">
                    Viaje Activo ({brandName} {activeDriverRide.tier})
                  </span>
                  <span className="text-lg font-extrabold text-emerald-400">
                    +${Number(activeDriverRide.driver_earnings).toFixed(2)} neto
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="text-slate-300">
                    <strong className="text-white">Recoger:</strong> {activeDriverRide.pickup_address}
                  </p>
                  <p className="text-slate-300">
                    <strong className="text-white">Dejar:</strong> {activeDriverRide.dropoff_address}
                  </p>
                </div>

                {activeDriverRide.status === 'accepted' && (
                  <button
                    onClick={() => updateRideStatus(activeDriverRide.id, 'arrived')}
                    className="w-full py-3 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-sm"
                  >
                    Marcar: Llegué al punto de recogida
                  </button>
                )}
                {activeDriverRide.status === 'arrived' && (
                  <button
                    onClick={() => updateRideStatus(activeDriverRide.id, 'in_progress')}
                    className="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-sm"
                  >
                    Iniciar viaje con pasajero
                  </button>
                )}
                {activeDriverRide.status === 'in_progress' && (
                  <button
                    onClick={() => updateRideStatus(activeDriverRide.id, 'completed')}
                    className="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-sm"
                  >
                    Finalizar viaje y cobrar
                  </button>
                )}
              </div>
            ) : pendingRequests.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase text-amber-400 tracking-wider">
                  Nuevas solicitudes disponibles ({pendingRequests.length})
                </p>
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold text-emerald-400">
                          {brandName} {req.tier}
                        </span>
                        <p className="text-sm font-bold text-white mt-0.5">{req.pickup_address}</p>
                        <p className="text-xs text-slate-400 mt-0.5">→ {req.dropoff_address}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold text-emerald-400">
                          ${Number(req.driver_earnings).toFixed(2)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Total: ${Number(req.fare).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => updateRideStatus(req.id, 'cancelled')}
                        className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => updateRideStatus(req.id, 'accepted')}
                        className="flex-2 w-2/3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold"
                      >
                        Aceptar Viaje
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-950 rounded-2xl border border-slate-800">
                <Car className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Esperando solicitudes de pasajeros...</p>
                <p className="text-xs text-slate-600 mt-1">
                  Prueba pedir un viaje desde la pestaña "App Cliente"
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= VISTA 3: PANEL ADMIN ================= */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Facturación Bruta Total</p>
                <p className="text-3xl font-extrabold text-white mt-1">${totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Comisión Plataforma ({Math.round(commissionRate * 100)}%)</p>
                <p className="text-3xl font-extrabold text-emerald-400 mt-1">
                  ${(totalRevenue - totalDriverNet).toFixed(2)}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <p className="text-xs text-slate-400">Viajes Registrados en DB</p>
                <p className="text-3xl font-extrabold text-white mt-1">{rides.length}</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-300 flex justify-between mb-2">
                  <span>Tarifa Dinámica (Surge Pricing)</span>
                  <span className="text-amber-400">{surgeMultiplier.toFixed(1)}x</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.1"
                  value={surgeMultiplier}
                  onChange={(e) => setSurgeMultiplier(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 flex justify-between mb-2">
                  <span>Comisión de la Plataforma</span>
                  <span className="text-emerald-400">{Math.round(commissionRate * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="0.30"
                  step="0.05"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-sm text-white">Historial en Tiempo Real (Supabase)</h3>
                <button
                  onClick={fetchRides}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase">
                    <tr>
                      <th className="px-4 py-3">Ruta</th>
                      <th className="px-4 py-3">Servicio</th>
                      <th className="px-4 py-3">Tarifa</th>
                      <th className="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rides.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-white">{r.pickup_address}</p>
                          <p className="text-slate-400">→ {r.dropoff_address}</p>
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-400">
                          {brandName} {r.tier}
                        </td>
                        <td className="px-4 py-3 font-bold text-white">
                          ${Number(r.fare).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-200 font-semibold">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {rides.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-4 py-8 text-center text-slate-500">
                          Aún no hay viajes guardados en Supabase.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

