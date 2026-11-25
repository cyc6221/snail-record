(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';

  // ---- 格式 ----------------------------------------------------------
  // 資料單位是 M：999 -> 999M，1001 -> 1.001B
  function trim(n) { return String(parseFloat(n)); }
  function fmt(m) { return m >= 1000 ? trim((m / 1000).toFixed(3)) + 'B' : m + 'M'; }
  function fmtAxis(m) { return m === 0 ? '0' : m >= 1000 ? trim(m / 1000) + 'B' : m + 'M'; }
  function fmtDate(s) {
    if (!s) return '—';
    var p = s.split('-');
    return p[0] + '/' + (+p[1]) + '/' + (+p[2]);
  }
  function parseDate(s) {
    var p = s.split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'text') node.textContent = props[k];
      else if (k === 'className') node.className = props[k];
      else node.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }
  function svg(tag, attrs) {
    var node = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    return node;
  }

  // ---- 資料整理 ------------------------------------------------------
  // 每天只取最高值當作該日的點
  function daily(records) {
    var byDay = {};
    records.forEach(function (r) {
      if (!r.date) return;
      var d = byDay[r.date];
      if (!d) d = byDay[r.date] = { date: r.date, t: parseDate(r.date), power: r.power, n: 0 };
      d.n += 1;
      if (r.power > d.power) d.power = r.power;
    });
    return Object.keys(byDay).map(function (k) { return byDay[k]; })
      .sort(function (a, b) { return a.t - b.t; });
  }

  function niceTicks(max) {
    var raw = max / 5;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var steps = [1, 2, 2.5, 5, 10];
    var step = mag * 10;
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] * mag >= raw) { step = steps[i] * mag; break; }
    }
    var ticks = [];
    for (var v = 0; ; v += step) {
      ticks.push(v);
      if (v >= max) break;
    }
    return ticks;
  }

  // ---- 頂部摘要 ------------------------------------------------------
  // 最上方還沒寫日期的 = 還沒達成（目標）。
  // 比最高的「有日期」紀錄更低、但沒日期的，視為已達成但日期不詳。
  function split(records) {
    var top = records.filter(function (r) { return r.date; })
      .reduce(function (a, b) { return !a || b.power > a.power ? b : a; }, null);
    var topPower = top ? top.power : 0;
    return {
      top: top,
      achieved: records.filter(function (r) { return r.power <= topPower; }),
      pending: records.filter(function (r) { return r.power > topPower; })
        .sort(function (a, b) { return a.power - b.power; })
    };
  }

  function renderHero(s) {
    var next = document.getElementById('hero-next');
    if (!s.top) {
      document.getElementById('hero-sub').textContent = '還沒有已達成的紀錄。';
    } else {
      document.getElementById('hero').textContent = fmt(s.top.power);
      document.getElementById('hero-sub').textContent = '更新於 ' + fmtDate(s.top.date);
    }
    if (s.pending.length) {
      next.textContent = '下一個目標 ' + fmt(s.pending[0].power);
      next.hidden = false;
    }
  }

  // ---- 表格 ----------------------------------------------------------
  function renderTable(s) {
    var rows = document.getElementById('rows');
    var pendingSet = {};
    s.pending.forEach(function (r) { pendingSet[r.power] = true; });
    s.achieved.concat(s.pending).sort(function (a, b) { return b.power - a.power; }).forEach(function (r) {
      var done = !pendingSet[r.power];
      rows.appendChild(el('tr', done ? {} : { className: 'pending' }, [
        el('td', { text: fmt(r.power) }),
        el('td', { text: done ? fmtDate(r.date) : '尚未達成' })
      ]));
    });
    var note = '已達成 ' + s.achieved.length + ' 筆';
    if (s.pending.length) note += '，目標 ' + s.pending.length + ' 筆';
    document.getElementById('count').textContent = '(' + note + ')';
    document.getElementById('table-card').hidden = false;
  }

  // ---- 圖表 ----------------------------------------------------------
  function drawChart(points) {
    var wrap = document.getElementById('chart');
    wrap.textContent = '';
    var W = Math.max(wrap.clientWidth, 280);
    var H = W < 480 ? 240 : 300;
    var m = { l: 44, r: 16, t: 24, b: 28 };

    var t0 = points[0].t;
    var t1 = points[points.length - 1].t;
    var span = (t1 - t0) || 1;
    var maxP = points.reduce(function (a, p) { return Math.max(a, p.power); }, 0);
    var ticks = niceTicks(maxP);
    var yMax = ticks[ticks.length - 1];

    function x(t) { return m.l + (t - t0) / span * (W - m.l - m.r); }
    function y(v) { return H - m.b - v / yMax * (H - m.t - m.b); }

    var root = svg('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      role: 'img',
      tabindex: '0',
      'aria-label': '綜合實力成長折線圖，可用左右方向鍵逐日查看；完整數值見下方表格'
    });

    ticks.forEach(function (v) {
      root.appendChild(svg('line', { class: v === 0 ? 'axis' : 'grid', x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
      root.appendChild(svg('text', { class: 'tick', x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', text: fmtAxis(v) }));
    });

    var y0 = new Date(t0).getUTCFullYear();
    var y1 = new Date(t1).getUTCFullYear();
    for (var yr = y0 + 1; yr <= y1; yr++) {
      var tx = Date.UTC(yr, 0, 1);
      root.appendChild(svg('text', { class: 'tick', x: x(tx), y: H - 8, 'text-anchor': 'middle', text: String(yr) }));
    }

    var line = points.map(function (p, i) {
      return (i ? 'L' : 'M') + x(p.t).toFixed(1) + ',' + y(p.power).toFixed(1);
    }).join('');
    var last = points[points.length - 1];
    root.appendChild(svg('path', {
      class: 'area',
      d: line + 'L' + x(last.t).toFixed(1) + ',' + y(0) + 'L' + x(t0).toFixed(1) + ',' + y(0) + 'Z'
    }));
    root.appendChild(svg('path', { class: 'line', d: line }));

    // 終點標記與數值
    root.appendChild(svg('circle', { class: 'ring', cx: x(last.t), cy: y(last.power), r: 6 }));
    root.appendChild(svg('circle', { class: 'dot', cx: x(last.t), cy: y(last.power), r: 4 }));
    root.appendChild(svg('text', {
      class: 'end-label', x: x(last.t) - 8, y: y(last.power) - 10, 'text-anchor': 'end', text: fmt(last.power)
    }));

    // 互動：十字線 + 浮動說明
    var cross = svg('line', { class: 'cross', y1: m.t, y2: H - m.b, visibility: 'hidden' });
    var hoverRing = svg('circle', { class: 'ring', r: 6, visibility: 'hidden' });
    var hoverDot = svg('circle', { class: 'dot', r: 4, visibility: 'hidden' });
    var hit = svg('rect', { x: m.l, y: 0, width: W - m.l - m.r, height: H, fill: 'transparent' });
    [cross, hoverRing, hoverDot, hit].forEach(function (n) { root.appendChild(n); });
    wrap.appendChild(root);

    var tip = el('div', { className: 'tip', hidden: '' });
    var tipDate = el('div', { className: 'd' });
    var tipVal = el('b');
    tip.appendChild(tipDate);
    tip.appendChild(el('div', { className: 'v' }, [el('span', { className: 'key' }), tipVal]));
    var tipNote = el('div', { className: 'd' });
    tip.appendChild(tipNote);
    wrap.appendChild(tip);

    var current = -1;
    function show(i) {
      current = i;
      var p = points[i];
      var px = x(p.t), py = y(p.power);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px);
      [hoverRing, hoverDot].forEach(function (c) { c.setAttribute('cx', px); c.setAttribute('cy', py); });
      [cross, hoverRing, hoverDot].forEach(function (n) { n.setAttribute('visibility', 'visible'); });
      tipDate.textContent = fmtDate(p.date);
      tipVal.textContent = fmt(p.power);
      tipNote.textContent = p.n > 1 ? '當日最高，共 ' + p.n + ' 筆' : '';
      tipNote.hidden = p.n <= 1;
      tip.hidden = false;
      var scale = wrap.clientWidth / W;
      var left = px * scale + 12;
      if (left + tip.offsetWidth > wrap.clientWidth) left = px * scale - tip.offsetWidth - 12;
      tip.style.left = Math.max(0, left) + 'px';
    }
    function hide() {
      current = -1;
      [cross, hoverRing, hoverDot].forEach(function (n) { n.setAttribute('visibility', 'hidden'); });
      tip.hidden = true;
    }
    function nearest(clientX) {
      var rect = root.getBoundingClientRect();
      var t = t0 + ((clientX - rect.left) / rect.width * W - m.l) / (W - m.l - m.r) * span;
      var best = 0;
      for (var i = 1; i < points.length; i++) {
        if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
      }
      return best;
    }

    hit.addEventListener('pointermove', function (e) { show(nearest(e.clientX)); });
    hit.addEventListener('pointerdown', function (e) { show(nearest(e.clientX)); });
    hit.addEventListener('pointerleave', hide);
    root.addEventListener('focus', function () { show(current < 0 ? points.length - 1 : current); });
    root.addEventListener('blur', hide);
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { show(Math.max(0, (current < 0 ? points.length - 1 : current) - 1)); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { show(Math.min(points.length - 1, (current < 0 ? points.length - 1 : current) + 1)); e.preventDefault(); }
      else if (e.key === 'Escape') hide();
    });
  }

  function renderChart(records) {
    var points = daily(records);
    if (!points.length) return;
    var card = document.getElementById('chart-card');
    card.hidden = false;
    drawChart(points);
    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { drawChart(points); }, 100);
    });
  }

  // ---- 載入 ----------------------------------------------------------
  fetch('data/power.json', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    })
    .then(function (data) {
      var records = (data.records || []).filter(function (r) { return r && typeof r.power === 'number'; });
      if (!records.length) throw new Error('empty');
      var s = split(records);
      renderHero(s);
      renderChart(records);
      renderTable(s);
    })
    .catch(function () {
      document.getElementById('hero-sub').textContent = '無法載入紀錄。';
    });
})();
