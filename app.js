(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';

  // ---- 類型 ----------------------------------------------------------
  function trim(n) { return String(parseFloat(n)); }
  var TYPES = {
    // 綜合實力：單位 M，999 -> 999M，1001 -> 1.001B
    power: {
      fmt: function (v) { return v >= 1000 ? trim((v / 1000).toFixed(3)) + 'B' : v + 'M'; },
      axis: function (v) { return v === 0 ? '0' : v >= 1000 ? trim(v / 1000) + 'B' : v + 'M'; },
      steps: [1, 2, 2.5, 5, 10],
      milestone: 100 // 每 100M 在圖上標一個里程碑
    },
    // 階
    tier: {
      fmt: function (v) { return v + ' 階'; },
      axis: function (v) { return String(v); },
      steps: [1, 2, 5, 10]
    },
    // 等級
    level: {
      fmt: function (v) { return v + ' 級'; },
      axis: function (v) { return String(v); },
      steps: [1, 2, 5, 10],
      milestone: 50, // 每 50 級在圖上標一個里程碑
      milestoneLabel: function (v) { return v + ' 級'; }
    }
  };

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
      if (!d) d = byDay[r.date] = { date: r.date, t: parseDate(r.date), value: r.value, n: 0 };
      d.n += 1;
      if (r.value > d.value) d.value = r.value;
    });
    return Object.keys(byDay).map(function (k) { return byDay[k]; })
      .sort(function (a, b) { return a.t - b.t; });
  }

  function niceTicks(max, steps) {
    var raw = max / 5;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
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

  // ---- 圖表 ----------------------------------------------------------
  function drawChart(wrap, points, cat, type) {
    wrap.textContent = '';
    var W = Math.max(wrap.clientWidth, 280);
    var H = W < 480 ? 240 : 300;
    var m = { l: 44, r: 16, t: 24, b: 28 };

    var t0 = points[0].t;
    var t1 = points[points.length - 1].t;
    var span = (t1 - t0) || 1;
    var maxV = points.reduce(function (a, p) { return Math.max(a, p.value); }, 0);
    var ticks = niceTicks(maxV, type.steps);
    var yMax = ticks[ticks.length - 1];

    function x(t) { return m.l + (t - t0) / span * (W - m.l - m.r); }
    function y(v) { return H - m.b - v / yMax * (H - m.t - m.b); }

    var root = svg('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      role: 'img',
      tabindex: '0',
      'aria-label': cat.name + '成長折線圖，可用左右方向鍵逐日查看；完整數值見下方表格'
    });

    ticks.forEach(function (v) {
      root.appendChild(svg('line', { class: v === 0 ? 'axis' : 'grid', x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
      root.appendChild(svg('text', { class: 'tick', x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', text: type.axis(v) }));
    });

    var y0 = new Date(t0).getUTCFullYear();
    var y1 = new Date(t1).getUTCFullYear();
    for (var yr = y0 + 1; yr <= y1; yr++) {
      root.appendChild(svg('text', { class: 'tick', x: x(Date.UTC(yr, 0, 1)), y: H - 8, 'text-anchor': 'middle', text: String(yr) }));
    }

    var line = points.map(function (p, i) {
      return (i ? 'L' : 'M') + x(p.t).toFixed(1) + ',' + y(p.value).toFixed(1);
    }).join('');
    var last = points[points.length - 1];
    root.appendChild(svg('path', {
      class: 'area',
      d: line + 'L' + x(last.t).toFixed(1) + ',' + y(0) + 'L' + x(t0).toFixed(1) + ',' + y(0) + 'Z'
    }));
    root.appendChild(svg('path', { class: 'line', d: line }));

    // 里程碑：第一次達到整數倍的那一天，標在線上，數字放在點的右下方
    points.forEach(function (p) {
      if (!p.milestone || p === last) return; // 最後一點已有終點標記
      var label = (type.milestoneLabel || type.axis)(p.milestone);
      var nearRight = x(p.t) + 7 + label.length * 7 > W - 4; // 放不下就改放左下方
      root.appendChild(svg('circle', { class: 'ring', cx: x(p.t), cy: y(p.value), r: 5 }));
      root.appendChild(svg('circle', { class: 'dot', cx: x(p.t), cy: y(p.value), r: 3 }));
      root.appendChild(svg('text', {
        class: 'ms-label', x: x(p.t) + (nearRight ? -7 : 7), y: y(p.value) + 14,
        'text-anchor': nearRight ? 'end' : 'start', text: label
      }));
    });

    // 終點標記與數值
    root.appendChild(svg('circle', { class: 'ring', cx: x(last.t), cy: y(last.value), r: 6 }));
    root.appendChild(svg('circle', { class: 'dot', cx: x(last.t), cy: y(last.value), r: 4 }));
    root.appendChild(svg('text', {
      class: 'end-label', x: x(last.t) - 8, y: y(last.value) - 10, 'text-anchor': 'end', text: type.fmt(last.value)
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
    var tipNote = el('div', { className: 'd' });
    tip.appendChild(tipDate);
    tip.appendChild(el('div', { className: 'v' }, [el('span', { className: 'key' }), tipVal]));
    tip.appendChild(tipNote);
    wrap.appendChild(tip);

    var current = -1;
    function show(i) {
      current = i;
      var p = points[i];
      var px = x(p.t), py = y(p.value);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px);
      [hoverRing, hoverDot].forEach(function (c) { c.setAttribute('cx', px); c.setAttribute('cy', py); });
      [cross, hoverRing, hoverDot].forEach(function (n) { n.setAttribute('visibility', 'visible'); });
      tipDate.textContent = fmtDate(p.date);
      tipVal.textContent = type.fmt(p.value);
      var notes = [];
      if (p.milestone) notes.push('里程碑 ' + (type.milestoneLabel || type.axis)(p.milestone));
      if (p.n > 1) notes.push('當日最高，共 ' + p.n + ' 筆');
      tipNote.textContent = notes.join('・');
      tipNote.hidden = !notes.length;
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
      var from = current < 0 ? points.length - 1 : current;
      if (e.key === 'ArrowLeft') { show(Math.max(0, from - 1)); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { show(Math.min(points.length - 1, from + 1)); e.preventDefault(); }
      else if (e.key === 'Escape') hide();
    });
  }

  // ---- 一個種類 ------------------------------------------------------
  // 回傳 { name, section, draw }；section 預設隱藏，由導航切換顯示
  function renderCategory(container, cat) {
    var type = TYPES[cat.type];
    if (!type) throw new Error('unknown type ' + cat.type);
    var records = (cat.records || []).filter(function (r) { return r && typeof r.value === 'number'; });
    if (!records.length) return null;

    var top = records.reduce(function (a, r) { return Math.max(a, r.value); }, 0);
    var chart = el('div', { className: 'chart' });
    var rows = el('tbody');
    records.slice().sort(function (a, b) { return b.value - a.value; }).forEach(function (r) {
      rows.appendChild(el('tr', {}, [
        el('td', { text: type.fmt(r.value) }),
        el('td', { text: fmtDate(r.date) })
      ]));
    });

    var table = el('table', {}, [
      el('thead', {}, [el('tr', {}, [
        el('th', { scope: 'col', text: cat.name }),
        el('th', { scope: 'col', text: '日期' })
      ])]),
      rows
    ]);

    var section = el('section', {
      className: 'card', role: 'tabpanel', id: 'panel-' + cat.name, hidden: ''
    }, [
      el('h2', { text: cat.name }),
      el('p', { className: 'hero', text: type.fmt(top) }),
      chart,
      el('details', {}, [el('summary', { text: '查看全部紀錄' }), table])
    ]);
    container.appendChild(section);

    var points = daily(records);
    if (type.milestone) {
      // 每個整數倍，標在第一次達到它的那一天
      for (var ms = type.milestone; ms <= top; ms += type.milestone) {
        for (var i = 0; i < points.length; i++) {
          if (points[i].value >= ms) {
            if (!points[i].milestone) points[i].milestone = ms;
            break;
          }
        }
      }
    }
    return {
      name: cat.name,
      section: section,
      // 隱藏時寬度是 0，所以要在顯示之後才畫
      draw: function () { if (points.length) drawChart(chart, points, cat, type); }
    };
  }

  // ---- 導航：一次顯示一個種類 ----------------------------------------
  function setupTabs(container, views) {
    var nav = el('div', { className: 'tabs', role: 'tablist' });
    var buttons = views.map(function (v, i) {
      var b = el('button', { type: 'button', role: 'tab', 'aria-controls': v.section.id, text: v.name });
      b.addEventListener('click', function () { select(i, true); });
      b.addEventListener('keydown', function (e) {
        var to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
        if (to === null) return;
        e.preventDefault();
        to = (to + views.length) % views.length;
        select(to, true);
        buttons[to].focus();
      });
      nav.appendChild(b);
      return b;
    });
    container.parentNode.insertBefore(nav, container);

    var active = -1;
    function select(i, remember) {
      active = i;
      views.forEach(function (v, j) {
        v.section.hidden = j !== i;
        buttons[j].setAttribute('aria-selected', j === i ? 'true' : 'false');
        buttons[j].tabIndex = j === i ? 0 : -1;
      });
      views[i].draw();
      if (remember) {
        try { history.replaceState(null, '', '#' + encodeURIComponent(views[i].name)); } catch (e) { /* 忽略 */ }
      }
    }

    var wanted = decodeURIComponent(location.hash.slice(1));
    var start = 0;
    views.forEach(function (v, i) { if (v.name === wanted) start = i; });
    select(start, false);

    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { views[active].draw(); }, 100);
    });
  }

  // ---- 載入 ----------------------------------------------------------
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(url + ' ' + res.status);
      return res.json();
    });
  }

  getJSON('data/index.json')
    .then(function (index) {
      return Promise.all(index.map(function (e) { return getJSON('data/' + e.file); }));
    })
    .then(function (cats) {
      var container = document.getElementById('categories');
      var views = cats.map(function (cat) { return renderCategory(container, cat); })
        .filter(Boolean);
      if (!views.length) throw new Error('empty');
      setupTabs(container, views);
    })
    .catch(function () {
      document.getElementById('error').hidden = false;
    });
})();
