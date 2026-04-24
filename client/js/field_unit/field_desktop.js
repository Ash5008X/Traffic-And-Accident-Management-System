(() => {
  const authKey = 'nexustraffic_auth';
  let currentUser = null;
  let activeIncidentId = null;

  async function fetchDashboardData() {
    try {
      const authData = JSON.parse(localStorage.getItem(authKey) || 'null');
      if (!authData || !authData.token) {
        window.location.href = '../../index.html';
        return;
      }
      const token = authData.token;

      const res = await fetch('/api/field-units/dashboard/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      updateMissionUI(data.currentMission);
      updateStatsUI(data.statsToday);
      updateHeatmapUI(data.heatmap);
      updateMapMarkers(data.nearbyIncidents);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  }

  function updateMissionUI(mission) {
    const card = document.getElementById('active-mission-card');
    const empty = document.getElementById('no-mission-card');
    const brief = document.getElementById('briefing-card');
    const briefEmpty = document.getElementById('briefing-empty');

    if (!mission) {
      card.classList.add('hidden');
      empty.classList.remove('hidden');
      brief.classList.add('hidden');
      briefEmpty.classList.remove('hidden');
      activeIncidentId = null;
      return;
    }

    activeIncidentId = mission._id;
    card.classList.remove('hidden');
    empty.classList.add('hidden');
    brief.classList.remove('hidden');
    briefEmpty.classList.add('hidden');

    // Left card
    document.getElementById('mission-title').textContent = mission.title;
    document.getElementById('mission-id').textContent = mission._id.slice(-8).toUpperCase();
    document.getElementById('mission-severity').textContent = mission.severity.toUpperCase();
    document.getElementById('mission-severity').className = `critical-badge severity-${mission.severity}`;
    
    // Use reporter location if available, else mission location
    const loc = (mission.reporter && mission.reporter.location) ? mission.reporter.location : mission.location;
    if (loc) {
      document.getElementById('mission-coords').innerHTML = `${loc.lat.toFixed(3)} N<br/>${loc.lng.toFixed(3)} W`;
      document.getElementById('brief-coords').textContent = `${loc.lat.toFixed(4)} N, ${loc.lng.toFixed(4)} W`;
    }

    // Elapsed timer logic
    if (window.missionTimer) clearInterval(window.missionTimer);
    const start = new Date(mission.createdAt);
    const updateTimer = () => {
        const diff = Math.floor((new Date() - start) / 1000);
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        document.getElementById('mission-elapsed').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    updateTimer();
    window.missionTimer = setInterval(updateTimer, 1000);

    // Center Briefing
    document.getElementById('brief-id').textContent = `Incident_ID // ${mission._id.slice(-8).toUpperCase()}`;
    document.getElementById('brief-title').textContent = `${mission.title} // ${mission.type || 'STREET_LEVEL'}`;
    document.getElementById('brief-severity').textContent = mission.severity.toUpperCase();
    document.getElementById('brief-severity').className = `critical-badge severity-${mission.severity}`;
    document.getElementById('brief-desc').textContent = mission.description || 'No description provided.';
    
    if (mission.createdAt) {
        const date = new Date(mission.createdAt);
        document.getElementById('brief-time').textContent = date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    }
  }

  function updateStatsUI(stats) {
    document.getElementById('stat-assigned').textContent = String(stats.assigned || 0).padStart(2, '0');
    document.getElementById('stat-completed').textContent = String(stats.completed).padStart(2, '0');
    document.getElementById('stat-response').innerHTML = `${stats.avgResponseTime}<small> M</small>`;
    document.getElementById('stat-distance').innerHTML = `${stats.distance.toFixed(1)}<small> KM</small>`;
  }

  function updateHeatmapUI(heatmap) {
    if (!heatmap || !heatmap.zoneBreakdown) return;
    const zones = ['A', 'B', 'C', 'D', 'E', 'F'];
    const ZONE_COLORS_MAP = ['#FF3B30', '#FFB830', '#F97316', '#3A86FF', '#34C759', '#AF52DE'];

    zones.forEach((zone, idx) => {
      const count = heatmap.zoneBreakdown[zone] ?? 0;
      const countEl = document.getElementById(`zone-${zone}`);
      const cell = countEl ? countEl.closest('.zone-cell') : null;
      if (!cell) return;

      const labelEl = cell.querySelector('.barlow-800');
      const color = ZONE_COLORS_MAP[idx];

      // Update count
      if (countEl) {
        countEl.textContent = String(count).padStart(2, '0');
        countEl.style.color = count > 0 ? color : 'var(--nt-bright)';
        countEl.style.opacity = count > 0 ? '1' : '0.3';
      }

      // Apply zone-specific styling
      cell.style.backgroundColor = color + '15';
      cell.style.borderColor = color + '40';
      if (labelEl) labelEl.style.color = color;
    });

    if (heatmap.centerLat && heatmap.centerLng) {
      initMap(heatmap.centerLat, heatmap.centerLng);
    }
  }

  // ─── Leaflet map ─────────────────────────────────────────────────────────────
  let mapInitialized = false;
  function initMap(centerLat, centerLng) {
    if (mapInitialized) return;
    mapInitialized = true;

    const mapDiv = document.querySelector('.mini-map');
    if (!mapDiv) return;
    mapDiv.innerHTML = '<div id="leaflet-map" style="width:100%;height:100%;border-radius:inherit;z-index:0;"></div>';

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const loadLeaflet = () => new Promise(resolve => {
      if (window.L) return resolve();
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });

    loadLeaflet().then(() => {
      const L = window.L;
      const map = L.map('leaflet-map', {
        center: [centerLat, centerLng],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

      // 15km radius circle
      L.circle([centerLat, centerLng], {
        radius: 15000,
        color: '#F97316', weight: 2,
        fill: true, fillColor: '#F97316', fillOpacity: 0.07
      }).addTo(map);

      // Center marker
      L.circleMarker([centerLat, centerLng], {
        radius: 6, color: '#F97316', fillColor: '#F97316', fillOpacity: 1
      }).addTo(map);

      // 6 zone sector lines
      const ZONE_COLORS_MAP = ['#FF3B30','#FFB830','#F97316','#3A86FF','#34C759','#AF52DE'];
      const ZONE_LABELS = ['A','B','C','D','E','F'];
      const RADIUS_M = 15000;
      const LAT_DEG = RADIUS_M / 111320;
      const LNG_DEG = RADIUS_M / (111320 * Math.cos(centerLat * Math.PI / 180));

      for (let i = 0; i < 6; i++) {
        const bearing = i * 60;
        const endLat = centerLat + LAT_DEG * Math.cos(bearing * Math.PI / 180);
        const endLng = centerLng + LNG_DEG * Math.sin(bearing * Math.PI / 180);

        L.polyline([[centerLat, centerLng], [endLat, endLng]], {
          color: ZONE_COLORS_MAP[i], weight: 1, opacity: 0.5, dashArray: '4 4'
        }).addTo(map);

        const midBearing = bearing + 30;
        const midLat = centerLat + LAT_DEG * 0.55 * Math.cos(midBearing * Math.PI / 180);
        const midLng = centerLng + LNG_DEG * 0.55 * Math.sin(midBearing * Math.PI / 180);

        L.marker([midLat, midLng], {
          icon: L.divIcon({
            html: `<span style="font-family:'Outfit',sans-serif;font-weight:800;color:${ZONE_COLORS_MAP[i]};font-size:11px;text-shadow:0 0 4px #000">ZONE ${ZONE_LABELS[i]}</span>`,
            className: '', iconAnchor: [20, 10]
          })
        }).addTo(map);
      }
      window.leafletMap = map;
      updateMapMarkers(lastIncidents);
    });
  }

  let incidentMarkers = [];
  let lastIncidents = [];
  function updateMapMarkers(incidents) {
    lastIncidents = incidents || [];
    if (!window.leafletMap || !window.L) return;
    const L = window.L;
    const map = window.leafletMap;

    // Clear old markers
    incidentMarkers.forEach(m => map.removeLayer(m));
    incidentMarkers = [];

    const sevColors = { critical: '#FF3B30', high: '#FF6B35', medium: '#FFB830', low: '#34C759' };

    lastIncidents.forEach(inc => {
      if (!inc.location?.lat || !inc.location?.lng) return;
      if (inc.status === 'resolved' || inc.status === 'dismissed') return;

      const color = sevColors[inc.severity] || '#888';
      
      const marker = L.circleMarker([inc.location.lat, inc.location.lng], {
        radius: 6,
        color: color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 2
      }).addTo(map);

      marker.bindTooltip(`${inc.type?.toUpperCase()} [${inc.severity?.toUpperCase()}]`, {
        direction: 'top',
        className: 'nt-map-tooltip'
      });

      incidentMarkers.push(marker);
    });
  }

  async function handleArrived() {
    if (!activeIncidentId) return;
    try {
      const authData = JSON.parse(localStorage.getItem(authKey) || 'null');
      // Using generic field unit id check from token or fetching it
      // For simplicity, we use the agentId approach in backend
      const res = await fetch(`/api/field-units/me/arrived`, {
        method: 'PATCH',
        headers: { 
            'Authorization': `Bearer ${authData.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ incidentId: activeIncidentId })
      });
      if (res.ok) {
        alert('Arrival reported to dispatch.');
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Arrival error:', err);
    }
  }

  async function handleBackup() {
    if (!activeIncidentId) return;
    try {
      const authData = JSON.parse(localStorage.getItem(authKey) || 'null');
      const res = await fetch(`/api/incidents/${activeIncidentId}/backup-request`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${authData.token}`,
            'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        alert('Backup request sent to relief center.');
      }
    } catch (err) {
      console.error('Backup error:', err);
    }
  }

  async function handleResolve() {
    if (!activeIncidentId) return;
    if (!confirm('Are you sure you want to mark this incident as resolved?')) return;

    try {
      const authData = JSON.parse(localStorage.getItem(authKey) || 'null');
      const res = await fetch(`/api/incidents/${activeIncidentId}/status`, {
        method: 'PATCH',
        headers: { 
            'Authorization': `Bearer ${authData.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'resolved' })
      });
      if (res.ok) {
        alert('Incident resolved successfully.');
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Resolve error:', err);
    }
  }

  // ─── WebSocket Listeners ─────────────────────────────────────────────────────
  function initSocket() {
    const socket = (window.NexusAuth && typeof window.NexusAuth.initSocket === 'function')
      ? window.NexusAuth.initSocket()
      : null;

    if (socket) {
      // Listen for tactical updates (new assignments or status changes)
      socket.on('incident:new', () => {
        console.log('Tactical Update: New incidents available.');
        fetchDashboardData();
      });

      socket.on('incident:updated', (data) => {
        console.log('Tactical Update: Incident state changed.', data);
        fetchDashboardData();
      });

      socket.on('unit:statusChanged', (data) => {
        console.log('Tactical Update: Unit status changed.', data);
        fetchDashboardData();
      });
    }
  }

  // Bind events
  document.getElementById('btn-arrived')?.addEventListener('click', handleArrived);
  document.getElementById('btn-backup')?.addEventListener('click', handleBackup);
  document.getElementById('btn-resolve')?.addEventListener('click', handleResolve);

  // Initial fetch
  fetchDashboardData();
  initSocket();
  // Reduce polling as fallback
  setInterval(fetchDashboardData, 60000);

})();
