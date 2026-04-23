(() => {
  /* ── Filter chips ──────────────────────────────── */
  const chips = document.querySelectorAll('.chip');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  /* ── Sort select ───────────────────────────────── */
  const sortSelect = document.getElementById('sort-select');
  if (!sortSelect) return;

  sortSelect.addEventListener('change', () => {
    const value = sortSelect.value;

    // Find all incident card containers (each section has its own parent div)
    // We target every .incident-card in the page and sort within their parent
    const allParents = new Set();
    document.querySelectorAll('.incident-card').forEach(card => {
      allParents.add(card.parentElement);
    });

    allParents.forEach(parent => {
      const cards = Array.from(parent.querySelectorAll('.incident-card'));
      if (cards.length < 2) return;

      cards.sort((a, b) => {
        const sA = parseInt(a.dataset.severity || '99', 10);
        const sB = parseInt(b.dataset.severity || '99', 10);
        const tA = parseInt(a.dataset.time || '0', 10);
        const tB = parseInt(b.dataset.time || '0', 10);

        if (value === 'newest')       return tB - tA;
        if (value === 'oldest')       return tA - tB;
        if (value === 'severity')     return sA - sB;
        if (value === 'severity-asc') return sB - sA;
        return 0;
      });

      // Fade out → reorder → fade in
      cards.forEach(c => { c.style.opacity = '0'; c.style.transform = 'translateY(6px)'; });

      setTimeout(() => {
        cards.forEach(c => parent.appendChild(c));
        requestAnimationFrame(() => {
          cards.forEach(c => {
            c.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
            c.style.opacity   = '';
            c.style.transform = '';
          });
        });
      }, 160);
    });
  });
})();
