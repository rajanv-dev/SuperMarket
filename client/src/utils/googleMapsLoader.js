import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let isConfigured = false;
let librariesPromise = null;

/**
 * Configure Google Maps JavaScript API options once.
 * Subsequent calls are safe no-ops to avoid warning/errors.
 */
export function configureGoogleMaps(apiKey) {
  if (isConfigured) return true;
  if (!apiKey || apiKey === 'your_google_maps_api_key_here' || typeof apiKey !== 'string' || !apiKey.trim()) {
    return false;
  }

  try {
    setOptions({
      key: apiKey.trim(),
      v: 'weekly',
    });
    isConfigured = true;
    return true;
  } catch (err) {
    console.warn('Google Maps setOptions notice:', err);
    return false;
  }
}

/**
 * Modern functional API library loader.
 * Loads 'maps', 'places', 'geocoding', and 'marker' libraries.
 * Handles single initialization and caches the promise.
 */
export async function loadGoogleMapsLibraries(apiKey) {
  const configured = configureGoogleMaps(apiKey);
  if (!configured && !isConfigured) {
    throw new Error('Google Maps API key is missing or unconfigured.');
  }

  if (!librariesPromise) {
    librariesPromise = (async () => {
      // 1. Core maps library
      const mapsLib = await importLibrary('maps');

      // 2. Geocoding and Places libraries
      const [placesLib, geocodingLib] = await Promise.all([
        importLibrary('places'),
        importLibrary('geocoding'),
      ]);

      // 3. Optional marker library (fallback to window.google.maps.Marker)
      let MarkerClass = null;
      try {
        const markerLib = await importLibrary('marker');
        MarkerClass = markerLib.Marker || window?.google?.maps?.Marker;
      } catch {
        MarkerClass = window?.google?.maps?.Marker;
      }

      return {
        Map: mapsLib.Map,
        Autocomplete: placesLib.Autocomplete,
        Geocoder: geocodingLib.Geocoder,
        Marker: MarkerClass || window?.google?.maps?.Marker,
      };
    })().catch((err) => {
      // Allow future retries on network error
      librariesPromise = null;
      throw err;
    });
  }

  return librariesPromise;
}
