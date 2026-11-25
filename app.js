(function () {
  'use strict';

  var LABELS = { stage: '關卡 / 進度', level: '等級', power: '戰力' };

  var listEl = document.getElementById('list');
  var statusEl = document.getElementById('status');
  var countEl = document.getElementById('count');
  var latestEl = document.getElementById('latest');
  var latestBody = document.getElementById('latest-body');

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

  function render(records) {
    var items = records
      .filter(function (r) { return r && r.date; })
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

    countEl.textContent = items.length ? '(' + items.length + ')' : '';
    statusEl.hidden = items.length > 0;
    statusEl.textContent = '還沒有紀錄。';

    items.forEach(function (r) {
      var meta = el('div', { className: 'meta' }, [el('span', { className: 'date', text: r.date })]);
      ['stage', 'level', 'power'].forEach(function (f) {
        if (r[f]) meta.appendChild(el('span', { text: LABELS[f] + '：' + r[f] }));
      });
      var li = el('li', {}, [meta]);
      if (r.note) li.appendChild(el('p', { className: 'note', text: r.note }));
      listEl.appendChild(li);
    });

    if (items.length) {
      var last = items[0];
      latestEl.hidden = false;
      [['date', '日期'], ['stage', LABELS.stage], ['level', LABELS.level], ['power', LABELS.power]]
        .forEach(function (p) {
          if (!last[p[0]]) return;
          latestBody.appendChild(el('div', {}, [
            el('dt', { text: p[1] }),
            el('dd', { text: String(last[p[0]]) })
          ]));
        });
    }
  }

  fetch('data/records.json', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    })
    .then(function (data) {
      if (!Array.isArray(data)) throw new Error('format');
      render(data);
    })
    .catch(function () {
      statusEl.textContent = '無法載入紀錄。';
    });
})();
