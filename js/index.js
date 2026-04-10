// ── TOKENIZER ────────────────────────────────────────────────────────────────
function tokenize(re) {
  const t = [];
  for (let i = 0; i < re.length; i++) {
    const c = re[i];
    if ('()*+?'.includes(c)) t.push({ type: 'op', val: c });
    else t.push({ type: 'sym', val: c });
  }
  return t;
}
function addConcat(toks) {
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]; out.push(t);
    if (i + 1 < toks.length) {
      const n = toks[i + 1];
      const lOk = t.val !== '(' && t.val !== '+';
      const rOk = n.val !== ')' && n.val !== '+' && n.val !== '*' && n.val !== '?';
      if (lOk && rOk) out.push({ type: 'op', val: '.' });
    }
  }
  return out;
}
function toPostfix(toks) {
  const prec = { '+': 1, '.': 2, '?': 3, '*': 3 };
  const out = [], stk = [];
  for (const t of toks) {
    if (t.type === 'sym') { out.push(t); }
    else if (t.val === '(') { stk.push(t); }
    else if (t.val === ')') {
      while (stk.length && stk[stk.length - 1].val !== '(') out.push(stk.pop());
      stk.pop();
    } else {
      const p = prec[t.val] || 0;
      while (stk.length && stk[stk.length - 1].val !== '(' && (prec[stk[stk.length - 1].val] || 0) >= p) out.push(stk.pop());
      stk.push(t);
    }
  }
  while (stk.length) out.push(stk.pop());
  return out;
}

// ── THOMPSON'S NFA ───────────────────────────────────────────────────────────
let _sid = 0;
function ns(acc = false) { return { id: _sid++, accept: acc, trans: {} }; }
function at(f, sym, t) { if (!f.trans[sym]) f.trans[sym] = []; f.trans[sym].push(t); }
function buildNFA(pf) {
  _sid = 0; const stk = [];
  for (const t of pf) {
    if (t.type === 'sym') {
      const s = ns(), e = ns(true); at(s, t.val, e); stk.push({ start: s, end: e });
    } else if (t.val === '.') {
      const b = stk.pop(), a = stk.pop(); a.end.accept = false; at(a.end, 'ε', b.start); stk.push({ start: a.start, end: b.end });
    } else if (t.val === '+') {
      const b = stk.pop(), a = stk.pop();
      const s = ns(), e = ns(true);
      at(s, 'ε', a.start); at(s, 'ε', b.start); a.end.accept = false; b.end.accept = false; at(a.end, 'ε', e); at(b.end, 'ε', e);
      stk.push({ start: s, end: e });
    } else if (t.val === '*') {
      const a = stk.pop(); const s = ns(), e = ns(true); a.end.accept = false;
      at(s, 'ε', a.start); at(s, 'ε', e); at(a.end, 'ε', a.start); at(a.end, 'ε', e); stk.push({ start: s, end: e });
    } else if (t.val === '?') {
      const a = stk.pop(); const s = ns(), e = ns(true); a.end.accept = false;
      at(s, 'ε', a.start); at(s, 'ε', e); at(a.end, 'ε', e); stk.push({ start: s, end: e });
    }
  }
  return stk[0];
}
function collectStates(start) {
  const map = new Map(), q = [start], seen = new Set();
  while (q.length) { const s = q.shift(); if (seen.has(s.id)) continue; seen.add(s.id); map.set(s.id, s); for (const ts of Object.values(s.trans)) for (const t of ts) if (!seen.has(t.id)) q.push(t); }
  return map;
}

// ── SUBSET CONSTRUCTION ──────────────────────────────────────────────────────
function epsClosure(ids, map) {
  const c = new Set(ids), stk = [...ids];
  while (stk.length) { const id = stk.pop(); const s = map.get(id); if (!s) continue; for (const t of (s.trans['ε'] || [])) if (!c.has(t.id)) { c.add(t.id); stk.push(t.id); } }
  return c;
}
function moveSet(ids, sym, map) {
  const r = new Set();
  for (const id of ids) { const s = map.get(id); if (!s) continue; for (const t of (s.trans[sym] || [])) r.add(t.id); }
  return r;
}
function buildDFA(nfa, alpha, smap) {
  const sc = epsClosure([nfa.start.id], smap);
  const sk = [...sc].sort((a, b) => a - b).join(',');
  const states = new Map(); let did = 0;
  states.set(sk, { id: did++, nfaStates: sc, trans: {}, accept: false });
  const q = [sc];
  while (q.length) {
    const cur = q.shift(); const ck = [...cur].sort((a, b) => a - b).join(','); const cs = states.get(ck);
    for (const id of cur) if (smap.get(id)?.accept) { cs.accept = true; break; }
    for (const sym of alpha) {
      const mv = moveSet(cur, sym, smap); if (!mv.size) continue;
      const cl = epsClosure([...mv], smap); const key = [...cl].sort((a, b) => a - b).join(',');
      if (!states.has(key)) { states.set(key, { id: did++, nfaStates: cl, trans: {}, accept: false }); q.push(cl); }
      cs.trans[sym] = states.get(key).id;
    }
  }
  return { states, startKey: sk, alpha };
}

