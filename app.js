(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';

  // ---- 類型 ----------------------------------------------------------
  function trim(n) { return String(parseFloat(n)); }
  function few(unit) {
    return {
      unit: unit,
      fmt: function (v) { return v + ' ' + unit; },
      axis: function (v) { return String(v); },
      steps: [1, 2, 5, 10],
      zeroBased: false,
      tickStep: 1,      // 每個點剛好落在刻度線上
      showPoints: true, // 每一筆都標點，不合併同一天
      showDiff: true    // 兩點之間標示相隔天數
    };
  }
  var TYPES = {
    // 綜合實力：單位 M，999 -> 999M，1001 -> 1.001B
    power: {
      fmt: function (v) { return v >= 1000 ? trim((v / 1000).toFixed(3)) + 'B' : v + 'M'; },
      axis: function (v) { return v === 0 ? '0' : v >= 1000 ? trim(v / 1000) + 'B' : v + 'M'; },
      steps: [1, 2, 2.5, 5, 10],
      milestone: 100 // 每 100M 在圖上標一個里程碑
    },
    // 筆數很少的種類：每一筆都標點、兩點之間標示相隔天數。Y 軸不從 0 開始，每 1 單位一格
    contract: few('級'),   // 勞務派遣
    tierpoints: few('階'), // 紀元古樹
    // 等
    rank: {
      fmt: function (v) { return v + ' 等'; },
      axis: function (v) { return String(v); },
      steps: [1, 2, 5, 10],
      milestone: 10, // 每 10 等在圖上標一個里程碑
      milestoneLabel: function (v) { return v + ' 等'; }
    },
    // 階
    tier: {
      fmt: function (v) { return v + ' 階'; },
      axis: function (v) { return String(v); },
      steps: [1, 2, 5, 10],
      milestone: 10, // 每 10 階在圖上標一個里程碑
      milestoneLabel: function (v) { return v + ' 階'; }
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
      if (!d) d = byDay[r.date] = { date: r.date, t: parseDate(r.date), value: r.value, diff: r.diff, n: 0 };
      d.n += 1;
      if (r.value > d.value) { d.value = r.value; d.diff = r.diff; }
    });
    return Object.keys(byDay).map(function (k) { return byDay[k]; })
      .sort(function (a, b) { return a.t - b.t; });
  }

  // 從 lo 往下取到整齊的刻度，一路到 hi 以上
  function niceTicks(lo, hi, steps) {
    if (hi <= lo) hi = lo + 1;
    var raw = (hi - lo) / 5;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = mag * 10;
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] * mag >= raw) { step = steps[i] * mag; break; }
    }
    var ticks = [];
    for (var v = Math.floor(lo / step) * step; ; v += step) {
      ticks.push(v);
      if (v >= hi) break;
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
    var minV = type.zeroBased === false
      ? points.reduce(function (a, p) { return Math.min(a, p.value); }, maxV)
      : 0;
    var ticks;
    if (type.tickStep) {
      ticks = [];
      for (var tv = Math.floor(minV / type.tickStep) * type.tickStep; tv < maxV + type.tickStep; tv += type.tickStep) {
        ticks.push(tv);
        if (tv >= maxV) break;
      }
    } else {
      ticks = niceTicks(minV, maxV, type.steps);
    }
    var yMin = ticks[0];
    var yMax = ticks[ticks.length - 1];

    function x(t) { return m.l + (t - t0) / span * (W - m.l - m.r); }
    function y(v) { return H - m.b - (v - yMin) / (yMax - yMin) * (H - m.t - m.b); }

    var root = svg('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      role: 'img',
      tabindex: '0',
      'aria-label': cat.name + '成長折線圖，可用左右方向鍵逐日查看；完整數值見下方表格'
    });

    ticks.forEach(function (v) {
      root.appendChild(svg('line', { class: v === yMin ? 'axis' : 'grid', x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
      root.appendChild(svg('text', { class: 'tick', x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', text: type.axis(v) }));
    });

    var y0 = new Date(t0).getUTCFullYear();
    var y1 = new Date(t1).getUTCFullYear();
    if (y1 > y0) {
      // 跨年：以每年 1/1 的位置標年份
      for (var yr = y0 + 1; yr <= y1; yr++) {
        root.appendChild(svg('text', { class: 'tick', x: x(Date.UTC(yr, 0, 1)), y: H - 8, 'text-anchor': 'middle', text: String(yr) }));
      }
    } else {
      // 同一年內：以月份當刻度（最多約 6 個）
      var d0 = new Date(t0);
      var m0 = d0.getUTCMonth() + (d0.getUTCDate() > 1 ? 1 : 0);
      var m1 = new Date(t1).getUTCMonth();
      var mStep = Math.max(1, Math.ceil((m1 - m0 + 1) / 6));
      for (var mo = m0; mo <= m1; mo += mStep) {
        root.appendChild(svg('text', {
          class: 'tick', x: x(Date.UTC(y0, mo, 1)), y: H - 8, 'text-anchor': 'middle', text: y0 + '/' + (mo + 1)
        }));
      }
    }

    var line = points.map(function (p, i) {
      return (i ? 'L' : 'M') + x(p.t).toFixed(1) + ',' + y(p.value).toFixed(1);
    }).join('');
    var last = points[points.length - 1];
    root.appendChild(svg('path', {
      class: 'area',
      d: line + 'L' + x(last.t).toFixed(1) + ',' + y(yMin) + 'L' + x(t0).toFixed(1) + ',' + y(yMin) + 'Z'
    }));
    root.appendChild(svg('path', { class: 'line', d: line }));

    // 每一筆都標點（最後一點由終點標記負責）
    if (type.showPoints) {
      points.forEach(function (p) {
        if (p === last) return;
        root.appendChild(svg('circle', { class: 'ring', cx: x(p.t), cy: y(p.value), r: 6 }));
        root.appendChild(svg('circle', { class: 'dot', cx: x(p.t), cy: y(p.value), r: 4 }));
      });
    }

    // 兩點之間標示相隔天數：放在線段中點的右下方，放不下就改放左下方
    if (type.showDiff) {
      for (var di = 1; di < points.length; di++) {
        var b = points[di];
        if (!b.diff) continue; // 沒有、或同一天（0 天）就不標
        var a = points[di - 1];
        var mx = (x(a.t) + x(b.t)) / 2;
        var my = (y(a.value) + y(b.value)) / 2;
        var dtext = b.diff + ' 天';
        var flip = mx + 6 + dtext.length * 7 > W - 4;
        root.appendChild(svg('text', {
          class: 'diff-label', x: mx + (flip ? -6 : 6), y: my + 14,
          'text-anchor': flip ? 'end' : 'start', text: dtext
        }));
      }
    }

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

    // 折線在畫面橫向 px 位置的 y；超出範圍回傳 null
    function curveY(px) {
      for (var k = 1; k < points.length; k++) {
        var xa = x(points[k - 1].t), xb = x(points[k].t);
        if (px >= xa && px <= xb) {
          var r = xb === xa ? 0 : (px - xa) / (xb - xa);
          return y(points[k - 1].value) + r * (y(points[k].value) - y(points[k - 1].value));
        }
      }
      return null;
    }

    // 相鄰兩個里程碑之間的天數：放在連線中點的左上方（線的上方是空的，不會蓋到里程碑數字）
    var msPts = points.filter(function (p) { return p.milestone; });
    for (var mi = 1; mi < msPts.length; mi++) {
      var mb = msPts[mi];
      if (!mb.msDiff) continue;
      var ma = msPts[mi - 1];
      var cx = (x(ma.t) + x(mb.t)) / 2;
      var cy = (y(ma.value) + y(mb.value)) / 2;
      var ctext = mb.msDiff + ' 天';
      var cw = ctext.length * 7;
      var tooLeft = cx - 4 - cw < m.l; // 左邊放不下就改放右下方
      var ly = cy - 8;
      if (!tooLeft) {
        // 曲線比連線凸的時候，標籤要再往上，避免壓到曲線
        for (var s = 0; s <= 6; s++) {
          var cyAt = curveY(cx - 4 - cw + cw * s / 6);
          if (cyAt !== null) ly = Math.min(ly, cyAt - 5);
        }
      }
      root.appendChild(svg('text', {
        class: 'diff-label', x: cx + (tooLeft ? 6 : -4), y: tooLeft ? cy + 14 : ly,
        'text-anchor': tooLeft ? 'start' : 'end', text: ctext
      }));
    }

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
      if (p.msDiff) notes.push('距上一個里程碑 ' + p.msDiff + ' 天');
      if (p.diff != null) notes.push('距上一' + type.unit + ' ' + p.diff + ' 天');
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
        // 同一天有多點時取最高的那一點
        if (Math.abs(points[i].t - t) <= Math.abs(points[best].t - t)) best = i;
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
    var base = TYPES[cat.type];
    if (!base) throw new Error('unknown type ' + cat.type);
    var type = Object.assign({}, base);
    if (cat.milestone) type.milestone = cat.milestone; // 資料裡可以覆蓋這個種類的里程碑間隔
    var records = (cat.records || []).filter(function (r) { return r && typeof r.value === 'number'; });
    if (!records.length) return null;

    var top = records.reduce(function (a, r) { return Math.max(a, r.value); }, 0);
    var chart = el('div', { className: 'chart' });
    var hasDiff = records.some(function (r) { return r.diff != null; });
    var rows = el('tbody');
    records.slice().sort(function (a, b) { return b.value - a.value; }).forEach(function (r) {
      var cells = [
        el('td', { text: type.fmt(r.value) }),
        el('td', { text: fmtDate(r.date) })
      ];
      if (hasDiff) cells.push(el('td', { text: r.diff != null ? r.diff + ' 天' : '—' }));
      rows.appendChild(el('tr', {}, cells));
    });

    var heads = [
      el('th', { scope: 'col', text: cat.name }),
      el('th', { scope: 'col', text: '日期' })
    ];
    if (hasDiff) heads.push(el('th', { scope: 'col', text: '距上一' + (type.unit || '級') }));
    var table = el('table', {}, [el('thead', {}, [el('tr', {}, heads)]), rows]);

    var section = el('section', {
      className: 'card', role: 'tabpanel', id: 'panel-' + cat.name, hidden: ''
    }, [
      el('h2', { text: cat.name }),
      el('p', { className: 'hero', text: type.fmt(top) }),
      chart,
      el('details', {}, [el('summary', { text: '查看全部紀錄' }), table])
    ]);
    container.appendChild(section);

    // 每點都標的種類不合併同一天；其他種類每天只取最高值
    var points = type.showPoints
      ? records.filter(function (r) { return r.date; })
          .map(function (r) { return { date: r.date, t: parseDate(r.date), value: r.value, diff: r.diff, n: 1 }; })
          .sort(function (a, b) { return a.t - b.t || a.value - b.value; })
      : daily(records);
    if (type.milestone) {
      // 每個整數倍，標在第一次達到它的那一天。
      // 同一天跨過多個時，標最高的那個；記錄一開始就已超過的不標。
      for (var ms = type.milestone; ms <= top; ms += type.milestone) {
        for (var i = 0; i < points.length; i++) {
          if (points[i].value >= ms) {
            if (i > 0 || points[0].value === ms) points[i].milestone = ms;
            break;
          }
        }
      }
      // 距上一個里程碑的天數
      var prevMs = null;
      points.forEach(function (p) {
        if (!p.milestone) return;
        if (prevMs) p.msDiff = Math.round((p.t - prevMs.t) / 86400000);
        prevMs = p;
      });
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
