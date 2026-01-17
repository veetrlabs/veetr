import { useEffect, useRef, useState } from 'react';
import { useBLE } from '../context/BLEContext';
import { getAllReadings } from '../utils/dataStorage';
import '../styles/Map.css';

// Leaflet types will be loaded dynamically
declare global {
  interface Window {
    L: any;
  }
}

export default function Map() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const { data } = useBLE();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (!mapRef.current) return;

      // Load Leaflet if not already loaded
      if (!window.L) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        await new Promise((resolve) => {
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      if (!mounted) return;

      // Get GPS data from BLE or database
      let lat = data?.lat && data.lat !== 0 ? data.lat : 0;
      let lon = data?.lon && data.lon !== 0 ? data.lon : 0;

      console.log('[Map] Initial GPS from BLE:', { lat, lon, hasData: !!data });

      // Load last 1000 readings for track and fallback position
      let trackReadings: any[] = [];
      try {
        trackReadings = await getAllReadings(1000);
        console.log('[Map] Loaded track readings:', trackReadings.length);
        
        // Fallback to database if no live GPS
        if ((lat === 0 || lon === 0) && trackReadings.length > 0) {
          // Find most recent valid GPS reading (already in chronological order)
          const validReading = [...trackReadings].reverse().find(r => r.lat && r.lon && r.lat !== 0 && r.lon !== 0);
          if (validReading) {
            lat = validReading.lat;
            lon = validReading.lon;
            console.log('[Map] Using GPS from database:', { lat, lon });
          }
        }
      } catch (error) {
        console.error('[Map] Error loading readings:', error);
      }

      // Default to Prague if still no data
      if (lat === 0 || lon === 0) {
        console.warn('[Map] No valid GPS data, using default location');
        lat = 50.0;
        lon = 14.0;
      }

      console.log('[Map] Final map center:', { lat, lon });

      // Create map
      const map = L.map(mapRef.current, {
        center: [lat, lon],
        zoom: lat === 50.0 && lon === 14.0 ? 5 : 20,
        zoomControl: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        scrollWheelZoom: true,
        boxZoom: true,
        keyboard: true,
        tap: true,
      });

      // Add OpenStreetMap base layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add OpenSeaMap overlay
      L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: '© OpenSeaMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Load and display track history
      loadTrackHistory(map, trackReadings);

      setIsLoading(false);
      console.log('[Map] Initialized successfully at', lat, lon);
    };

    const loadTrackHistory = (map: any, readings: any[]) => {
      try {
        // Use the readings passed from initMap
        
        // Filter valid GPS coordinates
        const validPoints = readings.filter(r => r.lat && r.lon && r.lat !== 0 && r.lon !== 0);
        
        if (validPoints.length === 0) {
          console.log('[Map] No track history to display');
          return;
        }

        console.log(`[Map] Displaying ${validPoints.length} track points`);

        // Group points into segments based on time gaps (> 1 minute)
        const segments: Array<Array<typeof validPoints[0]>> = [];
        let currentSegment: Array<typeof validPoints[0]> = [];
        
        for (let i = 0; i < validPoints.length; i++) {
          currentSegment.push(validPoints[i]);
          
          // Check if next point has a time gap > 1 minute (60000ms)
          if (i < validPoints.length - 1) {
            const timeDiff = validPoints[i + 1].timestamp - validPoints[i].timestamp;
            if (timeDiff > 60000) {
              // Time gap detected, start new segment
              segments.push(currentSegment);
              currentSegment = [];
            }
          }
        }
        
        // Add the last segment
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
        }

        console.log(`[Map] Grouped into ${segments.length} track segments`);

        // Draw polylines for each segment
        segments.forEach((segment) => {
          if (segment.length > 1) {
            const coordinates = segment.map(p => [p.lat!, p.lon!]);
            const polyline = L.polyline(coordinates, {
              color: '#3388ff',
              weight: 3,
              opacity: 0.7,
              smoothFactor: 1,
            }).addTo(map);
            
            markersRef.current.push(polyline);
          }
        });

        // Draw each point as a small circle
        validPoints.forEach(point => {
          const marker = L.circleMarker([point.lat!, point.lon!], {
            radius: 3,
            fillColor: '#666',
            color: '#666',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.6,
          }).addTo(map);

          // Add tooltip with sensor data
          const tooltipContent = `
            <strong>${new Date(point.timestamp).toLocaleString()}</strong><br/>
            SOG: ${point.SOG?.toFixed(1) || 'N/A'} kt<br/>
            HDM: ${point.HDM?.toFixed(0) || 'N/A'}°<br/>
            AWS: ${point.AWS?.toFixed(1) || 'N/A'} kt<br/>
            AWA: ${point.AWA?.toFixed(0) || 'N/A'}°
          `;
          marker.bindTooltip(tooltipContent);

          markersRef.current.push(marker);
        });

      } catch (error) {
        console.error('[Map] Error loading track history:', error);
      }
    };

    initMap();

    return () => {
      mounted = false;
      // Clean up markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      
      // Clean up polylines
      polylinesRef.current.forEach(line => line.remove());
      polylinesRef.current = [];
      
      if (mapInstanceRef.current) {
        console.log('[Map] Cleaning up map instance');
        mapInstanceRef.current.off();
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      
      // Remove Leaflet's internal tracking
      const container = document.getElementById('map');
      if (container) {
        (container as any)._leaflet_id = undefined;
      }
    };
  }, []);

  const handleBack = () => {
    // Use state update instead of history.back()
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'dashboard' }));
  };

  return (
    <div className="map-page">
      <button 
        className="map-back-button"
        onClick={handleBack}
        aria-label="Go back to dashboard"
      >
        ← Back
      </button>
      
      {isLoading && (
        <div className="map-loading">Loading map...</div>
      )}
      
      <div 
        ref={mapRef} 
        className="map-container"
      />
    </div>
  );
}
