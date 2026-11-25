"""各種類轉換腳本共用的工具：讀 raw/<名稱>.csv，寫 data/<檔名>.json，並更新 data/index.json。

raw 檔格式：每列「數值<TAB>日期」，日期如 2026年11月22日。
最高的「有日期」紀錄之上、還沒填日期的列視為預留（尚未達成），會略過。
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, 'raw')
DATA_DIR = os.path.join(ROOT, 'data')
DATE_RE = re.compile(r'(\d{4})年(\d{1,2})月(\d{1,2})日')


def parse(src):
    records = []
    with io.open(src, encoding='utf-8-sig') as f:
        for line in f.read().splitlines():
            parts = line.split('\t')
            if not re.fullmatch(r'\d+', parts[0].strip()):
                continue  # 標題列、空列
            value = int(parts[0])
            raw_date = parts[1].strip() if len(parts) > 1 else ''
            m = DATE_RE.fullmatch(raw_date)
            if raw_date and not m:
                sys.exit('%s：無法解析日期 %r（數值 %d）' % (src, raw_date, value))
            date = '%04d-%02d-%02d' % tuple(map(int, m.groups())) if m else None
            records.append({'value': value, 'date': date})
    return records


def check(records, top):
    values = [r['value'] for r in records]
    if len(values) != len(set(values)):
        sys.exit('有重複的數值')
    if values:
        missing = sorted(set(range(min(values), top + 1)) - set(values))
        if missing:
            print('  提醒：缺少數值 %s' % missing)
    prev = None
    for r in records:
        if r['date']:
            if prev and r['date'] < prev[1]:
                print('  提醒：日期順序不一致：%d (%s) 早於 %d (%s)' % (r['value'], r['date'], prev[0], prev[1]))
            prev = (r['value'], r['date'])
    undated = sum(1 for r in records if r['date'] is None)
    if undated:
        print('  提醒：%d 筆沒有日期（不會畫進走勢圖）' % undated)


def update_index(name, filename):
    """同名取代，新的種類接在最後面。順序就是網站導航的順序。"""
    path = os.path.join(DATA_DIR, 'index.json')
    index = []
    if os.path.exists(path):
        with io.open(path, encoding='utf-8') as f:
            index = json.load(f)
    entry = {'name': name, 'file': filename}
    for i, e in enumerate(index):
        if e['name'] == name:
            index[i] = entry
            break
    else:
        index.append(entry)
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
        f.write('\n')


def write(name, kind, filename, records):
    lines = [json.dumps(r, ensure_ascii=False) for r in records]
    dst = os.path.join(DATA_DIR, filename)
    with io.open(dst, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n  "name": %s,\n  "type": "%s",\n  "records": [\n    '
                % (json.dumps(name, ensure_ascii=False), kind))
        f.write(',\n    '.join(lines))
        f.write('\n  ]\n}\n')
    update_index(name, filename)
    print('  %d 筆 -> data/%s' % (len(records), filename))


def convert(name, kind, filename):
    """標準流程。某個種類格式特殊時，可以在自己的腳本裡改寫這幾步。"""
    print(name)
    src = os.path.join(RAW_DIR, name + '.csv')
    if not os.path.exists(src):
        sys.exit('找不到 %s' % src)
    records = parse(src)

    top = max((r['value'] for r in records if r['date']), default=0)
    skipped = sorted(r['value'] for r in records if r['date'] is None and r['value'] > top)
    records = [r for r in records if r['value'] <= top]
    if skipped:
        print('  略過尚未達成的預留列：%s' % skipped)

    records.sort(key=lambda r: r['value'])
    check(records, top)
    write(name, kind, filename, records)
