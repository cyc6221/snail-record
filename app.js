(function () {
  'use strict';

  var KEY = 'snail-record:v1';
  var FIELDS = ['date', 'stage', 'level', 'power', 'note'];
  var LABELS = { stage: '關卡 / 進度', level: '等級', power: '戰力' };

  var form = document.getElementById('form');
  var formTitle = document.getElementById('form-title');
  var submitBtn = document.getElementById('submit');
  var cancelBtn = document.getElementById('cancel');
  var listEl = document.getElementById('list');
  var emptyEl = document.getElementById('empty');
  var countEl = document.getElementById('count');
  var latestEl = document.getElementById('latest');
  var latestBody = document.getElementById('latest-body');
  var fileInput = document.getElementById('file');

  var records = load();
  var editingId = null;

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(records));
    } catch (e) {
      alert('無法儲存到瀏覽器，請先匯出備份。');
    }
  }

  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function sorted() {
    return records.slice().sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0);
    });
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

  function render() {
    var items = sorted();
    countEl.textContent = items.length ? '(' + items.length + ')' : '';
    emptyEl.hidden = items.length > 0;

    listEl.textContent = '';
    items.forEach(function (r) {
      var meta = el('div', { className: 'meta' }, [el('span', { className: 'date', text: r.date })]);
      ['stage', 'level', 'power'].forEach(function (f) {
        if (r[f]) meta.appendChild(el('span', { text: LABELS[f] + '：' + r[f] }));
      });

      var edit = el('button', { type: 'button', className: 'secondary small', text: '編輯' });
      edit.addEventListener('click', function () { startEdit(r.id); });
      var del = el('button', { type: 'button', className: 'secondary small danger', text: '刪除' });
      del.addEventListener('click', function () { remove(r.id); });

      var li = el('li', {}, [meta]);
      if (r.note) li.appendChild(el('p', { className: 'note', text: r.note }));
      li.appendChild(el('div', { className: 'actions' }, [edit, del]));
      listEl.appendChild(li);
    });

    latestBody.textContent = '';
    if (items.length) {
      var last = items[0];
      latestEl.hidden = false;
      [['date', '日期'], ['stage', LABELS.stage], ['level', LABELS.level], ['power', LABELS.power]]
        .forEach(function (p) {
          if (!last[p[0]]) return;
          latestBody.appendChild(el('div', {}, [
            el('dt', { text: p[1] }),
            el('dd', { text: last[p[0]] })
          ]));
        });
    } else {
      latestEl.hidden = true;
    }
  }

  function resetForm() {
    editingId = null;
    form.reset();
    form.elements.date.value = today();
    formTitle.textContent = '新增紀錄';
    submitBtn.textContent = '新增';
    cancelBtn.hidden = true;
  }

  function startEdit(id) {
    var r = records.find(function (x) { return x.id === id; });
    if (!r) return;
    editingId = id;
    FIELDS.forEach(function (f) { form.elements[f].value = r[f] || ''; });
    formTitle.textContent = '編輯紀錄';
    submitBtn.textContent = '儲存';
    cancelBtn.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function remove(id) {
    if (!confirm('確定要刪除這筆紀錄嗎？')) return;
    records = records.filter(function (x) { return x.id !== id; });
    if (editingId === id) resetForm();
    save();
    render();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var values = {};
    FIELDS.forEach(function (f) { values[f] = form.elements[f].value.trim(); });

    if (editingId) {
      var r = records.find(function (x) { return x.id === editingId; });
      if (r) Object.assign(r, values);
    } else {
      records.push(Object.assign({ id: newId(), createdAt: Date.now() }, values));
    }
    save();
    resetForm();
    render();
  });

  cancelBtn.addEventListener('click', resetForm);

  document.getElementById('export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: 'snail-record-' + today() + '.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById('import').addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', function () {
    var file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('format');
        var clean = data.filter(function (r) { return r && typeof r === 'object' && r.date; })
          .map(function (r) {
            var o = { id: String(r.id || newId()), createdAt: Number(r.createdAt) || Date.now() };
            FIELDS.forEach(function (f) { o[f] = r[f] == null ? '' : String(r[f]); });
            return o;
          });
        if (!confirm('將匯入 ' + clean.length + ' 筆紀錄，並覆蓋目前的資料，確定嗎？')) return;
        records = clean;
        save();
        resetForm();
        render();
      } catch (err) {
        alert('匯入失敗：檔案格式不正確。');
      }
    };
    reader.readAsText(file);
  });

  resetForm();
  render();
})();
