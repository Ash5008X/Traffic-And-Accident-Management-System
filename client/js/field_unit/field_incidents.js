(() => {
  const authKey = 'nexustraffic_auth';

  async function fetchIncidentsData() {
    try {
      const authData = JSON.parse(localStorage.getItem(authKey) || 'null');
      if (!authData || !authData.token) return;

      const res = await fetch('/api/field-units/incidents/data', {
        headers: { 'Authorization': `Bearer ${authData.token}` }
      });
      const data = await res.json();

      // Store globally for modal access
      window.allIncidents = [
        ...(data.activeAssignments || []),
        ...(data.proximalTelemetry || []),
        ...(data.historyLog || []),
        ...(data.todayAlerts || [])
      ];

      renderActive(data.activeAssignments);
      renderProximal(data.proximalTelemetry);
      renderHistory(data.historyLog);
      renderStats(data.stats);
      
      // Store todayAlerts for filtering
      window.todayAlerts = data.todayAlerts;
      applyFilter();

    } catch (err) {
      console.error('Error fetching incidents data:', err);
    }
  }

  function showDetail(id) {
    const inc = window.allIncidents.find(i => i._id === id);
    if (!inc) return;

    document.getElementById('modal-severity').textContent = inc.severity.toUpperCase();
    document.getElementById('modal-severity').className = `critical-badge severity-${inc.severity}`;
    document.getElementById('modal-title').textContent = inc.title;
    document.getElementById('modal-id').textContent = `INCIDENT_ID // ${inc._id.toUpperCase()}`;
    document.getElementById('modal-desc').textContent = inc.description || 'No detailed sitrep available for this tactical engagement.';
    document.getElementById('modal-coords').textContent = inc.location ? `${inc.location.lat.toFixed(4)} N, ${inc.location.lng.toFixed(4)} W` : '--';
    document.getElementById('modal-time').textContent = new Date(inc.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';

    const modal = document.getElementById('detail-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('opacity-100');
        document.getElementById('modal-content').classList.remove('scale-95');
    }, 10);
  }

  function closeModal() {
    const modal = document.getElementById('detail-modal');
    modal.classList.remove('opacity-100');
    document.getElementById('modal-content').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
  }

  document.getElementById('close-modal')?.addEventListener('click', closeModal);
  document.getElementById('detail-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') closeModal();
  });
  document.getElementById('modal-action-btn')?.addEventListener('click', () => {
    window.location.href = 'field_desktop.html';
  });

  function renderStats(stats) {
    if (!stats) return;
    document.getElementById('stat-assigned').textContent = String(stats.assigned).padStart(2, '0');
    document.getElementById('stat-completed').textContent = String(stats.completedToday).padStart(2, '0');
  }

  function applyFilter() {
    const val = document.getElementById('sort-select').value;
    let filtered = [...(window.todayAlerts || [])];
    
    if (val === 'critical') {
        filtered = filtered.filter(inc => inc.severity === 'critical');
    } else if (val === 'pending') {
        filtered = filtered.filter(inc => inc.status === 'pending');
    }
    
    renderSidebarAlerts(filtered);
  }

  function renderSidebarAlerts(incidents) {
    const list = document.getElementById('sidebar-alerts-list');
    if (!incidents || incidents.length === 0) {
        list.innerHTML = `<p class="outfit text-[10px] text-center py-4" style="color:var(--nt-dim);opacity:0.4">No alerts found</p>`;
        return;
    }

    list.innerHTML = incidents.map(inc => `
        <div class="p-2 rounded bg-[var(--nt-card2)] border border-[var(--nt-nav-border)] hover:border-[#F97316] transition-colors cursor-pointer" 
             onclick="showDetail('${inc._id}')">
            <div class="flex justify-between items-start mb-1">
                <span class="barlow-800 text-[11px] ${inc.severity === 'critical' ? 'text-red-500' : 'text-orange-400'}">${inc.title.slice(0, 20)}...</span>
                <span class="fira-code text-[8px] text-[var(--nt-dim)]">#${inc._id.slice(-4).toUpperCase()}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="fira-code text-[9px] text-[var(--nt-dim)]">ZONE ${inc.zone || '--'}</span>
                <span class="fira-code text-[9px] text-[var(--nt-dim)]">${new Date(inc.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>
    `).join('');
  }

  document.getElementById('sort-select').addEventListener('change', applyFilter);

  function renderActive(incidents) {
    const list = document.getElementById('active-list');
    if (!incidents || incidents.length === 0) {
      list.innerHTML = `<p class="outfit text-xs text-center py-8" style="color:var(--nt-dim);opacity:0.5">No active assignments</p>`;
      return;
    }

    list.innerHTML = incidents.map(inc => `
      <div class="incident-card ${inc.severity === 'critical' ? 'crit' : 'high'}" onclick="showDetail('${inc._id}')">
        <div class="incident-card-top">
          <div>
            <div class="incident-title ${inc.severity === 'critical' ? 'crit' : 'high'}">${inc.title}</div>
            <div class="incident-id">Incident_ID // ${inc._id.slice(-8).toUpperCase()}</div>
          </div>
          <span class="material-symbols-outlined" style="color:${inc.severity === 'critical' ? 'var(--critical-fg)' : 'var(--orange-alt)'};font-size:20px;">
            ${inc.severity === 'critical' ? 'warning' : 'engineering'}
          </span>
        </div>
        <p class="incident-body">${inc.description || 'No description provided.'}</p>
        <div class="coord-row">
          <span class="coord-tag">LAT: ${inc.location.lat.toFixed(4)}</span>
          <span class="coord-tag">LONG: ${inc.location.lng.toFixed(4)}</span>
        </div>
      </div>
    `).join('');
  }

  function renderProximal(incidents) {
    const grid = document.getElementById('proximal-grid');
    if (!incidents || incidents.length === 0) {
      grid.innerHTML = '<div class="proximal-card" style="opacity:0.3; height:80px; display:flex; align-items:center; justify-content:center; grid-column:span 2">NO NEIGHBOR TELEMETRY</div>';
      return;
    }

    // Always ensure 4 slots (pad with empty if needed)
    const displayItems = incidents.slice(0, 4);
    while (displayItems.length < 4) displayItems.push(null);

    grid.innerHTML = displayItems.map(inc => {
      if (!inc) return `<div class="proximal-card" style="opacity:0.1; height:80px"></div>`;
      return `
        <div class="proximal-card" onclick="showDetail('${inc._id}')" style="cursor:pointer">
          <div class="proximal-title" style="color:var(--warning)">${inc.type || 'STREET_LEVEL'} // ZONE ${inc.zone}</div>
          <div class="proximal-loc">LOC // ${inc.location.lat.toFixed(2)}, ${inc.location.lng.toFixed(2)}</div>
          <div class="proximal-tags">
            <span class="proximal-tag">${inc.severity}</span>
            <span class="proximal-tag">${new Date(inc.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderHistory(incidents) {
    const list = document.getElementById('history-list');
    if (!incidents || incidents.length === 0) {
      list.innerHTML = `<p class="outfit text-xs text-center py-4" style="color:var(--nt-dim);opacity:0.4">No mission history</p>`;
      return;
    }

    list.innerHTML = incidents.map(inc => `
      <div class="history-row" style="opacity: ${inc.status === 'resolved' ? '0.55' : '0.9'}; cursor:pointer" onclick="showDetail('${inc._id}')">
        <div class="history-row-left">
          <span class="material-symbols-outlined" style="color: ${inc.status === 'resolved' ? 'var(--teal-fg)' : 'var(--orange-alt)'}; font-size:16px; font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20;">
            ${inc.status === 'resolved' ? 'check_circle' : 'sync'}
          </span>
          <span class="history-row-title">
            <span class="text-[var(--nt-bright)]">${(inc.type || 'INCIDENT').toUpperCase()}</span> 
            <span class="opacity-50 font-normal"> — ${inc.description ? inc.description.slice(0, 40) + '...' : 'No details available'}</span>
          </span>
        </div>
        <div class="flex flex-col items-end">
            <span class="history-time">${new Date(inc.resolvedAt || inc.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="text-[8px] tracking-widest opacity-30 uppercase">${inc.status}</span>
        </div>
      </div>
    `).join('');
  }

  fetchIncidentsData();
  setInterval(fetchIncidentsData, 15000);
})();
