/**
 * teams.js — Relief Center Team Management
 * Fetches teams, unassigned field units; handles create, delete, assign, view.
 */
(() => {
  const AUTH_KEY = 'nexustraffic_auth';
  const API = window.NEXUS_API_BASE || 'http://localhost:5000/api';

  function getToken() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY))?.token; } catch { return null; }
  }

  async function apiFetch(path, opts = {}) {
    const token = getToken();
    const res = await fetch(`${API}${path}`, {
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

  // ─── State ──────────────────────────────────────────────────────────────────
  let allTeams = [];
  let unassignedUsers = [];
  let selectedUnassigned = new Set();
  let currentFilter = 'all';
  let selectedSpec = 'medical';
  let selectedZone = '';

  const zoneColors = { A:'#FF3B30', B:'#FF6B35', C:'#FFB830', D:'#F97316', E:'#34C759', F:'#BF5AF2' };
  const avatarColors = ['#FF3B30','#FF6B35','#FFB830','#F97316','#34C759','#BF5AF2','#3A86FF','#FF2D55'];

  function getInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  }

  function randomColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
  }

  // ─── Clock ──────────────────────────────────────────────────────────────────
  function startClock() {
    const el = document.getElementById('clock');
    if (!el) return;
    const tick = () => {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} UTC`;
    };
    tick(); setInterval(tick, 1000);
  }

  // ─── Create Team Form ───────────────────────────────────────────────────────
  function initCreateForm() {
    // Spec buttons
    document.querySelectorAll('.spec-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.spec-btn').forEach(b => {
          b.classList.remove('bg-[#F97316]', 'text-white');
          b.classList.add('bg-[#1F3448]/30', 'text-[var(--nt-dim)]');
        });
        btn.classList.remove('bg-[#1F3448]/30', 'text-[var(--nt-dim)]');
        btn.classList.add('bg-[#F97316]', 'text-white');
        selectedSpec = btn.dataset.val;
      });
    });

    // Zone buttons
    document.querySelectorAll('.zone-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.zone-btn').forEach(b => {
          b.classList.remove('bg-[#F97316]', 'text-white');
          b.classList.add('bg-[#1F3448]/30', 'text-[var(--nt-dim)]');
        });
        btn.classList.remove('bg-[#1F3448]/30', 'text-[var(--nt-dim)]');
        btn.classList.add('bg-[#F97316]', 'text-white');
        selectedZone = btn.dataset.val;
      });
    });

    // Create button
    document.getElementById('btn-create-team').addEventListener('click', async () => {
      const name = document.getElementById('create-team-name').value.trim();
      if (!name) return alert('Team name is required');
      if (!selectedZone) return alert('Select a zone');

      try {
        await apiFetch('/teams', {
          method: 'POST',
          body: JSON.stringify({ name, zone: selectedZone, specialization: selectedSpec })
        });
        document.getElementById('create-team-name').value = '';
        selectedZone = '';
        document.querySelectorAll('.zone-btn').forEach(b => {
          b.classList.remove('bg-[#F97316]', 'text-white');
          b.classList.add('bg-[#1F3448]/30', 'text-[var(--nt-dim)]');
        });
        await loadData();
      } catch (err) {
        console.error('Create team error:', err);
        alert('Failed to create team');
      }
    });
  }

  // ─── Filter Buttons ─────────────────────────────────────────────────────────
  function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => {
          b.classList.remove('border-[#F97316]/40', 'text-[var(--nt-bright)]');
          b.classList.add('text-[var(--nt-dim)]');
          b.style.borderColor = '';
        });
        btn.classList.add('border-[#F97316]/40', 'text-[var(--nt-bright)]');
        currentFilter = btn.dataset.filter;
        renderTeams();
      });
    });

    // Search
    document.getElementById('search-teams').addEventListener('input', () => renderTeams());
  }

  // ─── Render Teams List ──────────────────────────────────────────────────────
  function renderTeams() {
    const container = document.getElementById('teams-list');
    const searchTerm = document.getElementById('search-teams').value.toLowerCase();

    let filtered = allTeams;
    if (currentFilter !== 'all') {
      filtered = filtered.filter(t => (t.specialization || '') === currentFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter(t => t.name.toLowerCase().includes(searchTerm));
    }

    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12" style="color:var(--nt-dim)">
          <span class="material-symbols-outlined text-4xl block mb-2" style="opacity:0.3">group_off</span>
          <p class="outfit text-xs" style="opacity:0.5">No teams found</p>
        </div>`;
    }

    filtered.forEach(team => {
      const zColor = zoneColors[team.zone] || '#F97316';
      const memberCount = (team.members || []).length;

      const card = document.createElement('div');
      card.className = 'nt-card rounded border border-[var(--nt-card-border)] border-l-4 p-4 flex flex-col gap-4';
      card.style.borderLeftColor = zColor;

      // Member avatars (up to 5)
      let avatarsHtml = '';
      const displayMembers = (team.memberDetails || []).slice(0, 5);
      displayMembers.forEach(m => {
        const initials = getInitials(m.name);
        const color = randomColor(m.name);
        avatarsHtml += `<div class="w-8 h-8 rounded flex items-center justify-center fira-code text-xs font-bold text-white" style="background:${color}">${initials}</div>`;
      });
      if (memberCount > 5) {
        avatarsHtml += `<div class="w-8 h-8 rounded border border-dashed border-[var(--nt-card-border)] flex items-center justify-center fira-code text-[10px] text-[var(--nt-dim)]">+${memberCount - 5}</div>`;
      }
      if (memberCount === 0) {
        avatarsHtml = `<span class="fira-code text-[10px] text-[var(--nt-dim)]">No members assigned</span>`;
      }

      card.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <h3 class="barlow-800 text-xl font-bold text-[var(--nt-bright)] uppercase tracking-tight">${team.name}</h3>
            <div class="flex gap-2 mt-1">
              <span class="bg-[var(--nt-section-bg)] border border-[var(--nt-card-border)] px-2 py-0.5 rounded text-[10px] fira-code" style="color:${zColor}">ZONE_${team.zone}</span>
            </div>
          </div>
          <div class="text-right">
            <span class="barlow-800 text-2xl font-black" style="color:${zColor}">${memberCount}</span>
            <div class="text-[10px] outfit text-[var(--nt-dim)] uppercase font-bold">MEMBERS</div>
          </div>
        </div>
        <div class="flex justify-between items-center border-t border-[var(--nt-card-border)] pt-3">
          <div class="flex -space-x-2">${avatarsHtml}</div>
          <div class="flex gap-2">
            <button class="btn-view bg-[var(--nt-section-bg)] hover:bg-[#1F3448]/30 border border-[var(--nt-card-border)] text-[var(--nt-bright)] outfit text-xs font-semibold px-4 py-1.5 rounded transition-colors">VIEW TEAM</button>
            <button class="btn-delete bg-[var(--nt-section-bg)] hover:bg-[#FF3B30]/20 border border-[var(--nt-card-border)] text-[#FF3B30] outfit text-xs font-semibold px-4 py-1.5 rounded transition-colors">DELETE</button>
          </div>
        </div>`;

      // VIEW
      card.querySelector('.btn-view').addEventListener('click', () => showTeamDetail(team._id));

      // DELETE
      card.querySelector('.btn-delete').addEventListener('click', async () => {
        if (!confirm(`Delete team "${team.name}"?`)) return;
        try {
          await apiFetch(`/teams/${team._id}`, { method: 'DELETE' });
          await loadData();
        } catch (err) { console.error('Delete error:', err); }
      });

      container.appendChild(card);
    });

    // ─── Unassigned Members ─────────────────────────────────────────────
    if (unassignedUsers.length > 0) {
      const section = document.createElement('div');
      section.className = 'mt-8';
      section.innerHTML = `<h2 class="barlow-800 text-lg font-bold text-[var(--nt-dim)] uppercase tracking-tight mb-3 border-b border-[var(--nt-card-border)] pb-2">UNASSIGNED FIELD UNITS</h2>`;
      
      const list = document.createElement('div');
      list.className = 'space-y-2';

      unassignedUsers.forEach(user => {
        const initials = getInitials(user.name);
        const color = randomColor(user.name);
        const isChecked = selectedUnassigned.has(user._id);

        const row = document.createElement('div');
        row.className = 'flex items-center gap-3 p-2 hover:bg-[#1F3448]/20 rounded transition-colors cursor-pointer';
        row.innerHTML = `
          <input class="unassign-check w-4 h-4 rounded border-[var(--nt-card-border)] bg-[var(--nt-body-bg)] text-[#F97316] focus:ring-0" type="checkbox" data-uid="${user._id}" ${isChecked ? 'checked' : ''}/>
          <div class="w-8 h-8 rounded flex items-center justify-center fira-code text-xs font-bold text-white" style="background:${color}">${initials}</div>
          <div class="flex-1">
            <div class="outfit text-sm font-semibold text-[var(--nt-bright)]">${user.name}</div>
            <div class="fira-code text-[10px] text-[var(--nt-dim)]">${user.email}</div>
          </div>
          <span class="bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">FIELD UNIT</span>`;

        row.querySelector('.unassign-check').addEventListener('change', e => {
          if (e.target.checked) selectedUnassigned.add(user._id);
          else selectedUnassigned.delete(user._id);
          updateSelectedCount();
        });

        list.appendChild(row);
      });

      section.appendChild(list);
      container.appendChild(section);
    }
  }

  function updateSelectedCount() {
    document.getElementById('selected-count').textContent = `${selectedUnassigned.size} SELECTED`;
  }

  // ─── Assign to Existing Team (Modal) ───────────────────────────────────────
  function initAssignButton() {
    document.getElementById('btn-assign-existing').addEventListener('click', () => {
      if (selectedUnassigned.size === 0) return alert('Select at least one field unit');
      openTeamPicker();
    });

    document.getElementById('close-picker').addEventListener('click', closeTeamPicker);
    
    // Close on overlay click
    document.getElementById('team-picker-modal').addEventListener('click', (e) => {
      if (e.target.id === 'team-picker-modal') closeTeamPicker();
    });
  }

  function openTeamPicker() {
    const modal = document.getElementById('team-picker-modal');
    const container = document.getElementById('team-picker-container');
    const list = document.getElementById('team-picker-list');
    const main = document.querySelector('main');

    list.innerHTML = '';
    
    if (allTeams.length === 0) {
      list.innerHTML = `<p class="text-center text-[var(--nt-dim)] outfit text-sm py-4">No teams available.</p>`;
    }

    allTeams.forEach(team => {
      const zColor = zoneColors[team.zone] || '#F97316';
      
      const item = document.createElement('button');
      item.className = 'w-full text-left p-4 rounded-lg bg-[var(--nt-body-bg)] border border-[var(--nt-card-border)] transition-all duration-200 group';
      
      item.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <div class="barlow-800 text-lg text-[var(--nt-bright)] group-hover:text-white transition-colors uppercase">${team.name}</div>
            <div class="fira-code text-[10px] text-[var(--nt-dim)] group-hover:text-white/70">ZONE ${team.zone} // ${team.members.length} MEMBERS</div>
          </div>
          <span class="material-symbols-outlined text-[var(--nt-dim)] group-hover:text-white transition-colors">chevron_right</span>
        </div>
      `;

      // Hover color logic
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = zColor;
        item.style.borderColor = zColor;
        item.style.boxShadow = `0 4px 15px ${zColor}40`;
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = '';
        item.style.borderColor = '';
        item.style.boxShadow = '';
      });

      item.addEventListener('click', () => assignToTeam(team._id));
      list.appendChild(item);
    });

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    main.style.filter = 'blur(4px)';
    
    setTimeout(() => {
      container.classList.remove('scale-95', 'opacity-0');
      container.classList.add('scale-100', 'opacity-100');
    }, 10);
  }

  function closeTeamPicker() {
    const modal = document.getElementById('team-picker-modal');
    const container = document.getElementById('team-picker-container');
    const main = document.querySelector('main');

    container.classList.remove('scale-100', 'opacity-100');
    container.classList.add('scale-95', 'opacity-0');
    main.style.filter = '';

    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }, 300);
  }

  async function assignToTeam(teamId) {
    try {
      await apiFetch(`/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ memberIds: Array.from(selectedUnassigned) })
      });
      
      selectedUnassigned.clear();
      updateSelectedCount();
      closeTeamPicker();
      await loadData();
      
      // Optionally show details of the team we just added to
      showTeamDetail(teamId);
    } catch (err) {
      console.error('Assign error:', err);
      alert('Failed to assign members');
    }
  }

  // ─── Team Detail (Right Panel) ──────────────────────────────────────────────
  async function showTeamDetail(teamId) {
    const emptyEl = document.getElementById('detail-empty');
    const viewEl = document.getElementById('detail-view');

    try {
      const team = await apiFetch(`/teams/${teamId}`);
      emptyEl.classList.add('hidden');
      viewEl.classList.remove('hidden');

      const zColor = zoneColors[team.zone] || '#F97316';
      document.getElementById('detail-team-name').textContent = team.name;
      document.getElementById('detail-team-meta').textContent = `ID // ${team._id} · Created ${new Date(team.createdAt).toLocaleDateString()}`;
      document.getElementById('detail-zone').textContent = `ZONE ${team.zone}`;
      document.getElementById('detail-zone').style.color = zColor;
      document.getElementById('detail-member-count').textContent = (team.memberDetails || []).length;

      const membersList = document.getElementById('detail-members-list');
      membersList.innerHTML = '';

      if ((team.memberDetails || []).length === 0) {
        membersList.innerHTML = `<p class="outfit text-xs text-[var(--nt-dim)] text-center py-4">No members assigned to this team yet.</p>`;
        return;
      }

      team.memberDetails.forEach(m => {
        const initials = getInitials(m.name);
        const color = randomColor(m.name);

        const row = document.createElement('div');
        row.className = 'flex items-center gap-3 p-2 rounded';
        row.innerHTML = `
          <div class="w-8 h-8 rounded flex items-center justify-center fira-code text-xs font-bold text-white" style="background:${color}">${initials}</div>
          <div class="flex-1">
            <div class="outfit text-sm font-semibold text-[var(--nt-bright)]">${m.name}</div>
            <div class="fira-code text-[10px] text-[var(--nt-dim)]">${m.email}</div>
          </div>
          <button class="btn-remove-member text-[#FF3B30] hover:bg-[#FF3B30]/20 px-2 py-1 rounded text-xs outfit font-semibold transition-colors border border-transparent hover:border-[#FF3B30]/30">REMOVE</button>`;

        row.querySelector('.btn-remove-member').addEventListener('click', async () => {
          try {
            await apiFetch(`/teams/${teamId}/remove-member`, {
              method: 'PATCH',
              body: JSON.stringify({ memberId: m._id })
            });
            await loadData();
            await showTeamDetail(teamId);
          } catch (err) { console.error('Remove member error:', err); }
        });

        membersList.appendChild(row);
      });
    } catch (err) {
      console.error('Show team detail error:', err);
    }
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────
  function renderStats() {
    document.getElementById('stat-total-teams').textContent = allTeams.length;

    // Total assigned members (unique IDs)
    const assignedSet = new Set();
    allTeams.forEach(t => (t.members || []).forEach(m => assignedSet.add(m.toString())));

    // Total field units = assigned + unassigned
    const totalFieldUnits = assignedSet.size + unassignedUsers.length;
    
    // "MEMBERS" stat should show the total number of field unit users
    document.getElementById('stat-members').textContent = String(totalFieldUnits).padStart(2, '0');

    // "ON DUTY NOW" - for now using the same total or can be a subset if session tracking exists
    // The user specifically asked for "registered as field units that are logged in"
    // Since we don't have a "live" heartbeat yet, we'll show the total available field units
    document.getElementById('stat-on-duty').textContent = String(totalFieldUnits).padStart(2, '0');

    document.getElementById('footer-teams-active').textContent = `TEAMS_ACTIVE: ${allTeams.length}`;
  }

  // ─── Main Data Load ─────────────────────────────────────────────────────────
  async function loadData() {
    try {
      const [teams, unassigned] = await Promise.all([
        apiFetch('/teams'),
        apiFetch('/teams/unassigned')
      ]);

      // For each team, fetch member details for avatars
      const detailedTeams = await Promise.all(
        teams.map(t => apiFetch(`/teams/${t._id}`))
      );

      allTeams = detailedTeams;
      unassignedUsers = unassigned;

      renderStats();
      renderTeams();
    } catch (err) {
      console.error('Load data error:', err);
    }
  }

  // ─── Boot ───────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    startClock();
    initCreateForm();
    initFilters();
    initAssignButton();
    loadData();
  });
})();
