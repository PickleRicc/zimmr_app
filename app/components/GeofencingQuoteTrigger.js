'use client';

import { useState, useEffect } from 'react';
import { MapPin, Clock, CheckCircle } from 'react-feather';

export default function GeofencingQuoteTrigger({ 
  appointmentLocation, 
  onQuoteTrigger,
  isEnabled = true 
}) {
  const [location, setLocation] = useState(null);
  const [isNearSite, setIsNearSite] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isEnabled || !appointmentLocation) return;

    // Request location permission and start watching
    if (navigator.geolocation) {
      const id = navigator.geolocation.watchPosition(
        handleLocationUpdate,
        handleLocationError,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000 // 1 minute
        }
      );
      setWatchId(id);

      return () => {
        if (id) navigator.geolocation.clearWatch(id);
      };
    } else {
      setError('Geolocation wird von diesem Browser nicht unterstützt');
    }
  }, [isEnabled, appointmentLocation]);

  const handleLocationUpdate = (position) => {
    const currentLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
    
    setLocation(currentLocation);
    setError(null);

    // Check if near appointment location
    if (appointmentLocation?.coordinates) {
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        appointmentLocation.coordinates.lat,
        appointmentLocation.coordinates.lng
      );

      // Trigger if within 100 meters and hasn't triggered yet
      const isNear = distance <= 0.1; // 100 meters in km
      setIsNearSite(isNear);

      if (isNear && !hasTriggered) {
        triggerQuoteCreation();
      }
    }
  };

  const handleLocationError = (error) => {
    console.error('Geolocation error:', error);
    switch (error.code) {
      case error.PERMISSION_DENIED:
        setError('Standortzugriff wurde verweigert');
        break;
      case error.POSITION_UNAVAILABLE:
        setError('Standort nicht verfügbar');
        break;
      case error.TIMEOUT:
        setError('Standortabfrage zeitüberschreitung');
        break;
      default:
        setError('Unbekannter Standortfehler');
        break;
    }
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };

  const triggerQuoteCreation = () => {
    setHasTriggered(true);
    onQuoteTrigger?.({
      triggeredAt: new Date().toISOString(),
      location: location,
      appointmentLocation: appointmentLocation,
      triggerType: 'geofence_arrival'
    });
  };

  const manualTrigger = () => {
    triggerQuoteCreation();
  };

  if (!isEnabled) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${isNearSite ? 'bg-green-500' : 'bg-gray-400'}`}>
          <MapPin className="text-white" size={20} />
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-green-900 mb-1">
            Standort-basierte Angebotserstellung
          </h3>
          
          {error ? (
            <div className="text-red-600 text-sm mb-2">
              ⚠️ {error}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  location ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
                <span className={location ? 'text-green-700' : 'text-gray-600'}>
                  {location ? 'Standort aktiv' : 'Standort wird ermittelt...'}
                </span>
              </div>
              
              {appointmentLocation && (
                <div className="text-sm text-green-700">
                  📍 Zieladresse: {appointmentLocation.address}
                </div>
              )}
              
              {location && appointmentLocation?.coordinates && (
                <div className="text-sm text-green-700">
                  📏 Entfernung: {(calculateDistance(
                    location.lat,
                    location.lng,
                    appointmentLocation.coordinates.lat,
                    appointmentLocation.coordinates.lng
                  ) * 1000).toFixed(0)}m
                </div>
              )}
            </div>
          )}
          
          <div className="mt-3 flex items-center gap-2">
            {hasTriggered ? (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle size={16} />
                <span className="text-sm font-medium">Angebot wurde ausgelöst</span>
              </div>
            ) : isNearSite ? (
              <div className="flex items-center gap-2">
                <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-700">
                  Am Einsatzort angekommen - Angebot wird erstellt
                </span>
              </div>
            ) : (
              <button
                onClick={manualTrigger}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1"
              >
                <Clock size={14} />
                Angebot jetzt erstellen
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-700">
        💡 <strong>Automatisch:</strong> Ein neues Angebot wird automatisch erstellt, wenn Sie am Einsatzort ankommen (100m Radius)
      </div>
    </div>
  );
}