// ── MINIMIZATION ─────────────────────────────────────────────────────────────
function minimizeDFA(dfa) {
  const arr = [...dfa.states.values()]; const n = arr.length;
  const idx = new Map(arr.map((s, i) => [s.id, i]));
  const dist = Array.from({ length: n }, () => new Array(n).fill(false));
  for (let i = 0; i < n; i++)for (let j = i + 1; j < n; j++)if (arr[i].accept !== arr[j].accept) { dist[i][j] = dist[j][i] = true; }
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++)for (let j = i + 1; j < n; j++) {
      if (dist[i][j]) continue;
      for (const sym of dfa.alpha) {
        const ti = arr[i].trans[sym], tj = arr[j].trans[sym];
        if (ti === undefined && tj === undefined) continue;
        if (ti === undefined || tj === undefined) { dist[i][j] = dist[j][i] = true; changed = true; break; }
        const ii = idx.get(ti), ij = idx.get(tj);
        if (ii !== ij && dist[ii][ij]) { dist[i][j] = dist[j][i] = true; changed = true; break; }
      }
    }
  }
  const group = new Array(n).fill(-1); let gid = 0;
  for (let i = 0; i < n; i++) { if (group[i] !== -1) continue; group[i] = gid; for (let j = i + 1; j < n; j++)if (!dist[i][j]) group[j] = gid; gid++; }
  const ms = new Map();
  for (let i = 0; i < n; i++) {
    const g = group[i];
    if (!ms.has(g)) ms.set(g, { id: g, members: [], trans: {}, accept: false, nfaStates: new Set() });
    const m = ms.get(g); m.members.push(arr[i].id);
    if (arr[i].accept) m.accept = true;
    for (const s of arr[i].nfaStates) m.nfaStates.add(s);
  }
  for (const [, m] of ms) {
    const rep = arr[group.indexOf(m.id)];
    for (const sym of dfa.alpha) {
      if (rep.trans[sym] !== undefined) {
        const ti = idx.get(rep.trans[sym]); m.trans[sym] = group[ti];
      }
    }
  }
  const startS = dfa.states.get(dfa.startKey);
  return { states: ms, startGroup: group[idx.get(startS.id)], alpha: dfa.alpha, orig: n };
}

