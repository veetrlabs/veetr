import { useEffect, useRef, useState } from 'react';
import { useBLE } from '../context/BLEContext';
import { getAllReadings } from '../utils/dataStorage';
import { isValidCoordinates } from '../utils/gpsValidation';
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
  const startLineMarkersRef = useRef<any[]>([]);
  const startLineRef = useRef<any>(null);
  const { state } = useBLE();
  const data = state.sailingData;
  const [isLoading, setIsLoading] = useState(true);

  // Debug: Log regatta data whenever it changes
  useEffect(() => {
    console.log('[Map] Sailing data update:', {
      portLat: data?.portLat,
      portLon: data?.portLon,
      starboardLat: data?.starboardLat,
      starboardLon: data?.starboardLon,
      hasStartLine: data?.hasStartLine
    });
  }, [data?.portLat, data?.portLon, data?.starboardLat, data?.starboardLon, data?.hasStartLine]);

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

      // Load last 50 readings for track and fallback position
      let trackReadings: any[] = [];
      try {
        trackReadings = await getAllReadings(50);
        console.log('[Map] Loaded track readings:', trackReadings.length);
        
        // Fallback to database if no live GPS
        if ((lat === 0 || lon === 0) && trackReadings.length > 0) {
          // Find most recent valid GPS reading (already in chronological order)
          const validReading = [...trackReadings].reverse().find(r => isValidCoordinates(r.lat, r.lon));
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
      const map = window.L.map(mapRef.current, {
        center: [lat, lon],
        zoom: lat === 50.0 && lon === 14.0 ? 5 : 20,
        zoomControl: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        scrollWheelZoom: true,
        boxZoom: true,
        keyboard: true,
      });

      // Add OpenStreetMap base layer
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add OpenSeaMap overlay
      window.L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
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
        const validPoints = readings.filter(r => isValidCoordinates(r.lat, r.lon));
        
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
            const polyline = window.L.polyline(coordinates, {
              color: '#3388ff',
              weight: 3,
              opacity: 0.7,
              smoothFactor: 1,
            }).addTo(map);
            
            markersRef.current.push(polyline);
          }
        });

        // Draw each point as a small circle with gradient opacity
        validPoints.forEach((point, index) => {
          const isLatest = index === validPoints.length - 1;
          // Calculate opacity: latest point = 1.0, oldest = 0.0, decrease by 2% per point
          const opacity = Math.max(0, 1 - ((validPoints.length - 1 - index) * 0.02));
          
          const marker = window.L.circleMarker([point.lat!, point.lon!], {
            radius: isLatest ? 5 : 3,
            fillColor: isLatest ? '#00bfff' : '#666', // Light blue for latest, grey for others
            color: isLatest ? '#fff' : '#666',
            weight: isLatest ? 2 : 1,
            opacity: opacity,
            fillOpacity: opacity,
            pane: isLatest ? 'markerPane' : 'overlayPane', // Latest on top
            zIndexOffset: isLatest ? 1000 : 0
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
      
      // Clean up start line markers and line
      startLineMarkersRef.current.forEach(marker => marker.remove());
      startLineMarkersRef.current = [];
      if (startLineRef.current) {
        startLineRef.current.remove();
        startLineRef.current = null;
      }
      
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

  // Update start line markers when regatta data changes
  useEffect(() => {
    console.log('[Map] Regatta effect check:', { 
      hasMap: !!mapInstanceRef.current, 
      hasLeaflet: !!window.L,
      portLat: data?.portLat,
      portLon: data?.portLon,
      starboardLat: data?.starboardLat,
      starboardLon: data?.starboardLon
    });

    if (!mapInstanceRef.current || !window.L) {
      console.log('[Map] Regatta effect: Map not ready yet');
      return;
    }

    // Get regatta coordinates from BLE context data
    const portLat = data?.portLat;
    const portLon = data?.portLon;
    const starboardLat = data?.starboardLat;
    const starboardLon = data?.starboardLon;

    console.log('[Map] Regatta effect triggered:', { portLat, portLon, starboardLat, starboardLon, hasData: !!data });

    // Clean up existing start line markers and line
    startLineMarkersRef.current.forEach(marker => marker.remove());
    startLineMarkersRef.current = [];
    if (startLineRef.current) {
      startLineRef.current.remove();
      startLineRef.current = null;
    }

    if (!portLat && !starboardLat) {
      console.log('[Map] No regatta coordinates available');
      return;
    }

    try {
      if (portLat && portLon) {
        // Add port marker (red)
        const portMarker = window.L.circleMarker([portLat, portLon], {
          radius: 8,
          fillColor: '#ff0000',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
          pane: 'markerPane' // Ensure it's on top
        }).addTo(mapInstanceRef.current);
        
        startLineMarkersRef.current.push(portMarker);
      }

      if (starboardLat && starboardLon) {
        // Add starboard marker (green)
        const starboardMarker = window.L.circleMarker([starboardLat, starboardLon], {
          radius: 8,
          fillColor: '#00ff00',
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
          pane: 'markerPane' // Ensure it's on top
        }).addTo(mapInstanceRef.current);
        
        startLineMarkersRef.current.push(starboardMarker);
      }

      // If both points are set, draw the start line
      if (portLat && portLon && starboardLat && starboardLon) {
        const startLine = window.L.polyline(
          [[portLat, portLon], [starboardLat, starboardLon]],
          {
            color: '#ff0000',
            weight: 4,
            opacity: 1,
            dashArray: '10, 5',
            pane: 'markerPane' // Render on top
          }
        ).addTo(mapInstanceRef.current);
        
        startLineRef.current = startLine;
        console.log('[Map] Start line drawn between port and starboard');
      }
    } catch (error) {
      console.error('[Map] Error adding regatta markers:', error);
    }
  }, [data?.portLat, data?.portLon, data?.starboardLat, data?.starboardLon, isLoading]); // Re-run when coordinates change OR map becomes ready

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
