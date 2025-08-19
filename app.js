/* Poem Forms test — no build tools required */
(() => {
  const GRID = document.getElementById('grid');
  const searchInput = document.getElementById('search');
  const sortSelect = document.getElementById('sort');
  const reloadBtn   = document.getElementById('reload');

  let shuffle; // Shuffle.js instance

  // --- 1) Data: fetch poems from PoetryDB ---------------------------
  // PoetryDB supports CORS and has a /random endpoint.
  // Docs/examples: https://poetrydb.org/ (see homepage) and README on GitHub.
  const POETRYDB_RANDOM = (n) => `https://poetrydb.org/random/${n}`;

  async function fetchPoems(n = 60) {
    const res = await fetch(POETRYDB_RANDOM(n), { cache: 'no-store' });
    if (!res.ok) throw new Error('PoetryDB request failed');
    const list = await res.json();
    return list.map(p => ({
      title: p.title?.trim() || 'Untitled',
      author: p.author?.trim() || 'Unknown',
      lines: (p.lines || []).map(s => s.replace(/\s+$/g, '')).filter(s => s.length > 0)
    }));
  }

  // Fallback: tiny local sample so the grid still renders offline or if API fails.
  async function fallbackPoems() {
    const res = await fetch('data/sample-poems.json').catch(() => null);
    if (res && res.ok) return res.json();
    return [{
      title: "Hope is the thing with feathers",
      author: "Emily Dickinson",
      lines: [
        "'Hope' is the thing with feathers—",
        "That perches in the soul—",
        "And sings the tune without the words—",
        "And never stops—at all—"
      ]
    },{
      title: "This Is Just To Say",
      author: "William Carlos Williams",
      lines: [
        "I have eaten","the plums","that were in","the icebox",
        "and which","you were probably","saving","for breakfast",
        "Forgive me","they were delicious","so sweet","and so cold"
      ]
    }];
  }

  // --- 2) Rendering: poem -> SVG bar stack --------------------------
  function colorFromString(seed) {
    // Deterministic soft color from string (author); HSL to RGB
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `hsl(${hue} 65% 60%)`;
  }

  function poemToSVG(lines, opts = {}) {
    const barH = opts.barH ?? 6;
    const gap  = opts.gap  ?? 2;
    const maxW = opts.maxW ?? 300;

    const lengths = lines.map(s => s.trim().length);
    const longest = Math.max(1, ...lengths);
    const height  = Math.max(barH, lengths.length * (barH + gap) - gap);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg   = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${maxW} ${height}`);
    svg.setAttribute('role', 'img');

    lengths.forEach((len, i) => {
      const w = Math.max(2, (len / longest) * maxW);
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', String(i * (barH + gap)));
      rect.setAttribute('width', w.toFixed(1));
      rect.setAttribute('height', String(barH));
      rect.setAttribute('rx', '2');
      rect.setAttribute('fill', opts.fill || 'hotpink');
      svg.appendChild(rect);
    });

    return svg;
  }

  // --- 3) Card builder ----------------------------------------------
  function bucketByLineCount(n) {
    if (n < 12) return 'length:short';
    if (n < 30) return 'length:medium';
    return 'length:long';
  }

  function buildCard(poem) {
    const { title, author, lines } = poem;
    const color = colorFromString(author);
    const maxLineChars = Math.max(0, ...lines.map(s => s.trim().length));

    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.groups = JSON.stringify([`author:${author}`, bucketByLineCount(lines.length)]);
    el.dataset.title = title.toLowerCase();
    el.dataset.author = author.toLowerCase();
    el.dataset.lines = String(lines.length);
    el.dataset.maxline = String(maxLineChars);

    const figure = document.createElement('div');
    figure.className = 'shape';
    figure.appendChild(poemToSVG(lines, { fill: color, barH: 6, gap: 2, maxW: 320 }));
    el.appendChild(figure);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `
      <div class="title">${escapeHTML(title)}</div>
      <div class="author">${escapeHTML(author)}</div>
      <div class="stats">${lines.length} line(s) · longest line: ${maxLineChars} chars</div>
    `;
    el.appendChild(meta);

    return el;
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // --- 4) Shuffle wiring (filter + sort) -----------------------------
  function mountGrid(items) {
    GRID.innerHTML = '';
    items.forEach(el => GRID.appendChild(el));
    if (shuffle) shuffle.destroy();
    shuffle = new window.Shuffle(GRID, { itemSelector: '.card' });
  }

  function wireControls() {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) return shuffle.filter(() => true);
      shuffle.filter(el => (
        el.dataset.title.includes(q) || el.dataset.author.includes(q)
      ));
    });

    sortSelect.addEventListener('change', () => {
      const mode = sortSelect.value;
      const by = {
        'most-lines'  : el => +el.dataset.lines,
        'fewest-lines': el => +el.dataset.lines,
        'longest-line': el => +el.dataset.maxline,
        'title'       : el => el.dataset.title
      }[mode];

      if (!by) return shuffle.sort(); // default
      shuffle.sort({ by, reverse: (mode === 'most-lines' || mode === 'longest-line') });
    });

    reloadBtn.addEventListener('click', () => load());
  }

  // --- 5) Boot -------------------------------------------------------
  async function load() {
    try {
      const poems = await fetchPoems(64);
      mountGrid(poems.map(buildCard));
    } catch (e) {
      console.warn('Falling back to sample poems:', e);
      const poems = await fallbackPoems();
      mountGrid(poems.map(buildCard));
    }
  }

  wireControls();
  load();
})();
