/**
 * alerts.js
 */
(() => {
  const API_BASE = window.NEXUS_API_BASE || 'http://localhost:5000/api';
  const AUTH_KEY = 'nexustraffic_auth';

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

  // ─── Compose Broadcast Logic ────────────────────────────────────────────────
  let currentType = 'accident';
  let currentZone = 'ZONE_A';
  let currentSeverity = 'critical';

  function initCompose() {
    // Type Buttons
    document.querySelectorAll('#alert-types button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#alert-types button').forEach(b => {
          b.classList.remove('active-type');
          b.style.background = '';
          b.style.borderColor = 'transparent';
        });
        btn.classList.add('active-type');
        currentType = btn.dataset.type;
        const color = btn.querySelector('.material-symbols-outlined').style.color || window.getComputedStyle(btn.querySelector('.material-symbols-outlined')).color;
        btn.style.background = color.replace('rgb', 'rgba').replace(')', ', 0.2)');
        btn.style.borderColor = color;
      });
    });

    // Zone Buttons
    document.querySelectorAll('#affected-zones button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#affected-zones button').forEach(b => {
          b.classList.remove('active-zone');
        });
        btn.classList.add('active-zone');
        currentZone = btn.dataset.zone;
      });
    });

    // Severity Buttons
    document.querySelectorAll('#severity-levels button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#severity-levels button').forEach(b => {
          b.classList.remove('active-sev');
        });
        btn.classList.add('active-sev');
        currentSeverity = btn.dataset.sev;
      });
    });

    // Broadcast Button
    const btnBroadcast = document.getElementById('btn-broadcast');
    if (btnBroadcast) {
      btnBroadcast.addEventListener('click', async () => {
        const msgEl = document.getElementById('broadcast-msg');
        const message = msgEl.value.trim();
        if (!message) {
          alert('Please enter a transmission message.');
          return;
        }

        const btnText = btnBroadcast.innerHTML;
        btnBroadcast.innerHTML = '<span class="material-symbols-outlined animate-spin text-xl">sync</span>';
        btnBroadcast.disabled = true;

        try {
          await apiFetch('/alerts', {
            method: 'POST',
            body: JSON.stringify({
              type: currentType,
              zone: currentZone,
              severity: currentSeverity,
              message: message,
              radius: currentSeverity === 'critical' ? 25 : 10
            })
          });
          msgEl.value = '';
          loadData(); // Reload UI
        } catch (err) {
          console.error('Broadcast error:', err);
          alert('Failed to send broadcast');
        } finally {
          btnBroadcast.innerHTML = btnText;
          btnBroadcast.disabled = false;
        }
      });
    }
  }

  // ─── Render Live Transmissions ──────────────────────────────────────────────
  function severityColor(sev) {
    return { critical: '#FF3B30', high: '#FF6B35', medium: '#FFB830', low: '#34C759' }[sev] || '#888';
  }

  function getIcon(type) {
    const map = {
      accident: 'emergency', congestion: 'traffic', route_update: 'alt_route',
      system: 'memory', all_clear: 'check_circle', hazard: 'warning'
    };
    return map[type] || 'campaign';
  }

  function formatUptime(dateStr) {
    const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function renderLiveTransmissions(alerts) {
    const container = document.getElementById('live-transmissions-container');
    if (!container) return;
    container.innerHTML = '';

    // Only show general broadcasts (exclude personal incident notifications)
    const activeBroadcasts = alerts.filter(a => !a.targetUser && a.active !== false);

    if (activeBroadcasts.length === 0) {
      container.innerHTML = `
        <div class="scheduled-empty rounded-sm p-4 border flex justify-center items-center italic mt-8" style="border-color: var(--nt-card-border)">
          <span class="font-body text-sm" style="color: var(--nt-dim)">No active live transmissions at this time.</span>
        </div>`;
      return;
    }

    activeBroadcasts.forEach(alt => {
      const color = severityColor(alt.severity);
      const icon = getIcon(alt.type);
      const typeLabel = (alt.type || 'SYSTEM').toUpperCase();
      
      const card = document.createElement('article');
      card.className = `border-l-4 rounded-sm p-5 shadow-2xl relative transition-colors bg-[var(--nt-card)] mb-6`;
      card.style.borderLeftColor = color;
      
      card.innerHTML = `
        <div class="absolute top-5 right-5 flex flex-col items-end gap-1">
          <span class="px-2 py-0.5 text-white font-headline font-black text-[10px] tracking-tighter uppercase" style="background-color: ${color}">${alt.severity || 'INFO'}</span>
          <button class="mt-2 px-3 py-1 font-headline font-bold text-[10px] uppercase tracking-wider rounded-sm text-white bg-white/10 hover:bg-[#FF3B30] transition-colors end-alert-btn" data-id="${alt._id}">END TRANSMISSION</button>
        </div>
        <div class="flex items-center gap-3 mb-4">
          <span class="material-symbols-outlined text-xl" style="color: ${color}">${icon}</span>
          <div class="flex items-center gap-3 font-label text-[10px] tracking-widest text-[#F97316]">
            <span>TYPE: ${typeLabel}</span>
            <span style="color: var(--nt-dim)">//</span>
            <span>ID: ${alt.alertId || alt._id.slice(-6).toUpperCase()}</span>
          </div>
        </div>
        <h3 class="font-headline text-3xl font-black leading-none mb-3 uppercase italic tracking-tighter" style="color: var(--nt-bright)">
          ${alt.message ? (alt.message.split(' ').slice(0,4).join(' ') + '...') : 'BROADCAST MESSAGE'}
        </h3>
        <div class="flex gap-2 mb-4">
          ${alt.zone ? `<span class="zone-chip px-2 py-0.5 font-label text-[9px] border rounded-sm">${alt.zone}</span>` : ''}
        </div>
        <p class="font-body text-sm leading-relaxed mb-6 max-w-2xl" style="color: var(--nt-dim)">
          ${alt.message || 'No additional details provided.'}
        </p>
        <div class="grid grid-cols-3 gap-4 mb-6 pt-4" style="border-top: 1px solid color-mix(in srgb, var(--nt-card-border) 40%, transparent)">
          <div class="flex flex-col">
            <span class="font-label text-[9px]" style="color: var(--nt-dim)">USERS NOTIFIED</span>
            <span class="font-headline font-bold text-xl" style="color: var(--nt-bright)">${(alt.usersReached || 0).toLocaleString()}</span>
          </div>
          <div class="flex flex-col">
            <span class="font-label text-[9px]" style="color: var(--nt-dim)">RADIUS</span>
            <span class="font-headline font-bold text-xl" style="color: var(--nt-bright)">${alt.radius || 10} KM</span>
          </div>
          <div class="flex flex-col">
            <span class="font-label text-[9px]" style="color: var(--nt-dim)">UPTIME</span>
            <span class="font-headline font-bold text-xl uptime-counter" data-time="${alt.createdAt}" style="color: var(--nt-bright)">${formatUptime(alt.createdAt)}</span>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.end-alert-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          const btnText = btn.innerHTML;
          btn.innerHTML = 'ENDING...';
          btn.disabled = true;
          await apiFetch(`/alerts/${id}/cancel`, { method: 'PATCH' });
          loadData();
        } catch (err) {
          console.error(err);
          alert('Failed to end alert');
          btn.innerHTML = 'END TRANSMISSION';
          btn.disabled = false;
        }
      });
    });
  }

  function startUptimeClocks() {
    setInterval(() => {
      document.querySelectorAll('.uptime-counter').forEach(el => {
        el.textContent = formatUptime(el.dataset.time);
      });
    }, 1000);
  }

  // ─── Render Analytics ───────────────────────────────────────────────────────
  function renderAnalytics(alerts, totalUsersDb) {
    const totalBroadcasts = alerts.filter(a => !a.targetUser).length;
    const usersReached = totalUsersDb || 0;
    const zonesCount = { ZONE_A: 0, ZONE_B: 0, ZONE_C: 0, ZONE_D: 0, ZONE_E: 0, ZONE_F: 0 };

    alerts.forEach(a => {
      if (!a.targetUser) {
        if (a.zone && zonesCount[a.zone] !== undefined) {
          zonesCount[a.zone]++;
        }
      }
    });

    document.getElementById('total-broadcasts').textContent = totalBroadcasts.toLocaleString();
    
    // Format users reached
    let urText = usersReached.toLocaleString();
    if (usersReached >= 1000000) urText = (usersReached / 1000000).toFixed(1) + 'M';
    else if (usersReached >= 10000) urText = (usersReached / 1000).toFixed(1) + 'K';
    document.getElementById('users-reached').textContent = urText;
    
    // Mock Response Rate based on total broadcasts (if 0 then 0%, else rand between 85-98)
    const avgResponse = totalBroadcasts > 0 ? (85 + (totalBroadcasts % 13) + (usersReached % 20)/20).toFixed(1) + '%' : '0%';
    document.getElementById('avg-response-rate').textContent = avgResponse;

    // Render Alerts by Zone
    const zoneContainer = document.getElementById('alerts-by-zone-container');
    if (zoneContainer) {
      zoneContainer.innerHTML = '';
      const zoneColors = {
        ZONE_A: '#FF3B30', ZONE_B: '#FFB830', ZONE_C: '#F97316',
        ZONE_D: '#3A86FF', ZONE_E: '#34C759', ZONE_F: '#BF5AF2'
      };

      const maxCount = Math.max(1, ...Object.values(zonesCount));

      Object.keys(zonesCount).forEach(z => {
        const count = zonesCount[z];
        const pct = (count / maxCount) * 100;
        
        const div = document.createElement('div');
        div.className = 'space-y-1';
        div.innerHTML = `
          <div class="flex justify-between font-label text-[10px]" style="color: var(--nt-bright)">
            <span>${z}</span><span>${count}</span>
          </div>
          <div class="bar-track h-1.5 w-full rounded-sm" style="background-color: var(--nt-card-border)">
            <div class="h-full rounded-sm" style="width: ${pct}%; background-color: ${zoneColors[z]}; transition: width 1s ease-out"></div>
          </div>
        `;
        zoneContainer.appendChild(div);
      });
    }
  }

  // ─── Render Ended Transmissions ─────────────────────────────────────────────
  function renderEndedTransmissions(alerts) {
    const container = document.getElementById('ended-transmissions-container');
    if (!container) return;
    container.innerHTML = '';

    const endedBroadcasts = alerts.filter(a => !a.targetUser && a.active === false);
    
    // Sort so newest ended are at top
    endedBroadcasts.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (endedBroadcasts.length === 0) {
      container.innerHTML = `
        <div class="scheduled-empty rounded-sm p-4 border flex justify-center items-center italic mt-4" style="border-color: var(--nt-card-border)">
          <span class="font-body text-sm" style="color: var(--nt-dim)">No ended transmissions found.</span>
        </div>`;
      return;
    }

    endedBroadcasts.forEach(alt => {
      const icon = getIcon(alt.type);
      const typeLabel = (alt.type || 'SYSTEM').toUpperCase();
      
      const card = document.createElement('article');
      card.className = `border-l-4 rounded-sm p-4 relative bg-[var(--nt-card)] mb-4 opacity-75 grayscale`;
      card.style.borderLeftColor = '#888';
      
      card.innerHTML = `
        <div class="absolute top-4 right-4 flex flex-col items-end gap-1">
          <span class="px-2 py-0.5 text-white font-headline font-black text-[10px] tracking-tighter uppercase" style="background-color: #888">ENDED</span>
        </div>
        <div class="flex items-center gap-3 mb-2">
          <span class="material-symbols-outlined text-lg" style="color: #888">${icon}</span>
          <div class="flex items-center gap-3 font-label text-[9px] tracking-widest" style="color: var(--nt-dim)">
            <span>TYPE: ${typeLabel}</span>
            <span>//</span>
            <span>ID: ${alt.alertId || alt._id.slice(-6).toUpperCase()}</span>
          </div>
        </div>
        <h3 class="font-headline text-xl font-bold leading-none mb-2 uppercase italic tracking-tighter" style="color: var(--nt-dim)">
          ${alt.message ? (alt.message.split(' ').slice(0,6).join(' ') + '...') : 'BROADCAST MESSAGE'}
        </h3>
        <div class="flex gap-4 pt-2 mt-2" style="border-top: 1px solid color-mix(in srgb, var(--nt-card-border) 40%, transparent)">
          <div class="flex gap-1 items-center">
            <span class="font-label text-[8px]" style="color: var(--nt-dim)">REACHED:</span>
            <span class="font-headline font-bold text-xs" style="color: var(--nt-dim)">${(alt.usersReached || 0).toLocaleString()}</span>
          </div>
          <div class="flex gap-1 items-center">
            <span class="font-label text-[8px]" style="color: var(--nt-dim)">ENDED AT:</span>
            <span class="font-headline font-bold text-xs" style="color: var(--nt-dim)">${new Date(alt.updatedAt || alt.createdAt).toLocaleTimeString()}</span>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // ─── Main Load ───────────────────────────────────────────────────────────────
  async function loadData() {
    try {
      // Fetch all alerts and total users to calculate stats and show live ones
      const [alerts, userCountRes] = await Promise.all([
        apiFetch('/alerts/history'),
        apiFetch('/auth/users/count')
      ]);
      const totalUsersDb = userCountRes.count || 0;

      renderLiveTransmissions(alerts);
      renderEndedTransmissions(alerts);
      renderAnalytics(alerts, totalUsersDb);
    } catch (err) {
      console.error('Alerts data load error:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    startClock();
    initCompose();
    loadData();
    startUptimeClocks();
    setInterval(loadData, 30000); // refresh every 30s
  });
})();
