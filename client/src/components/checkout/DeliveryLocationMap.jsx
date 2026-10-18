import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Home,
  Building,
  FileText,
  Edit2,
  Compass,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { loadGoogleMapsLibraries } from '../../utils/googleMapsLoader';

export default function DeliveryLocationMap({
  initialAddress = '',
  initialCity = '',
  initialPincode = '',
  onAddressSelect,
  isConfirmed = false,
  onConfirmChange,
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const isKeyConfigured = Boolean(
    apiKey &&
    apiKey !== 'your_google_maps_api_key_here' &&
    typeof apiKey === 'string' &&
    apiKey.trim() !== ''
  );

  // Address fields state
  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState(initialCity || '');
  const [postalCode, setPostalCode] = useState(initialPincode || '');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [coordinates, setCoordinates] = useState({ lat: 17.385044, lng: 78.486671 }); // Default Hyderabad / store region
  const [hasMarkerMoved, setHasMarkerMoved] = useState(false);

  // Map & API states
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');

  // DOM Refs
  const mapContainerRef = useRef(null);
  const autocompleteInputRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const geocoderRef = useRef(null);

  // Format the complete address string
  const formattedFullAddress = [
    houseNo ? `Flat/House ${houseNo}` : null,
    street,
    area,
    city,
    postalCode ? `PIN: ${postalCode}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  // Notify parent of address updates
  const notifyParent = (updates = {}) => {
    if (onAddressSelect) {
      const currentFullAddress = [
        (updates.houseNo !== undefined ? updates.houseNo : houseNo) ? `Flat/House ${updates.houseNo !== undefined ? updates.houseNo : houseNo}` : null,
        updates.street !== undefined ? updates.street : street,
        updates.area !== undefined ? updates.area : area,
        updates.city !== undefined ? updates.city : city,
        (updates.postalCode !== undefined ? updates.postalCode : postalCode) ? `PIN: ${updates.postalCode !== undefined ? updates.postalCode : postalCode}` : null,
      ]
        .filter(Boolean)
        .join(', ');

      onAddressSelect({
        formattedAddress: currentFullAddress,
        houseNo: updates.houseNo !== undefined ? updates.houseNo : houseNo,
        street: updates.street !== undefined ? updates.street : street,
        area: updates.area !== undefined ? updates.area : area,
        city: updates.city !== undefined ? updates.city : city,
        postalCode: updates.postalCode !== undefined ? updates.postalCode : postalCode,
        deliveryNotes: updates.deliveryNotes !== undefined ? updates.deliveryNotes : deliveryNotes,
        latitude: updates.lat !== undefined ? updates.lat : coordinates.lat,
        longitude: updates.lng !== undefined ? updates.lng : coordinates.lng,
      });
    }
  };

  // Reverse Geocoding helper
  const reverseGeocode = (lat, lng) => {
    if (!geocoderRef.current) return;
    try {
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const place = results[0];
          let detectedStreet = '';
          let detectedArea = '';
          let detectedCity = '';
          let detectedPin = '';

          (place.address_components || []).forEach((c) => {
            if (c.types.includes('route') || c.types.includes('street_address')) {
              detectedStreet = c.long_name;
            }
            if (c.types.includes('sublocality') || c.types.includes('neighborhood')) {
              detectedArea = c.long_name;
            }
            if (c.types.includes('locality')) {
              detectedCity = c.long_name;
            }
            if (c.types.includes('postal_code')) {
              detectedPin = c.long_name;
            }
          });

          if (detectedStreet) setStreet(detectedStreet);
          if (detectedArea) setArea(detectedArea);
          if (detectedCity) setCity(detectedCity);
          if (detectedPin) setPostalCode(detectedPin);

          notifyParent({
            street: detectedStreet || street,
            area: detectedArea || area,
            city: detectedCity || city,
            postalCode: detectedPin || postalCode,
            lat,
            lng,
          });
        }
      });
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    }
  };

  // Initialize Google Maps using the modern functional API
  useEffect(() => {
    let isMounted = true;
    let markerInstance = null;
    let placeChangeListener = null;
    const prevAuthFailure = window.gm_authFailure;

    window.gm_authFailure = () => {
      if (isMounted) {
        setMapError('Google Maps API key could not be authenticated (check domain/referrer restrictions in Google Cloud Console). Please enter your address manually.');
        setMapLoading(false);
      }
      if (typeof prevAuthFailure === 'function') {
        prevAuthFailure();
      }
    };

    if (!isKeyConfigured) {
      setMapLoading(false);
      return;
    }

    setMapLoading(true);
    setMapError(null);

    loadGoogleMapsLibraries(apiKey)
      .then(({ Map, Geocoder, Autocomplete, Marker }) => {
        if (!isMounted || !mapContainerRef.current) return;

        geocoderRef.current = new Geocoder();

        const map = new Map(mapContainerRef.current, {
          center: coordinates,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi.business',
              stylers: [{ visibility: 'off' }],
            },
          ],
        });
        mapInstanceRef.current = map;

        // Custom delivery marker
        if (Marker) {
          const marker = new Marker({
            position: coordinates,
            map,
            draggable: true,
            title: 'Drag to adjust your exact delivery entrance',
            animation: window?.google?.maps?.Animation?.DROP,
          });
          markerInstance = marker;
          markerInstanceRef.current = marker;

          // Handle marker dragend
          marker.addListener('dragend', (e) => {
            if (!isMounted) return;
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            setCoordinates({ lat: newLat, lng: newLng });
            setHasMarkerMoved(true);
            reverseGeocode(newLat, newLng);
          });
        }

        // Handle map click / tap to move marker
        map.addListener('click', (e) => {
          if (!isMounted) return;
          const newLat = e.latLng.lat();
          const newLng = e.latLng.lng();
          if (markerInstanceRef.current) {
            markerInstanceRef.current.setPosition(e.latLng);
          }
          setCoordinates({ lat: newLat, lng: newLng });
          setHasMarkerMoved(true);
          reverseGeocode(newLat, newLng);
        });

        // Setup Places Autocomplete
        if (autocompleteInputRef.current) {
          const autocomplete = new Autocomplete(autocompleteInputRef.current, {
            fields: ['formatted_address', 'geometry', 'address_components'],
            componentRestrictions: { country: 'in' },
          });

          placeChangeListener = autocomplete.addListener('place_changed', () => {
            if (!isMounted) return;
            const place = autocomplete.getPlace();
            if (!place.geometry || !place.geometry.location) {
              toast.error('Location details not found for this address. Please click on the map.');
              return;
            }

            const newLat = place.geometry.location.lat();
            const newLng = place.geometry.location.lng();

            map.setCenter(place.geometry.location);
            map.setZoom(17);
            if (markerInstanceRef.current) {
              markerInstanceRef.current.setPosition(place.geometry.location);
            }
            setCoordinates({ lat: newLat, lng: newLng });
            setHasMarkerMoved(true);

            // Parse address components
            let detectedStreet = '';
            let detectedArea = '';
            let detectedCity = '';
            let detectedPin = '';

            (place.address_components || []).forEach((c) => {
              if (c.types.includes('route') || c.types.includes('street_address')) {
                detectedStreet = c.long_name;
              }
              if (c.types.includes('sublocality') || c.types.includes('neighborhood')) {
                detectedArea = c.long_name;
              }
              if (c.types.includes('locality')) {
                detectedCity = c.long_name;
              }
              if (c.types.includes('postal_code')) {
                detectedPin = c.long_name;
              }
            });

            if (detectedStreet) setStreet(detectedStreet);
            if (detectedArea) setArea(detectedArea);
            if (detectedCity) setCity(detectedCity);
            if (detectedPin) setPostalCode(detectedPin);

            notifyParent({
              street: detectedStreet,
              area: detectedArea,
              city: detectedCity,
              postalCode: detectedPin,
              lat: newLat,
              lng: newLng,
            });

            toast.success('Location updated on map');
          });
        }

        setMapLoaded(true);
        setMapLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Google Maps API load error:', err);
        setMapError('Google Maps could not be loaded. Please enter your address details manually.');
        setMapLoading(false);
      });

    return () => {
      isMounted = false;
      window.gm_authFailure = prevAuthFailure;
      if (placeChangeListener && window?.google?.maps?.event?.removeListener) {
        window.google.maps.event.removeListener(placeChangeListener);
      }
      if (markerInstance && typeof markerInstance.setMap === 'function') {
        markerInstance.setMap(null);
      }
    };
  }, [apiKey, isKeyConfigured]);

  // Request & locate user's current GPS position
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        const newPos = { lat, lng };

        setCoordinates(newPos);
        setHasMarkerMoved(true);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(newPos);
          mapInstanceRef.current.setZoom(17);
        }
        if (markerInstanceRef.current) {
          markerInstanceRef.current.setPosition(newPos);
        }

        reverseGeocode(lat, lng);
        toast.success('Located your current position!');
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          toast.error('Location permission was denied. Please pick your location on the map or type address.');
        } else {
          toast.error('Could not retrieve current location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Confirm Delivery Location
  const handleConfirmAddress = (e) => {
    e.preventDefault();
    if (!houseNo.trim()) {
      return toast.error('Please enter your House/Flat or Building number');
    }
    if (!city.trim()) {
      return toast.error('Please specify your City');
    }
    if (!postalCode.trim()) {
      return toast.error('Please specify your Postal PIN code');
    }

    notifyParent();
    if (onConfirmChange) {
      onConfirmChange(true);
    }
    toast.success('Delivery location confirmed!');
  };

  return (
    <div className="space-y-4">
      {/* ── If Address is already Confirmed: Compact Summary Card ──────────── */}
      {isConfirmed ? (
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-slate-800 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Confirmed Delivery Location
                </span>
                <p className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                  {formattedFullAddress}
                </p>
                {deliveryNotes && (
                  <p className="text-xs text-slate-600 mt-1 italic">
                    Note: "{deliveryNotes}"
                  </p>
                )}
                {hasMarkerMoved && (
                  <p className="text-[10px] font-mono text-emerald-700 mt-1">
                    GPS Coordinates: {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onConfirmChange && onConfirmChange(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-700 text-xs font-bold hover:bg-emerald-100/50 shadow-2xs transition-colors shrink-0"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Change
            </button>
          </div>
        </div>
      ) : (
        /* ── Interactive Map & Address Entry View ──────────────────────────── */
        <div className="space-y-4">
          {/* Google Maps Search Bar & GPS Button (if API key present and no error) */}
          {isKeyConfigured && !mapError && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={autocompleteInputRef}
                    type="text"
                    value={autocompleteQuery}
                    onChange={(e) => setAutocompleteQuery(e.target.value)}
                    placeholder="Search building, society, landmark, or street..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-xl text-xs font-bold transition-colors shrink-0"
                  title="Detect my current location"
                >
                  <Navigation
                    className={`w-4 h-4 text-primary-600 ${isLocating ? 'animate-spin' : ''}`}
                  />
                  <span className="hidden sm:inline">Use Current Location</span>
                </button>
              </div>

              {/* Interactive Google Map Container */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs h-60 sm:h-72 bg-slate-100">
                <div ref={mapContainerRef} className="w-full h-full" />

                {mapLoading && (
                  <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-xs flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className="w-7 h-7 border-2 border-primary-600/30 border-t-primary-600 rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-slate-500 font-medium">Loading Google Maps...</p>
                    </div>
                  </div>
                )}

                {/* Floating Map Hint */}
                {mapLoaded && (
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-[11px] font-semibold text-slate-700 pointer-events-none flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-primary-600" />
                    Tap map or drag pin to your exact door
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notice if no API key */}
          {!isKeyConfigured && (
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">
                  Interactive Map Not Configured
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Google Maps API key is not configured in this environment. Please enter your complete delivery address manually below.
                </p>
              </div>
            </div>
          )}

          {/* Notice if map error */}
          {isKeyConfigured && mapError && (
            <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-950">
                  Google Maps Notice
                </p>
                <p className="text-[11px] text-rose-800 mt-0.5">
                  {mapError}
                </p>
              </div>
            </div>
          )}

          {/* ── Structured Address Form Fields ──────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* House / Flat No */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Flat / House / Building No. <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Home className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={houseNo}
                  onChange={(e) => {
                    setHouseNo(e.target.value);
                    notifyParent({ houseNo: e.target.value });
                  }}
                  placeholder="e.g. Flat 402, Royal Residency"
                  className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Street / Road */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Street / Road / Lane
              </label>
              <input
                type="text"
                value={street}
                onChange={(e) => {
                  setStreet(e.target.value);
                  notifyParent({ street: e.target.value });
                }}
                placeholder="e.g. 5th Main, 2nd Cross"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Area / Landmark */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Area / Colony / Landmark
              </label>
              <input
                type="text"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  notifyParent({ area: e.target.value });
                }}
                placeholder="e.g. Near Community Park"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* City */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                City <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    notifyParent({ city: e.target.value });
                  }}
                  placeholder="e.g. Hyderabad"
                  className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Postal Code */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                PIN Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={postalCode}
                onChange={(e) => {
                  setPostalCode(e.target.value);
                  notifyParent({ postalCode: e.target.value });
                }}
                placeholder="e.g. 500001"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
              />
            </div>

            {/* Delivery Instructions */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Delivery Instructions (Optional)
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={deliveryNotes}
                  onChange={(e) => {
                    setDeliveryNotes(e.target.value);
                    notifyParent({ deliveryNotes: e.target.value });
                  }}
                  placeholder="e.g. Leave with gate security / Ring bell"
                  className="w-full pl-10 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleConfirmAddress}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirm Delivery Address
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
