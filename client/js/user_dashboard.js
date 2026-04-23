document.addEventListener('DOMContentLoaded', () => {
  // Modal Elements
  const reportBtn = document.getElementById('report-accident-btn');
  const modalOverlay = document.getElementById('report-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelReportBtn = document.getElementById('cancel-report-btn');
  const reportForm = document.getElementById('report-form');
  const submitBtn = document.getElementById('submit-report-btn');

  // DOM Elements
  const userReportsList = document.getElementById('user-reports-list');
  const activeReportCard = document.getElementById('active-report-card');
  const noActiveReportCard = document.getElementById('no-active-report-card');
  const activeReportRef = document.getElementById('active-report-ref');
  const activeReportTime = document.getElementById('active-report-time');
  const activeReportTitle = document.getElementById('active-report-title');
  const activeReportDesc = document.getElementById('active-report-desc');
  const nearbyAlertsList = document.getElementById('nearby-alerts-list');

  // Real user location — loaded from /api/auth/me on boot
  let USER_LOCATION = null;
  
  // Helpers
  const getToken = () => {
    try {
      return JSON.parse(localStorage.getItem('nexustraffic_auth'))?.token;
    } catch {
      return null;
    }
  };

  const timeAgo = (dateStr) => {
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} days ago`;
  };

  const getSeverityClass = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high': return 'warning'; // map high to warning colors
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'info';
    }
  };

  // 1. Modal Logic
  const openModal = () => {
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    reportForm.reset();
  };

  reportBtn.addEventListener('click', openModal);
  closeModalBtn.addEventListener('click', closeModal);
  cancelReportBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // 2a. Load the real user location from the profile endpoint
  const loadUserLocation = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to fetch user profile');
      const profile = await res.json();
      if (profile.location && profile.location.lat != null && profile.location.lng != null) {
        USER_LOCATION = { lat: profile.location.lat, lng: profile.location.lng };
      } else {
        // Fallback: use browser geolocation or a safe default
        USER_LOCATION = { lat: 0, lng: 0 };
        console.warn('User location not set in profile — using (0,0) as fallback');
      }
    } catch (err) {
      console.error('Error loading user location:', err);
      USER_LOCATION = { lat: 0, lng: 0 };
    }
  };

  // 2b. Fetch User Data
  const loadUserData = async () => {
    try {
      const res = await fetch('/api/incidents?reportedBy=me', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to fetch reports');
      
      const reports = await res.json();
      
      // Update Reports Feed (last 3)
      renderReportsFeed(reports.slice(0, 3));
      
      // Update Active Monitoring (find first non-resolved/dismissed)
      const activeReport = reports.find(r => r.status !== 'resolved' && r.status !== 'dismissed');
      renderActiveReport(activeReport);
      
    } catch (err) {
      console.error('Error loading user data:', err);
      userReportsList.innerHTML = `<div class="feed-row"><div class="feed-row-main"><div class="feed-row-body" style="color: var(--critical);">Failed to load reports.</div></div></div>`;
    }
  };

  const renderReportsFeed = (reports) => {
    if (!reports || reports.length === 0) {
      userReportsList.innerHTML = `<div class="feed-row" style="opacity: 0.5;"><div class="feed-row-main"><div class="feed-row-body">No recent reports found.</div></div></div>`;
      return;
    }

    userReportsList.innerHTML = reports.map(report => {
      const sevClass = getSeverityClass(report.severity);
      const sevLabel = (report.severity || 'info').charAt(0).toUpperCase() + (report.severity || 'info').slice(1);
      
      return `
        <div class="feed-row">
          <div class="sev-bar ${sevClass}"></div>
          <div class="feed-row-main">
            <div class="feed-row-title">${report.type} Incident</div>
            <div class="feed-row-body">${report.description || 'No description provided.'}</div>
            <div class="feed-row-tags">
              <span class="sev-pill ${sevClass}">${sevLabel}</span>
              <span class="mono-meta">${timeAgo(report.createdAt)}</span>
              <span class="sev-pill" style="background: var(--surface-2); border: 1px solid var(--border); color: var(--text-muted);">${report.status.toUpperCase()}</span>
            </div>
          </div>
          <span class="material-symbols-outlined row-arrow">chevron_right</span>
        </div>
      `;
    }).join('');
  };

  const renderActiveReport = (report) => {
    if (!report) {
      activeReportCard.style.display = 'none';
      noActiveReportCard.style.display = 'block';
      return;
    }

    activeReportCard.style.display = 'block';
    noActiveReportCard.style.display = 'none';

    activeReportRef.textContent = `Ref: ${report.incidentId || '---'}`;
    activeReportTime.textContent = timeAgo(report.createdAt);
    activeReportTitle.textContent = `${report.type} Reported`;
    activeReportDesc.textContent = report.description || 'Your report is being processed.';

    // Update Timeline
    const steps = ['pending', 'assigned', 'en_route', 'resolved'];
    let currentStepIdx = steps.indexOf(report.status);
    if (currentStepIdx === -1) currentStepIdx = 0; // Default to pending
    
    // Adjust fill width
    const fills = ['25%', '50%', '75%', '100%'];
    document.querySelector('#active-report-timeline .tl-fill').style.width = fills[currentStepIdx] || '25%';

    steps.forEach((step, idx) => {
      const dot = document.getElementById(`tl-step-${idx + 1}-dot`);
      const label = document.getElementById(`tl-step-${idx + 1}-label`);
      
      dot.className = 'tl-dot';
      label.className = 'tl-label';
      
      if (idx < currentStepIdx) {
        dot.classList.add('done');
        label.classList.add('done');
        dot.innerHTML = `<span class="material-symbols-outlined">check</span>`;
      } else if (idx === currentStepIdx) {
        dot.classList.add('active');
        label.classList.add('active');
        // keep its default icon
      } else {
        dot.classList.add('pending');
        label.classList.add('pending');
      }
    });
  };

  const loadNearbyAlerts = async () => {
    try {
      const res = await fetch(`/api/incidents/nearby?lat=${USER_LOCATION.lat}&lng=${USER_LOCATION.lng}&radius=50`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to fetch nearby alerts');
      
      const alerts = await res.json();
      
      if (!alerts || alerts.length === 0) {
        nearbyAlertsList.innerHTML = `<div style="text-align: center; padding: 20px 0; color: var(--text-muted);">No nearby alerts found.</div>`;
        return;
      }

      nearbyAlertsList.innerHTML = alerts.slice(0, 4).map(alert => {
        const sevClass = getSeverityClass(alert.severity);
        // Distance calculation (rough estimate for UI if not provided by backend)
        const dist = alert.dist ? `${alert.dist.toFixed(1)} km` : '< 2 km';
        
        return `
          <div class="alert-row">
            <div class="ar-bar" style="background: var(--${sevClass});"></div>
            <div class="ar-content">
              <div class="ar-title">${alert.type}</div>
              <div class="ar-meta">
                <span class="ar-ref">${alert.incidentId || 'SYS-NEW'}</span>
                <div class="ar-sep"></div>
                <span class="ar-dist">${dist} away</span>
              </div>
            </div>
            <span class="material-symbols-outlined ar-arrow">chevron_right</span>
          </div>
        `;
      }).join('');

    } catch (err) {
      console.error('Error loading nearby alerts:', err);
      nearbyAlertsList.innerHTML = `<div style="text-align: center; padding: 20px 0; color: var(--critical);">Error loading alerts.</div>`;
    }
  };

  // 4. Form Submit
  reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Disable submit button
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="material-symbols-outlined">sync</span> Submitting...';
    submitBtn.disabled = true;

    if (!USER_LOCATION || (USER_LOCATION.lat === 0 && USER_LOCATION.lng === 0)) {
      alert('Your location is not configured. Please contact support.');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      return;
    }

    const data = {
      type: document.getElementById('report-type').value,
      severity: document.getElementById('report-severity').value,
      location: {
        address: document.getElementById('report-location').value,
        lat: USER_LOCATION.lat,
        lng: USER_LOCATION.lng
      },
      description: document.getElementById('report-description').value
    };

    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(data)
      });

      if (!res.ok) throw new Error('Failed to submit report');
      
      closeModal();
      
      // Reload UI data
      await loadUserData();
      
    } catch (err) {
      console.error('Error submitting report:', err);
      alert('Failed to submit report. Please try again.');
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });

  // Init — load real location first, then all data
  loadUserLocation().then(() => {
    loadUserData();
    loadNearbyAlerts();
  });
});
