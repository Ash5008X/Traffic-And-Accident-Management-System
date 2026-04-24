/**
 * relief_dashboard.js
 * - Fetches real incidents within 5km of admin's saved location
 * - Left column: live incident cards; click to reveal detail panel
 * - Center column: hidden until incident selected; shows real chat log
 * - Action buttons: EN ROUTE, RESOLVED, SEND UPDATE TO USER
 * - Chat send: posts message to incident AND creates user notification
 * - Right column: live stats + zone heatmap + Leaflet map
 */
(() => {
  const API_BASE = window.NEXUS_API_BASE || 'http://localhost:5000/api';
  const AUTH_KEY = 'nexustraffic_auth';

  // ─── Auth helpers ────────────────────────────────────────────────────────────
  function getToken() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY))?.token; } catch { return null; }
  }

  async function apiFetch(path, opts = {}) {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {})
      }
    });
    if (!res.ok) throw new Error(`API ${path} failed (${res.status})`);
    return res.json();
  }

  // ─── Clock ───────────────────────────────────────────────────────────────────
  function startClock() {
    const el = document.getElementById('clock');
    if (!el) return;
    const tick = () => {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} UTC`;
    };
    tick();
    setInterval(tick, 1000);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function severityColor(sev) {
    return { critical: '#FF3B30', high: '#FF6B35', medium: '#FFB830', low: '#34C759' }[sev] || '#888';
  }

  function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
    if (diff < 1) return 'JUST NOW';
    return `${diff}M AGO`;
  }

  function elapsedTimer(dateStr) {
    const start = new Date(dateStr);
    const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function formatTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  // ─── State ───────────────────────────────────────────────────────────────────
  let selectedIncident = null;
  let elapsedInterval = null;
  let allActiveIncidents = [];

  // ─── Detail panel show/hide ──────────────────────────────────────────────────
  function showDetailPanel() {
    document.getElementById('detail-empty').style.display = 'none';
    const panel = document.getElementById('detail-panel');
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
  }

  function hideDetailPanel() {
    document.getElementById('detail-empty').style.display = 'flex';
    document.getElementById('detail-panel').style.display = 'none';
    selectedIncident = null;
    if (elapsedInterval) clearInterval(elapsedInterval);
  }

  // ─── Render incident cards ───────────────────────────────────────────────────
  function renderIncidentList(incidents) {
    const container = document.querySelector('.col-left .flex-1.p-4');
    if (!container) return;
    container.innerHTML = '';

    if (incidents.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12" style="color:var(--nt-dim)">
          <span class="material-symbols-outlined text-5xl block mb-3" style="color:var(--nt-dim);opacity:0.4">check_circle</span>
          <p class="outfit text-xs" style="opacity:0.5">No active incidents in 15 km zone</p>
        </div>`;
      return;
    }

    incidents.forEach(inc => {
      const color = severityColor(inc.severity);
      const sev = (inc.severity || 'low').toUpperCase();
      const isSelected = selectedIncident && String(selectedIncident._id) === String(inc._id);

      const card = document.createElement('div');
      card.className = `nt-card hoverable p-4 rounded border-l-4 cursor-pointer transition-all`;
      card.style.borderLeftColor = color;
      if (isSelected) card.style.outline = `1px solid ${color}`;

      card.innerHTML = `
        <div class="flex justify-between items-start mb-2">
          <span class="fira-code text-[10px]" style="color:${color}">${sev} // ${inc.incidentId || inc._id?.toString().slice(-6).toUpperCase()}</span>
          <span class="fira-code text-[10px]" style="color:var(--nt-dim)">${timeAgo(inc.createdAt)}</span>
        </div>
        <h3 class="barlow-800 text-base leading-tight mb-1" style="color:var(--nt-bright)">${(inc.type || 'INCIDENT').toUpperCase()}</h3>
        <div class="fira-code text-[10px] mb-1" style="color:#F97316">ZONE ${inc.zone || '?'} · ${inc.distanceKm != null ? inc.distanceKm.toFixed(2)+' km' : ''}</div>
        <div class="fira-code text-[10px] mb-3" style="color:var(--nt-dim)">
          ${inc.location?.lat?.toFixed(4) ?? '—'}° N, ${inc.location?.lng?.toFixed(4) ?? '—'}° E
        </div>
        <div class="flex gap-2">
          <button class="btn-view flex-1 outfit text-xs font-bold bg-[#F97316] text-white py-2 rounded">VIEW</button>
          <button class="btn-dismiss-card flex-1 outfit text-xs font-bold py-2 rounded">DISMISS</button>
        </div>`;

      // VIEW = open detail
      card.querySelector('.btn-view').addEventListener('click', e => {
        e.stopPropagation();
        openIncidentDetail(inc);
        // Highlight selected card
        document.querySelectorAll('.col-left .nt-card').forEach(c => c.style.outline = '');
        card.style.outline = `1px solid ${color}`;
      });

      // DISMISS
      card.querySelector('.btn-dismiss-card').addEventListener('click', async e => {
        e.stopPropagation();
        try {
          await apiFetch(`/incidents/${inc._id}/dismiss`, { method: 'PATCH', body: JSON.stringify({ status: 'dismissed' }) });
          card.remove();
          if (selectedIncident && String(selectedIncident._id) === String(inc._id)) hideDetailPanel();
          await refreshStats();
        } catch (err) { console.error('Dismiss failed:', err); }
      });

      // Click card = also open detail
      card.addEventListener('click', () => {
        openIncidentDetail(inc);
        document.querySelectorAll('.col-left .nt-card').forEach(c => c.style.outline = '');
        card.style.outline = `1px solid ${color}`;
      });

      container.appendChild(card);
    });
  }

  // ─── Open detail panel for incident ─────────────────────────────────────────
  function openIncidentDetail(inc) {
    selectedIncident = inc;
    showDetailPanel();

    const color = severityColor(inc.severity);

    // Header
    document.getElementById('detail-header').style.borderLeftColor = color;
    const statusEl = document.getElementById('detail-status');
    statusEl.textContent = (inc.status || 'pending').toUpperCase().replace(/_/g, ' ');
    statusEl.style.color = color;
    statusEl.style.background = color + '22';

    document.getElementById('detail-id').textContent =
      `INCIDENT_ID // ${inc.incidentId || inc._id}`;

    document.getElementById('detail-title').textContent =
      `${(inc.type || 'INCIDENT').toUpperCase()} // ZONE ${inc.zone || '?'}`;

    document.getElementById('detail-coords').textContent =
      `${inc.location?.lat?.toFixed(4) ?? '—'}° N, ${inc.location?.lng?.toFixed(4) ?? '—'}° E`;

    document.getElementById('detail-desc').textContent =
      inc.description || 'No description provided.';

    // Elapsed timer
    if (elapsedInterval) clearInterval(elapsedInterval);
    const elapsedEl = document.getElementById('detail-elapsed');
    const updateElapsed = () => { elapsedEl.textContent = elapsedTimer(inc.createdAt); };
    updateElapsed();
    elapsedInterval = setInterval(updateElapsed, 1000);

    // Chat log
    renderChatLog(inc.chat || []);

    // Wire action buttons
    wireActionButtons(inc);

    // Footer coords
    const footerSpans = document.querySelectorAll('footer .flex .fira-code');
    if (footerSpans[0]) footerSpans[0].textContent = `LAT: ${inc.location?.lat?.toFixed(4) ?? '—'}`;
    if (footerSpans[1]) footerSpans[1].textContent = `LONG: ${inc.location?.lng?.toFixed(4) ?? '—'}`;
  }

  // ─── Render chat log ─────────────────────────────────────────────────────────
  function renderChatLog(chat) {
    const log = document.getElementById('chat-log');
    if (!log) return;
    log.innerHTML = '';

    if (!chat || chat.length === 0) {
      log.innerHTML = `<p class="outfit text-xs" style="color:var(--nt-dim);opacity:0.5">No messages yet.</p>`;
      return;
    }

    chat.forEach(msg => {
      const isAdmin = msg.senderRole === 'relief_admin';
      const wrapper = document.createElement('div');
      wrapper.className = `flex flex-col ${isAdmin ? 'items-end' : 'items-start'} space-y-1`;

      if (isAdmin) {
        wrapper.innerHTML = `
          <div class="bubble-out p-3 rounded-xl rounded-tr-none max-w-[80%] shadow-lg">
            <p class="outfit text-sm font-medium">${escHtml(msg.message)}</p>
          </div>
          <span class="fira-code text-[10px] mr-1" style="color:var(--nt-dim)">RELIEF_CENTER // ${formatTime(msg.timestamp)}</span>`;
      } else {
        wrapper.innerHTML = `
          <div class="bubble-in p-3 rounded-xl rounded-tl-none max-w-[80%] border border-[#1F3448]/50">
            <p class="outfit text-sm" style="color:var(--nt-bright)">${escHtml(msg.message)}</p>
          </div>
          <span class="fira-code text-[10px] ml-1" style="color:var(--nt-dim)">USER_MOBILE // ${formatTime(msg.timestamp)}</span>`;
      }

      log.appendChild(wrapper);
    });

    // Scroll to bottom
    log.scrollTop = log.scrollHeight;
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Append a single chat bubble optimistically
  function appendChatBubble(message, role) {
    const log = document.getElementById('chat-log');
    if (!log) return;
    const isAdmin = role === 'relief_admin';
    const wrapper = document.createElement('div');
    wrapper.className = `flex flex-col ${isAdmin ? 'items-end' : 'items-start'} space-y-1`;
    const now = new Date();
    if (isAdmin) {
      wrapper.innerHTML = `
        <div class="bubble-out p-3 rounded-xl rounded-tr-none max-w-[80%] shadow-lg">
          <p class="outfit text-sm font-medium">${escHtml(message)}</p>
        </div>
        <span class="fira-code text-[10px] mr-1" style="color:var(--nt-dim)">RELIEF_CENTER // ${formatTime(now.toISOString())}</span>`;
    }
    log.appendChild(wrapper);
    log.scrollTop = log.scrollHeight;
  }

  // ─── Wire action buttons ─────────────────────────────────────────────────────
  function wireActionButtons(inc) {
    const btnEnRoute = document.getElementById('btn-en-route');
    const btnResolve = document.getElementById('btn-resolve');
    const btnSend    = document.getElementById('btn-send-update');
    const chatSend   = document.getElementById('chat-send');
    const chatInput  = document.getElementById('chat-input');

    // Clone to remove old listeners
    [btnEnRoute, btnResolve, btnSend, chatSend].forEach(btn => {
      if (!btn) return;
      const clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
    });

    // Re-grab after clone
    document.getElementById('btn-en-route')?.addEventListener('click', async () => {
      await updateStatus(inc._id, 'en_route', "Your request is acknowledged and a team is enrouted to your position");
    });

    document.getElementById('btn-resolve')?.addEventListener('click', async () => {
      await updateStatus(inc._id, 'resolved', "Your request has been resolved");
    });

    document.getElementById('btn-dismiss')?.addEventListener('click', async () => {
      await updateStatus(inc._id, 'dismissed', "Your request has been dismissed");
    });

    // Chat send button
    document.getElementById('chat-send')?.addEventListener('click', () => sendMessage(inc));

    // Enter key
    const newInput = document.getElementById('chat-input');
    newInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') sendMessage(inc);
    });
  }

  async function updateStatus(incidentId, status, notifMessage = null) {
    try {
      // 1. Update the actual incident status
      const path = status === 'dismissed' ? `/incidents/${incidentId}/dismiss` : `/incidents/${incidentId}/status`;
      const method = status === 'dismissed' ? 'DELETE' : 'PATCH'; // Check if DELETE or PATCH is used for dismiss

      // Actually, looking at incidentController.js:169, it's not specified in routes yet?
      // Wait, let's check incidentRoutes.js.
      
      await apiFetch(path, {
        method: status === 'dismissed' ? 'PATCH' : 'PATCH',
        body: JSON.stringify({ status })
      });

      // 2. If there's a notification message, send it via the notify endpoint
      if (notifMessage && selectedIncident) {
        await apiFetch('/alerts/incident-notify', {
          method: 'POST',
          body: JSON.stringify({ 
            incidentId: String(selectedIncident._id), 
            message: notifMessage,
            skipChat: true // Automated updates don't go to chat log
          })
        });
        // We do NOT appendChatBubble here as requested
      }

      // Refresh panel and list
      await loadDashboard();
    } catch (err) {
      console.error('Status update failed:', err);
    }
  }

  async function sendMessage(inc) {
    const input = document.getElementById('chat-input');
    const message = input?.value?.trim();
    if (!message || !inc) return;

    input.value = '';
    appendChatBubble(message, 'relief_admin'); // optimistic

    try {
      // POST to /api/alerts/incident-notify which:
      // 1) Saves chat message on incident
      // 2) Creates targeted alert for the reporting user
      await apiFetch('/alerts/incident-notify', {
        method: 'POST',
        body: JSON.stringify({ incidentId: String(inc._id), message })
      });
    } catch (err) {
      console.error('Send message failed:', err);
    }
  }

  // ─── Update stats chips ──────────────────────────────────────────────────────
  function renderStats(stats) {
    const chips = document.querySelectorAll('.stat-chip span.barlow-800');
    if (chips.length >= 3) {
      chips[0].textContent = String(stats.activeCount ?? 0).padStart(2, '0');
      chips[1].textContent = String(stats.resolvedTodayCount ?? 0).padStart(2, '0');
      if (stats.avgResponseMinutes != null) {
        const m = stats.avgResponseMinutes;
        chips[2].textContent = `${Math.floor(m / 60) > 0 ? Math.floor(m / 60) + 'H ' : ''}${m % 60}M`;
      } else {
        chips[2].textContent = 'N/A';
      }
    }
    const badge = document.querySelector('.queue-header .bg-\\[\\#FF3B30\\]');
    if (badge) badge.textContent = `${stats.activeCount ?? 0} NEW`;
  }

  // ─── Zone heatmap ────────────────────────────────────────────────────────────
  function renderZoneHeatmap(zoneBreakdown) {
    const zones = ['A', 'B', 'C', 'D', 'E', 'F'];
    const ZONE_COLORS_MAP = ['#FF3B30', '#FFB830', '#F97316', '#3A86FF', '#34C759', '#AF52DE'];
    
    document.querySelectorAll('.zone-cell').forEach((cell, idx) => {
      const zone = zones[idx];
      if (!zone) return;
      
      const count = zoneBreakdown?.[zone] ?? 0;
      const countEl = cell.querySelector('.fira-code');
      if (countEl) countEl.textContent = String(count).padStart(2, '0');

      const labelEl = cell.querySelector('.barlow-800');
      if (labelEl) labelEl.textContent = `ZONE ${zone}`;

      const color = ZONE_COLORS_MAP[idx];
      
      // Apply zone-specific color regardless of count
      cell.style.backgroundColor = color + '15'; // Very subtle tint
      cell.style.borderColor = color + '40';
      if (labelEl) labelEl.style.color = color;
      if (countEl) {
          countEl.style.color = count > 0 ? color : 'var(--nt-dim)';
          countEl.style.opacity = count > 0 ? '1' : '0.3';
      }
    });
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
        attributionControl: false
      });
      window.leafletMap = map; // Store for updates

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

      // 15km radius circle
      L.circle([centerLat, centerLng], {
        radius: 15000,
        color: '#F97316', weight: 1,
        fill: true, fillColor: '#F97316', fillOpacity: 0.03
      }).addTo(map);

      // Center marker
      L.circleMarker([centerLat, centerLng], {
        radius: 5, color: '#FFF', fillColor: '#F97316', fillOpacity: 1, weight: 2
      }).addTo(map);

      // 6 zone sector lines
      const ZONE_COLORS_MAP = ['#FF3B30','#FFB830','#F97316','#3A86FF','#34C759','#AF52DE'];
      const ZONE_LABELS = ['A','B','C','D','E','F'];
      const sectorRadius = 0.135; // Approx degrees for 15km

      for (let i = 0; i < 6; i++) {
        const bearing = i * 60;
        const endLat = centerLat + sectorRadius * Math.cos(bearing * Math.PI / 180);
        const endLng = centerLng + sectorRadius * Math.sin(bearing * Math.PI / 180);

        L.polyline([[centerLat, centerLng], [endLat, endLng]], {
          color: ZONE_COLORS_MAP[i], weight: 1, opacity: 0.3, dashArray: '5, 5'
        }).addTo(map);

        const midBearing = bearing + 30;
        const midLat = centerLat + sectorRadius * 0.4 * Math.cos(midBearing * Math.PI / 180);
        const midLng = centerLng + sectorRadius * 0.4 * Math.sin(midBearing * Math.PI / 180);

        L.marker([midLat, midLng], {
          icon: L.divIcon({
            html: `<span style="font-family:'Barlow Condensed',sans-serif;font-weight:800;color:${ZONE_COLORS_MAP[i]};font-size:10px;text-shadow:0 0 3px #000;opacity:0.6">ZONE ${ZONE_LABELS[i]}</span>`,
            className: '', iconAnchor: [20, 10]
          })
        }).addTo(map);
      }

      updateMapMarkers();
    });
  }

  let incidentMarkers = [];
  function updateMapMarkers() {
    if (!window.leafletMap || !window.L) return;
    const L = window.L;
    const map = window.leafletMap;

    // Clear old markers
    incidentMarkers.forEach(m => map.removeLayer(m));
    incidentMarkers = [];

    allActiveIncidents.forEach(inc => {
      if (!inc.location?.lat || !inc.location?.lng) return;
      const color = severityColor(inc.severity);
      
      const marker = L.circleMarker([inc.location.lat, inc.location.lng], {
        radius: 6,
        color: color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 2
      }).addTo(map);

      marker.bindTooltip(`${inc.type?.toUpperCase()} - ${inc.severity.toUpperCase()}`, {
        direction: 'top',
        className: 'nt-map-tooltip'
      });

      incidentMarkers.push(marker);
    });
  }

  // ─── Main data load ──────────────────────────────────────────────────────────
  async function loadDashboard() {
    try {
      const stats = await apiFetch('/incidents/dashboard-stats');
      allActiveIncidents = stats.activeIncidents || [];

      renderStats(stats);
      renderZoneHeatmap(stats.zoneBreakdown);
      renderIncidentList(allActiveIncidents);

      // If an incident was previously selected, re-open it (refreshed)
      if (selectedIncident) {
        const updated = allActiveIncidents.find(i => String(i._id) === String(selectedIncident._id));
        if (updated) openIncidentDetail(updated);
        else hideDetailPanel();
      }

      if (!mapInitialized) {
        initMap(stats.centerLat, stats.centerLng);
      } else {
        updateMapMarkers();
      }

      // Footer
      const footerSpans = document.querySelectorAll('footer .flex .fira-code');
      if (footerSpans[0]) footerSpans[0].textContent = `LAT: ${stats.centerLat.toFixed(4)}`;
      if (footerSpans[1]) footerSpans[1].textContent = `LONG: ${stats.centerLng.toFixed(4)}`;

      // Load recent alerts
      await loadRecentAlerts();

    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  }

  // ─── Recent Alerts ──────────────────────────────────────────────────────────
  async function loadRecentAlerts() {
    const container = document.getElementById('recent-alerts-list');
    if (!container) return;

    try {
      const alerts = await apiFetch('/alerts/history');
      // Filter only broadcast alerts (not targeted user notifications)
      const broadcasts = alerts.filter(a => !a.targetUser);

      if (broadcasts.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4" style="color:var(--nt-dim)">
            <span class="material-symbols-outlined block mb-1" style="opacity:0.4;font-size:20px">notifications_off</span>
            <p class="outfit text-xs" style="opacity:0.5">No alerts sent yet</p>
          </div>`;
        return;
      }

      // Sort newest first, take the most recent one
      broadcasts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const latest = broadcasts[0];

      const isActive = latest.active !== false;
      const statusColor = isActive ? '#34C759' : '#888';
      const statusLabel = isActive ? 'ACTIVE' : 'ENDED';
      const sevColors = { critical: '#FF3B30', high: '#FF6B35', medium: '#FFB830', low: '#34C759' };
      const sevColor = sevColors[latest.severity] || '#F97316';
      const timeStr = new Date(latest.createdAt).toLocaleTimeString();
      const typeLabel = (latest.type || 'SYSTEM').toUpperCase();

      container.innerHTML = `
        <div class="nt-card p-4 rounded border-l-4 border border-[var(--nt-card-border)]" style="border-left-color: ${sevColor}">
          <div class="flex justify-between items-center mb-2">
            <span class="fira-code text-[10px]" style="color: ${sevColor}">${typeLabel} // ${(latest.severity || 'info').toUpperCase()}</span>
            <span class="fira-code text-[9px] px-2 py-0.5 rounded-full" style="color: ${statusColor}; background: ${statusColor}22">${statusLabel}</span>
          </div>
          <p class="outfit text-sm font-medium mb-2" style="color: var(--nt-bright)">${latest.message || 'No message'}</p>
          <div class="flex justify-between items-center">
            <span class="fira-code text-[10px]" style="color: var(--nt-dim)">${latest.zone || '—'}</span>
            <span class="fira-code text-[10px]" style="color: var(--nt-dim)">${timeStr}</span>
          </div>
        </div>`;
    } catch (err) {
      console.error('Recent alerts load error:', err);
      container.innerHTML = `
        <div class="text-center py-4" style="color:var(--nt-dim)">
          <p class="outfit text-xs" style="opacity:0.5">Failed to load alerts</p>
        </div>`;
    }
  }

  async function refreshStats() {
    try {
      const stats = await apiFetch('/incidents/dashboard-stats');
      renderStats(stats);
      renderZoneHeatmap(stats.zoneBreakdown);
    } catch (e) { console.error('Stat refresh error:', e); }
  }

  // ─── WebSocket Listeners ─────────────────────────────────────────────────────
  function initSocket() {
    const socket = (window.NexusAuth && typeof window.NexusAuth.initSocket === 'function')
      ? window.NexusAuth.initSocket()
      : null;

    if (socket) {
      // Listen for new incidents anywhere in the network
      socket.on('incident:new', () => {
        console.log('Tactical Alert: New incident reported. Refreshing dashboard...');
        loadDashboard();
      });

      // Listen for status changes or chat updates
      socket.on('incident:updated', (data) => {
        console.log('Tactical Update: Incident state changed.', data);
        loadDashboard();
      });

      // Optional: Handle chat messages specifically for the selected incident
      socket.on('chat:message', (msg) => {
        if (selectedIncident && String(msg.incidentId) === String(selectedIncident._id)) {
           // If it's for the currently open incident, refresh chat log
           loadDashboard(); 
        }
      });
    }
  }

  // ─── Boot ────────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    startClock();
    loadDashboard();
    initSocket();
    // Reduce polling since we have sockets now, but keep as fallback
    setInterval(loadDashboard, 60000); 
  });
})();
