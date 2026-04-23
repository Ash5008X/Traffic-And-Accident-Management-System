(() => {
  // DOM Elements
  const activeAlertsList = document.getElementById('active-alerts-list');
  const activeAlertsCount = document.getElementById('active-alerts-count');
  const pastAlertsList = document.getElementById('past-alerts-list');

  const statAccident = document.getElementById('stat-accident');
  const statCongestion = document.getElementById('stat-congestion');
  const statRoute = document.getElementById('stat-route');
  const statSystem = document.getElementById('stat-system');

  const detailEmpty = document.getElementById('alert-detail-empty');
  const detailPanel = document.getElementById('alert-detail-panel');
  const detailPriority = document.getElementById('alert-detail-priority');
  const detailRef = document.getElementById('alert-detail-ref');
  const detailTitle = document.getElementById('alert-detail-title');
  const detailCoords = document.getElementById('alert-detail-coords');
  const detailDesc = document.getElementById('alert-detail-desc');
  const detailTime = document.getElementById('alert-detail-time');
  const detailDist = document.getElementById('alert-detail-dist');
  const detailSeverity = document.getElementById('alert-detail-severity');
  const detailCloseBtn = document.getElementById('alert-detail-close-btn');

  // Filter Chips
  const chips = document.querySelectorAll('.filter-bar .chip');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // Real User Location
  let USER_LOCATION = { lat: 0, lng: 0 };

  // Helpers
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const getToken = () => {
    try { return JSON.parse(localStorage.getItem('nexustraffic_auth'))?.token; } catch { return null; }
  };

  const getUserId = () => {
    try { return JSON.parse(localStorage.getItem('nexustraffic_auth'))?.user?._id; } catch { return null; }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    return `${d.toISOString().split('T')[1].substring(0, 8)} UTC`;
  };

  const categorizeType = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('accident')) return 'accident';
    if (t.includes('congestion')) return 'congestion';
    if (t.includes('route')) return 'route';
    return 'system';
  };

  const getTypeColor = (category) => {
    switch(category) {
      case 'accident': return '#FF6B35';
      case 'congestion': return '#FFB830';
      case 'route': return '#3A86FF';
      case 'system': return '#BF5AF2';
      default: return '#BF5AF2';
    }
  };

  let allNearbyAlerts = [];

  const loadAlerts = async () => {
    try {
      const [profileRes, incidentRes, myAlertRes, activeAlertRes] = await Promise.all([
        fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${getToken()}` } }),
        fetch('/api/incidents', { headers: { 'Authorization': `Bearer ${getToken()}` } }),
        fetch('/api/alerts/my', { headers: { 'Authorization': `Bearer ${getToken()}` } }),
        fetch('/api/alerts/active', { headers: { 'Authorization': `Bearer ${getToken()}` } })
      ]);

      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile.location && profile.location.lat != null) {
          USER_LOCATION = { lat: profile.location.lat, lng: profile.location.lng };
        }
      }

      if (!incidentRes.ok) throw new Error('Failed to fetch incidents');
      const allIncidents = await incidentRes.json();
      const myAlerts = myAlertRes.ok ? await myAlertRes.json() : [];
      const activeBroadcasts = activeAlertRes.ok ? await activeAlertRes.json() : [];
      const myId = getUserId();

      // Filter incidents: Within 50km AND NOT reported by me
      allNearbyAlerts = allIncidents.filter(inc => {
        if (inc.reportedBy === myId) return false;
        if (!inc.location || !inc.location.lat) return false;
        const dist = haversine(USER_LOCATION.lat, USER_LOCATION.lng, inc.location.lat, inc.location.lng);
        if (dist <= 50) {
          inc.distanceKm = dist;
          return true;
        }
        return false;
      });

      // Also include my own incidents (so I can see relief center replies)
      const myIncidents = allIncidents.filter(inc => String(inc.reportedBy) === String(myId));
      myIncidents.forEach(inc => {
        if (!allNearbyAlerts.find(x => String(x._id) === String(inc._id))) {
          allNearbyAlerts.push(inc);
        }
      });

      // Map Active Broadcasts into the same structure and append
      activeBroadcasts.forEach(ab => {
         if (!ab.targetUser) {
           allNearbyAlerts.push({
              _id: ab._id,
              type: ab.type || 'SYSTEM BROADCAST',
              status: ab.active !== false ? 'pending' : 'resolved',
              description: ab.message,
              severity: ab.severity,
              createdAt: ab.createdAt,
              location: { address: `ZONE ${ab.zone || 'UNKNOWN'}` },
              isBroadcast: true
           });
         }
      });

      // Sort newest first
      allNearbyAlerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const activeAlerts = allNearbyAlerts.filter(r => ['pending', 'assigned', 'en_route'].includes(r.status));
      const pastAlerts = allNearbyAlerts.filter(r => ['resolved', 'dismissed'].includes(r.status));

      // Calculate Stats Today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayAlerts = allNearbyAlerts.filter(r => new Date(r.createdAt) >= todayStart);
      
      let counts = { accident: 0, congestion: 0, route: 0, system: 0 };
      todayAlerts.forEach(a => counts[categorizeType(a.type)]++);

      statAccident.textContent = counts.accident.toString().padStart(2, '0');
      statCongestion.textContent = counts.congestion.toString().padStart(2, '0');
      statRoute.textContent = counts.route.toString().padStart(2, '0');
      statSystem.textContent = counts.system.toString().padStart(2, '0');

      activeAlertsCount.textContent = activeAlerts.length.toString();

      renderActiveAlerts(activeAlerts);
      renderPastAlerts(pastAlerts);

      // Render personal notifications in a separate section if present
      renderPersonalNotifications(myAlerts);
      
      // Update bell icon
      updateBellIcon(activeAlerts, myAlerts);

    } catch (err) {
      console.error(err);
      activeAlertsList.innerHTML = `<div style="color:var(--critical);">Failed to load alerts.</div>`;
    }
  };

  const showDetail = (alert) => {
    detailEmpty.style.display = 'none';
    detailPanel.style.display = 'block';

    const category = categorizeType(alert.type);
    detailPriority.textContent = `${(alert.type || 'System').toUpperCase()}_${(alert.severity || 'Normal').toUpperCase()}`;
    detailPriority.className = `detail-priority-badge badge-${category}`;

    detailRef.textContent = `INCIDENT_LOG // ${alert.incidentId || 'SYS-000'}`;
    detailTitle.textContent = `${alert.type} — ${alert.location?.address || 'Unknown'}`;
    detailCoords.textContent = `${alert.location?.lat || 0}° N, ${alert.location?.lng || 0}° W`;
    detailDesc.textContent = alert.description || 'No additional details provided.';
    
    detailTime.textContent = formatDate(alert.createdAt);
    detailDist.textContent = alert.distanceKm ? `${alert.distanceKm.toFixed(1)} km away` : 'Nearby';
    detailSeverity.textContent = (alert.severity || 'Normal').charAt(0).toUpperCase() + (alert.severity || 'Normal').slice(1);
    detailSeverity.style.color = getTypeColor(category);
  };

  detailCloseBtn.addEventListener('click', () => {
    detailPanel.style.display = 'none';
    detailEmpty.style.display = 'flex';
  });

  const renderActiveAlerts = (alerts) => {
    if (alerts.length === 0) {
      activeAlertsList.innerHTML = `<div style="opacity:0.5;grid-column:1/-1;">No active nearby alerts.</div>`;
      return;
    }

    const html = alerts.map(alert => {
      const cat = categorizeType(alert.type);
      const distStr = alert.distanceKm ? `${alert.distanceKm.toFixed(1)} km away` : 'Nearby';

      return `
        <div class="alert-card accent-${cat}" data-id="${alert._id}" style="cursor:pointer;">
          <span class="alert-type-badge badge-${cat}">${alert.type}</span>
          <div class="alert-card-title">${alert.type} — ${alert.location?.address || 'Unknown'}</div>
          <div class="alert-sector" style="color:${getTypeColor(cat)};">Priority ${alert.severity || 'Normal'} // System</div>
          <div class="alert-card-body">${alert.description || 'No description provided.'}</div>
          <div class="alert-card-footer">
            <span class="alert-dist">${distStr}</span>
            <span class="alert-time">${formatDate(alert.createdAt)}</span>
          </div>
        </div>
      `;
    }).join('');

    activeAlertsList.innerHTML = html;

    activeAlertsList.querySelectorAll('.alert-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        const alert = allNearbyAlerts.find(x => x._id === id);
        if (alert) showDetail(alert);
      });
    });
  };

  const renderPastAlerts = (alerts) => {
    if (alerts.length === 0) {
      pastAlertsList.innerHTML = `<div style="opacity:0.5;">No past alerts earlier today.</div>`;
      return;
    }

    const html = alerts.map(alert => {
      const isDismissed = alert.status === 'dismissed';
      const label = isDismissed ? 'Dismissed' : 'Cleared_Success';
      const pill = isDismissed ? 'Dismissed' : 'Cleared';

      return `
        <div class="cleared-row" data-id="${alert._id}" style="cursor:pointer;">
          <div>
            <div class="cleared-title">${alert.type} — ${alert.location?.address || 'Unknown'} // ${pill}</div>
            <div class="cleared-meta">
              <span class="cleared-status" style="color:${isDismissed ? 'var(--text-muted)' : 'var(--success)'}">${label}</span>
              <span class="cleared-time">${formatDate(alert.createdAt)}</span>
            </div>
          </div>
          <span class="pill-cleared" style="border-color:${isDismissed ? 'var(--text-muted)' : 'var(--success)'}; color:${isDismissed ? 'var(--text-muted)' : 'var(--success)'};">${pill}</span>
        </div>
      `;
    }).join('');

    pastAlertsList.innerHTML = html;

    pastAlertsList.querySelectorAll('.cleared-row').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        const alert = allNearbyAlerts.find(x => x._id === id);
        if (alert) showDetail(alert);
      });
    });
  };

  const renderPersonalNotifications = (alerts) => {
    // Find or create a personal messages container
    let container = document.getElementById('personal-notifications');
    if (!container) {
      container = document.createElement('div');
      container.id = 'personal-notifications';
      container.style.cssText = 'margin-top:1.5rem;';
      // Insert before the active alerts section if possible
      const alertsSection = activeAlertsList?.parentElement;
      if (alertsSection?.parentElement) {
        alertsSection.parentElement.insertBefore(container, alertsSection);
      }
    }

    if (!alerts || alerts.length === 0) {
      container.innerHTML = '';
      return;
    }

    const relevantAlerts = alerts.filter(a => a.type === 'relief_center_message');
    if (relevantAlerts.length === 0) { container.innerHTML = ''; return; }

    const html = `
      <div style="margin-bottom:0.75rem;">
        <h3 style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:0.75rem;letter-spacing:0.1em;color:var(--text-muted);margin-bottom:0.5rem;">MESSAGES FROM RELIEF CENTER</h3>
        ${relevantAlerts.map(a => `
          <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-left:3px solid #F97316;border-radius:6px;padding:0.75rem 1rem;margin-bottom:0.5rem;">
            <p style="font-family:'Outfit',sans-serif;font-size:0.875rem;color:var(--text-primary,#fff);margin:0 0 0.25rem;">${a.message}</p>
            <span style="font-family:'Fira Code',monospace;font-size:0.65rem;color:var(--text-muted);">${formatDate(a.createdAt)}</span>
          </div>
        `).join('')}
      </div>`;
    container.innerHTML = html;
  };

  const updateBellIcon = (activeAlerts, myAlerts) => {
    const bellBtn = document.getElementById('navbar-bell-btn');
    const bellCount = document.getElementById('navbar-bell-count');
    const dropdown = document.getElementById('navbar-bell-dropdown');

    if (!bellBtn || !bellCount || !dropdown) return;

    // Filter to active broadcast alerts and personal unread/active alerts
    const activeBroadcasts = activeAlerts.filter(a => a.isBroadcast);
    const personalAlerts = myAlerts.filter(a => a.active !== false);

    const allNotifs = [...activeBroadcasts, ...personalAlerts];
    allNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (allNotifs.length > 0) {
      bellCount.style.display = 'flex';
      bellCount.textContent = allNotifs.length;
      bellCount.style.background = '#FF3B30';
      bellCount.style.color = '#fff';
      bellCount.style.width = '16px';
      bellCount.style.height = '16px';
      bellCount.style.fontSize = '9px';
      bellCount.style.borderRadius = '50%';
      bellCount.style.alignItems = 'center';
      bellCount.style.justifyContent = 'center';
      bellCount.style.position = 'absolute';
      bellCount.style.top = '-4px';
      bellCount.style.right = '-4px';
      bellCount.style.fontWeight = 'bold';
    } else {
      bellCount.style.display = 'none';
    }

    if (allNotifs.length === 0) {
      dropdown.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px;">No new notifications</div>`;
    } else {
      dropdown.innerHTML = allNotifs.map(notif => {
        const isPersonal = notif.targetUser;
        const color = isPersonal ? '#F97316' : '#FF3B30';
        const title = isPersonal ? 'Relief Center Message' : (notif.type || 'System Broadcast');
        const msg = notif.description || notif.message || '';
        return `
          <div style="padding:12px 16px; border-bottom:1px solid var(--border-color); cursor:pointer;" onmouseover="this.style.background='var(--surface-3)'" onmouseout="this.style.background='transparent'">
            <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:10px;color:${color};margin-bottom:4px;text-transform:uppercase;">
              ${title}
            </div>
            <div style="font-family:'Outfit',sans-serif;font-size:12px;color:var(--text-primary);margin-bottom:6px;line-height:1.4;">
              ${msg}
            </div>
            <div style="font-family:'Fira Code',monospace;font-size:9px;color:var(--text-muted);">
              ${formatDate(notif.createdAt)}
            </div>
          </div>
        `;
      }).join('');
    }

    // Toggle logic
    bellBtn.onclick = (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    };

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!bellBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  };

  loadAlerts();
})();