// ── D3 RENDERER ──────────────────────────────────────────────────────────────
const ZB = {};
function renderGraph(cid, nodes, links, opts = {}) {
  const el = document.getElementById(cid);
  el.innerHTML = '';
  if (!nodes.length) { el.innerHTML = '<div class="empty-st"><div class="empty-ic">◈</div><div>No states</div></div>'; return; }
  const W = el.clientWidth || 900, H = el.clientHeight || 620;
  const color = opts.color || '#8b5cf6';
  const aid = 'ar-' + cid;

  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
  const defs = svg.append('defs');
  const mkA = (id, col, rx = 32, mw = 7) => defs.append('marker').attr('id', id).attr('viewBox', '0 -5 10 10').attr('refX', rx).attr('refY', 0).attr('markerWidth', mw).attr('markerHeight', mw).attr('orient', 'auto').append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', col);
  mkA(aid, color); mkA(aid + '-e', 'rgba(139,92,246,0.5)'); mkA(aid + '-h', '#f59e0b');
  mkA(aid + '-s', color, 10, 5); // Use default panel color for start arrow

  const root = svg.append('g');

  // Enable standard D3 zoom behavior matching the reference file
  const zoom = d3.zoom().scaleExtent([0.1, 5])
    .on('zoom', e => root.attr('transform', e.transform));
  svg.call(zoom); ZB[cid] = { zoom, svg };

  const lmap = new Map();
  for (const l of links) {
    const src = typeof l.source === 'object' ? l.source.id : l.source;
    const tgt = typeof l.target === 'object' ? l.target.id : l.target;
    const k = `${src}-${tgt}`;
    if (!lmap.has(k)) lmap.set(k, []); lmap.get(k).push(l);
  }

  const lG = root.append('g'), lblG = root.append('g'), nG = root.append('g');

  const lp = lG.selectAll('path').data(links).enter().append('path')
    .attr('id', d => {
      const s = typeof d.source === 'object' ? d.source.id : d.source;
      const t = typeof d.target === 'object' ? d.target.id : d.target;
      return `link-${cid}-${s}-${t}-${d.label}`;
    })
    .attr('stroke', d => d.eps ? 'rgba(139,92,246,0.45)' : (d.hl ? '#f59e0b' : color))
    .attr('stroke-width', d => d.hl ? 2.5 : 1.4)
    .attr('fill', 'none')
    .attr('stroke-dasharray', d => d.eps ? '5,3' : 'none')
    .attr('marker-end', d => `url(#${d.eps ? (aid + '-e') : d.hl ? (aid + '-h') : aid})`);

  const ll = lblG.selectAll('text').data(links).enter().append('text')
    .attr('font-size', '12px').attr('font-family', 'JetBrains Mono,monospace')
    .attr('fill', d => d.eps ? 'rgba(139,92,246,0.7)' : (d.hl ? '#f59e0b' : '#8899b4'))
    .attr('text-anchor', 'middle').attr('font-weight', '600')
    .text(d => d.label);

  const R = Math.min(W, H) * 0.36;
  nodes.forEach((n, i) => { const a = 2 * Math.PI * i / nodes.length; n.x = W / 2 + R * Math.cos(a); n.y = H / 2 + R * Math.sin(a); });

  const ng = nG.selectAll('g').data(nodes).enter().append('g')
    .attr('id', d => `node-${cid}-${d.id}`)
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

  ng.append('circle').attr('r', 22)
    .attr('fill', 'var(--bg)') // Opaque background to hide internal lines
    .attr('stroke', d => d.hl ? '#f59e0b' : (d.accept ? '#f59e0b' : color))
    .attr('stroke-width', d => d.hl ? 2.5 : 2);

  ng.filter(d => d.accept).append('circle').attr('r', 15).attr('fill', 'none')
    .attr('stroke', '#f59e0b').attr('stroke-width', 1.2);

  ng.filter(d => d.start).append('line')
    .attr('x1', -60).attr('y1', 0).attr('x2', -22).attr('y2', 0)
    .attr('stroke', color).attr('stroke-width', 2)
    .attr('marker-end', `url(#${aid + '-s'})`);

  ng.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em')
    .attr('font-size', '11px').attr('font-family', 'JetBrains Mono,monospace')
    .attr('fill', d => d.hl ? '#f59e0b' : '#e8edf5').attr('font-weight', '700')
    .text(d => d.label);

  if (opts.subsets) {
    ng.append('title').text(d => d.subset ? `NFA states: {${[...d.subset].sort((a, b) => a - b).join(', ')}}` : '');
  }

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(nodes.length > 8 ? 90 : 110).strength(0.4))
    .force('charge', d3.forceManyBody().strength(nodes.length > 12 ? -700 : -500))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(38));

  function getXY(d) { return { sx: typeof d.source === 'object' ? d.source.x : 0, sy: typeof d.source === 'object' ? d.source.y : 0, tx: typeof d.target === 'object' ? d.target.x : 0, ty: typeof d.target === 'object' ? d.target.y : 0, sid: typeof d.source === 'object' ? d.source.id : d.source, tid: typeof d.target === 'object' ? d.target.id : d.target }; }

  sim.on('tick', () => {
    lp.attr('d', d => {
      const { sx, sy, tx, ty, sid, tid } = getXY(d);
      if (sid === tid) return `M${sx - 14},${sy - 20} C${sx - 42},${sy - 72} ${sx + 42},${sy - 72} ${sx + 14},${sy - 20}`;
      const key = `${sid}-${tid}`; const grp = lmap.get(key) || []; const gi = grp.indexOf(d);
      const dx = tx - sx, dy = ty - sy, len = Math.sqrt(dx * dx + dy * dy) || 1;
      const cv = (grp.length > 1 ? (gi === 0 ? 1 : -1) : 0) * 40;
      const mx = (sx + tx) / 2 - dy / len * cv, my = (sy + ty) / 2 + dx / len * cv;
      return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
    });
    ll.attr('x', d => {
      const { sx, sy, tx, ty, sid, tid } = getXY(d);
      if (sid === tid) return sx;
      return (sx + tx) / 2;
    }).attr('y', d => {
      const { sx, sy, tx, ty, sid, tid } = getXY(d);
      if (sid === tid) return sy - 56;
      const dx = tx - sx, dy = ty - sy, len = Math.sqrt(dx * dx + dy * dy) || 1;
      const key = `${sid}-${tid}`; const grp = lmap.get(key) || []; const gi = grp.indexOf(d);
      const cv = (grp.length > 1 ? (gi === 0 ? 1 : -1) : 0) * 40;
      return (sy + ty) / 2 + dx / len * cv - 7;
    });
    ng.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}
function zI(c) { const z = ZB[c]; if (z) z.svg.transition().duration(200).call(z.zoom.scaleBy, 1.4); }
function zO(c) { const z = ZB[c]; if (z) z.svg.transition().duration(200).call(z.zoom.scaleBy, 0.7); }
function zR(c) { const z = ZB[c]; if (z) z.svg.transition().duration(300).call(z.zoom.transform, d3.zoomIdentity); }

// ── GRAPH DATA BUILDERS ──────────────────────────────────────────────────────
function nfaData(start, map) {
  const nodes = [], links = [], vis = new Set(), q = [start];
  while (q.length) {
    const s = q.shift(); if (vis.has(s.id)) continue; vis.add(s.id);
    nodes.push({ id: s.id, label: `q${s.id}`, accept: s.accept, start: s.id === start.id });
    for (const [sym, targets] of Object.entries(s.trans)) for (const t of targets) {
      links.push({ source: s.id, target: t.id, label: sym === 'ε' ? 'ε' : sym, eps: sym === 'ε', self: s.id === t.id });
      if (!vis.has(t.id)) q.push(t);
    }
  }
  return { nodes, links };
}
function dfaData(states, startKey) {
  const start = states.get(startKey);
  const nodes = [...states.values()].map(s => ({ id: s.id, label: `D${s.id}`, accept: s.accept, start: s.id === start.id, subset: s.nfaStates }));
  const links = [];
  for (const s of states.values()) for (const [sym, tid] of Object.entries(s.trans)) links.push({ source: s.id, target: tid, label: sym, self: s.id === tid });
  return { nodes, links };
}
function minData(states, startG) {
  const nodes = [...states.values()].map(s => ({ id: s.id, label: `M${s.id}`, accept: s.accept, start: s.id === startG, subset: s.nfaStates }));
  const links = [];
  for (const s of states.values()) for (const [sym, tid] of Object.entries(s.trans)) links.push({ source: s.id, target: tid, label: sym, self: s.id === tid });
  return { nodes, links };
}

// ── GLOBALS ──────────────────────────────────────────────────────────────────
let gDFA = null, gMin = null, gAlpha = [], tabMode = 'dfa', hlRow = null;
let gNfaFrag = null, gSmap = null;

// ── MAIN PIPELINE ─────────────────────────────────────────────────────────────
function runPipeline() {
  const re = document.getElementById('regexIn').value.trim();
  const errEl = document.getElementById('errMsg'); errEl.className = 'errmsg';
  if (!re) { showErr('Please enter a regular expression.'); return; }
  try {
    let toks = tokenize(re); toks = addConcat(toks);
    const pf = toPostfix(toks);
    if (!pf.length) { showErr('Invalid regex.'); return; }
    gNfaFrag = buildNFA(pf);
    if (!gNfaFrag) { showErr('Could not build NFA. Check syntax.'); return; }
    gSmap = collectStates(gNfaFrag.start);
    const alphaSet = new Set();
    for (const s of gSmap.values()) for (const sym of Object.keys(s.trans)) if (sym !== 'ε') alphaSet.add(sym);
    gAlpha = [...alphaSet].sort();
    gDFA = buildDFA(gNfaFrag, gAlpha, gSmap);
    gMin = minimizeDFA(gDFA);

    // Save to localStorage for detail pages
    localStorage.setItem('pipeline_regex', re);

    let nfaTot = 0, nfaEps = 0, nfaSym = 0;
    for (const s of gSmap.values()) for (const [sym, ts] of Object.entries(s.trans)) { nfaTot += ts.length; if (sym === 'ε') nfaEps += ts.length; else nfaSym += ts.length; }
    const dfaTot = [...gDFA.states.values()].reduce((a, s) => a + Object.keys(s.trans).length, 0);
    document.getElementById('nfaS').textContent = gSmap.size;
    document.getElementById('nfaT').textContent = nfaTot;
    document.getElementById('nfaE').textContent = nfaEps;
    document.getElementById('dfaS').textContent = gDFA.states.size;
    document.getElementById('dfaT').textContent = dfaTot;
    document.getElementById('minS').textContent = gMin.states.size;
    document.getElementById('minR').textContent = gMin.orig - gMin.states.size;
    document.getElementById('nfaBadge').textContent = gSmap.size + ' states';
    document.getElementById('dfaBadge').textContent = gDFA.states.size + ' states';
    document.getElementById('minBadge').textContent = gMin.states.size + ' states';

    document.getElementById('nfaIS').textContent = gSmap.size;
    document.getElementById('nfaIE').textContent = nfaEps;
    document.getElementById('nfaISY').textContent = nfaSym;
    document.getElementById('dfaIS').textContent = gDFA.states.size;
    document.getElementById('dfaIT').textContent = dfaTot;
    document.getElementById('minIS').textContent = gMin.states.size;
    document.getElementById('minIR').textContent = gMin.orig + ' → ' + gMin.states.size;
    ['nfaInfo', 'dfaInfo', 'minInfo'].forEach(id => document.getElementById(id).className = 'ginfo show');

    ['ps1', 'ps2', 'ps3', 'ps4'].forEach((id, i) => document.getElementById(id).className = `ps s${i + 1} active`);

    const { nodes: nn, links: nl } = nfaData(gNfaFrag.start, gSmap);
    renderGraph('nfaCanvas', nn, nl, { color: '#8b5cf6' });
    const { nodes: dn, links: dl } = dfaData(gDFA.states, gDFA.startKey);
    renderGraph('dfaCanvas', dn, dl, { color: '#0891b2', subsets: true });
    const { nodes: mn, links: ml } = minData(gMin.states, gMin.startGroup);
    renderGraph('minCanvas', mn, ml, { color: '#059669', subsets: true });

    document.getElementById('regexIn').classList.remove('err');
    document.getElementById('traceArea').style.display = 'none';
    resetVisual();
    renderTable(tabMode);

  } catch (e) { showErr('Parse error: ' + e.message); document.getElementById('regexIn').classList.add('err'); }
}

// ── STRING TESTER ────────────────────────────────────────────────────────────
function testStr() {
  if (!gMin) { alert('Run the pipeline first!'); return; }
  const str = document.getElementById('testIn').value;
  const ms = gMin.states; let cur = gMin.startGroup, dead = false;
  const trace = [{ sid: cur, sym: null }];
  for (const ch of str) {
    const s = ms.get(cur);
    if (!s || s.trans[ch] === undefined) { dead = true; trace.push({ sid: null, sym: ch, dead: true }); break; }
    cur = s.trans[ch]; trace.push({ sid: cur, sym: ch });
  }
  const acc = !dead && ms.get(cur)?.accept;
  let h = '<div class="trace-steps">';
  for (let i = 0; i < trace.length; i++) {
    const t = trace[i];
    if (i > 0) h += `<span class="tarr">─</span><span class="tsym">${t.sym}</span><span class="tarr">→</span>`;
    if (t.dead) h += `<span class="tstate dead">DEAD</span>`;
    else { const last = i === trace.length - 1; h += `<span class="tstate ${last ? 'cur' : 'vis'}">M${t.sid}</span>`; }
  }
  h += `</div><div class="verdict ${acc ? 'acc' : 'rej'}">${acc ? '✓ ACCEPTED' : '✗ REJECTED'} — ${acc ? 'string belongs to the language' : 'string is not in the language'}</div>`;
  const ta = document.getElementById('traceArea'); ta.innerHTML = h; ta.style.display = 'block';
  if (!dead) { hlRow = cur; renderTable(tabMode); }
}

// ── TABLES ───────────────────────────────────────────────────────────────────
function renderTable(mode) {
  const el = document.getElementById('tblContent');
  const data = mode === 'dfa' ? gDFA : gMin;
  if (!data) { el.innerHTML = '<div style="color:var(--t3);font-size:.78rem;font-family:var(--font-mono)">No data yet.</div>'; return; }
  const arr = [...data.states.values()];
  const startId = mode === 'dfa' ? data.states.get(data.startKey).id : data.startGroup;
  const pfx = mode === 'dfa' ? 'D' : 'M';
  let h = `<table class="ttable"><thead><tr><th>State</th><th>Type</th>`;
  for (const a of gAlpha) h += `<th>${a}</th>`;
  h += '</tr></thead><tbody>';
  for (const s of arr) {
    const isSt = s.id === startId, isAc = s.accept;
    const cls = isSt && isAc ? 'both' : isSt ? 'st' : isAc ? 'ac' : '';
    let typeLabel = '';
    if (isSt && isAc) typeLabel = `<span style="color:var(--a3);font-weight:700">Start &amp; Final</span>`;
    else if (isSt) typeLabel = `<span style="color:var(--a1);font-weight:700">Start State</span>`;
    else if (isAc) typeLabel = `<span style="color:var(--a4);font-weight:700">Final State</span>`;
    else typeLabel = `<span style="color:var(--t2)">Intermediate</span>`;
    const hl = hlRow === s.id ? 'hrow' : '';
    h += `<tr class="${hl}"><td class="${cls}">${pfx}${s.id}</td><td>${typeLabel}</td>`;
    for (const a of gAlpha) {
      const t = s.trans[a];
      if (t !== undefined) {
        h += `<td>${pfx}${t}</td>`;
      } else {
        h += `<td class="dead-cell">No transition</td>`;
      }
    }
    h += '</tr>';
  }
  h += '</tbody></table>';
  h += `<div class="legend">
<div class="li"><div class="li-dot" style="background:var(--a1);opacity:.7"></div><span style="color:var(--a1);font-weight:600">Start State</span></div>
<div class="li"><div class="li-dot" style="background:var(--a4);opacity:.7"></div><span style="color:var(--a4);font-weight:600">Final State</span></div>
<div class="li"><div class="li-dot" style="background:var(--a3);opacity:.7"></div><span style="color:var(--a3);font-weight:600">Start &amp; Final State</span></div>
<div class="li"><div class="li-dot" style="background:var(--t3);opacity:.5"></div><span style="color:var(--t3)">Intermediate State</span></div>
</div>`;
  el.innerHTML = h;
}
function showTab(m) {
  tabMode = m; hlRow = null;
  document.getElementById('tabDFA').className = 'tab' + (m === 'dfa' ? ' active' : '');
  document.getElementById('tabMin').className = 'tab' + (m === 'min' ? ' active' : '');
  renderTable(m);
}
function setP(re) { document.getElementById('regexIn').value = re; runPipeline(); }
function showErr(m) { const e = document.getElementById('errMsg'); e.textContent = m; e.className = 'errmsg show'; }
function clearAll() {
  document.getElementById('regexIn').value = '';
  document.getElementById('regexIn').classList.remove('err');
  document.getElementById('errMsg').className = 'errmsg';
  ['nfaCanvas', 'dfaCanvas', 'minCanvas'].forEach(id => { document.getElementById(id).innerHTML = '<div class="empty-st"><div class="empty-ic">◈</div><div>—</div></div>'; });
  ['nfaBadge', 'dfaBadge', 'minBadge'].forEach(id => document.getElementById(id).textContent = '—');
  ['nfaS', 'nfaT', 'nfaE', 'dfaS', 'dfaT', 'minS', 'minR'].forEach(id => document.getElementById(id).textContent = '—');
  ['ps1', 'ps2', 'ps3', 'ps4'].forEach(id => document.getElementById(id).className = 'ps s' + id.replace('ps', ''));
  ['nfaInfo', 'dfaInfo', 'minInfo'].forEach(id => document.getElementById(id).className = 'ginfo');
  document.getElementById('traceArea').style.display = 'none';
  document.getElementById('tblContent').innerHTML = '<div style="color:var(--t3);font-size:.78rem;font-family:var(--font-mono)">Run the pipeline to see transition tables.</div>';
  resetVisual();
  gDFA = null; gMin = null; hlRow = null; gNfaFrag = null; gSmap = null;
}
function openSteps(type) {
  const re = document.getElementById('regexIn').value.trim();
  if (!re) { alert('Run the pipeline first!'); return; }
  localStorage.setItem('pipeline_regex', re);
  if (type === 'nfa') window.open('html/steps-nfa.html', '_blank');
  else if (type === 'dfa') window.open('html/steps-dfa.html', '_blank');
  else if (type === 'min') window.open('html/steps-min.html', '_blank');
}
// ── STRING VISUALIZER LOGIC ─────────────────────────────────────────────────
let vIdx = -1, vCur = null, vDead = false, vTimer = null, vActiveReg = '';

function resetVisual() {
  stopPlay();
  vIdx = -1; vDead = false; vActiveReg = '';
  if (gMin) vCur = gMin.startGroup;
  updateVisualUI();
}

function updateVisualUI() {
  const str = document.getElementById('testIn').value;
  const prog = document.getElementById('testProg');
  const tape = document.getElementById('progTape');

  if (vIdx === -1 && !vActiveReg) {
    prog.classList.remove('show');
    clearHighlights();
    return;
  }

  prog.classList.add('show');
  let tapeHtml = '';
  for (let i = 0; i < str.length; i++) {
    if (i === vIdx) tapeHtml += `<span class="char-hl">${str[i]}</span>`;
    else tapeHtml += str[i];
  }
  tape.innerHTML = tapeHtml || '<span style="color:var(--t3)">(empty)</span>';

  // Update Graph Highlights
  clearHighlights();
  if (vCur !== null) {
    const node = d3.select(`#node-minCanvas-${vCur}`);
    if (!node.empty()) {
      node.classed('node-active', true);
      // If we finished the string, check acceptance
      if (vIdx === str.length - 1 || (str === '' && vIdx === -1)) {
        const ms = gMin.states.get(vCur);
        if (ms && ms.accept) node.classed('node-final-acc', true);
        else if (vDead) node.classed('node-final-rej', true);
      }
    }
  }
  if (vDead) {
    // If dead, we don't have a node, but maybe we can show an error or just the rejected state
  }
}

function clearHighlights() {
  d3.selectAll('#minCanvas .node-active, #minCanvas .node-final-acc, #minCanvas .node-final-rej').classed('node-active node-final-acc node-final-rej', false);
  d3.selectAll('#minCanvas .link-active').classed('link-active', false);
}

function stepVisual() {
  if (!gMin) { alert('Run the pipeline first!'); return; }
  const str = document.getElementById('testIn').value;

  // Starting a new test
  if (vIdx === -1 && vActiveReg === '') {
    vIdx = -1; vCur = gMin.startGroup; vDead = false; vActiveReg = str;
    // Highlight start state immediately
    updateVisualUI();
    // If empty string, we are done
    if (str === '') return;
  }

  if (vIdx >= str.length - 1 || vDead) {
    stopPlay();
    return;
  }

  vIdx++;
  const ch = str[vIdx];
  const s = gMin.states.get(vCur);

  if (!s || s.trans[ch] === undefined) {
    vDead = true;
    updateVisualUI();
    stopPlay();
    return;
  }

  const prev = vCur;
  vCur = s.trans[ch];

  // Highlight the link
  const linkId = `#link-minCanvas-${prev}-${vCur}-${ch}`;
  d3.select(linkId).classed('link-active', true);

  updateVisualUI();

  if (vIdx === str.length - 1) {
    stopPlay();
    // Final check for acceptance
    testStr(); // Show the text verdict too
  }
}

function togglePlay() {
  if (vTimer) {
    stopPlay();
  } else {
    const btn = document.getElementById('btnPlay');
    btn.classList.add('play-active');
    document.getElementById('playIcon').textContent = 'Ⅱ';
    document.getElementById('playText').textContent = 'Pause';

    // Start stepping
    if (vIdx >= (document.getElementById('testIn').value.length - 1) && vIdx !== -1) {
      resetVisual();
    }

    vTimer = setInterval(stepVisual, 800);
    stepVisual(); // First step immediate
  }
}

function stopPlay() {
  if (vTimer) {
    clearInterval(vTimer);
    vTimer = null;
  }
  const btn = document.getElementById('btnPlay');
  btn.classList.remove('play-active');
  document.getElementById('playIcon').textContent = '▶';
  document.getElementById('playText').textContent = 'Play';
}

window.addEventListener('load', () => runPipeline());
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('regexIn').addEventListener('keydown', e => { if (e.key === 'Enter') runPipeline(); });
  document.getElementById('testIn').addEventListener('keydown', e => { if (e.key === 'Enter') testStr(); });
});
