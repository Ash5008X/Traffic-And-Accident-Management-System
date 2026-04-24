async function fetchProfileData() {
  try {
    const authKey = 'nexustraffic_auth';
    const authData = JSON.parse(localStorage.getItem(authKey) || 'null');
    
    if (!authData || !authData.token) {
      window.location.href = '../../index.html';
      return;
    }

    const token = authData.token;

    // Fetch field unit stats
    const statsRes = await fetch('/api/field-units/profile/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const stats = await statsRes.json();

    // Fetch user info (or use from authData if available)
    const user = authData.user || {};
    const fullName = user.name || 'Anonymous User';
    
    // Update UI
    document.getElementById('profile-full-name').textContent = fullName;
    document.getElementById('profile-unit-id').textContent = `UNIT_ID // ${stats.unitId || 'UNKNOWN'}`;

    // Generate Initials Circle
    const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const circle = document.getElementById('profile-initials-circle');
    circle.style.borderRadius = '50%';
    circle.style.display = 'flex';
    circle.style.alignItems = 'center';
    circle.style.justifyContent = 'center';
    circle.style.background = 'var(--accent)';
    circle.style.color = 'white';
    circle.style.fontSize = '28px';
    circle.style.fontWeight = '800';
    circle.textContent = initials;

    // Update Stats
    document.getElementById('profile-cleared-count').textContent = stats.clearedCount || 0;
    document.getElementById('profile-zone').textContent = stats.zone || 'N/A';
    document.getElementById('profile-team').textContent = stats.teamName || 'N/A';

    // Update Weekly Chart
    const chart = document.getElementById('profile-weekly-chart');
    chart.innerHTML = '';
    const weeklyStats = stats.weeklyStats || [];
    const maxCount = Math.max(...weeklyStats.map(s => s.count), 1);

    weeklyStats.forEach((s, i) => {
      const height = (s.count / maxCount) * 100;
      const isToday = i === weeklyStats.length - 1;
      
      const barCol = document.createElement('div');
      barCol.className = `bar-col ${isToday ? 'today' : ''}`;
      
      barCol.innerHTML = `
        <div class="bar-wrap">
          <div class="bar-fill" style="height: ${height}%"></div>
        </div>
        <span class="bar-label">${s.day}</span>
      `;
      chart.appendChild(barCol);
    });

  } catch (err) {
    console.error('Error fetching profile data:', err);
  }
}

(() => {
  fetchProfileData();

  document.querySelectorAll('.toggle-row').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('label') || event.target.tagName === 'INPUT') return;
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.click();
    });
  });
})();
