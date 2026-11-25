"""把 raw/*.csv（數值<TAB>日期）一次轉成 data/ 下的 JSON，並產生 data/index.json。

用法（在專案根目錄）：python -I scripts/convert.py

新增種類：把 raw/<名稱>.csv 放好，在下面的 CATEGORIES 加一行即可。
類型：
  power  綜合實力，單位 M（999 = 999M，1001 = 1.001B）
  level  等級

最高的「有日期」紀錄之上、還沒填日期的列視為預留（尚未達成），會略過。
"""
import io
import json
import os
import re
import sys

# (名稱, 類型, 輸出檔名) — 順序就是網站上的顯示順序
CATEGORIES = [
    ('綜合實力', 'power', 'power.json'),
    ('元素法陣', 'level', 'element.json'),
]

RAW_DIR = 'raw'
DATA_DIR = 'data'
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


def convert(name, kind, filename):
    src = os.path.join(RAW_DIR, name + '.csv')
    dst = os.path.join(DATA_DIR, filename)
    records = parse(src)

    top = max((r['value'] for r in records if r['date']), default=0)
    skipped = sorted(r['value'] for r in records if r['date'] is None and r['value'] > top)
    records = [r for r in records if r['value'] <= top]
    if skipped:
        print('  略過尚未達成的預留列：%s' % skipped)

    values = [r['value'] for r in records]
    if len(values) != len(set(values)):
        sys.exit('%s：有重複的數值' % src)
    records.sort(key=lambda r: r['value'])

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

    lines = [json.dumps(r, ensure_ascii=False) for r in records]
    with io.open(dst, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n  "name": %s,\n  "type": "%s",\n  "records": [\n    '
                % (json.dumps(name, ensure_ascii=False), kind))
        f.write(',\n    '.join(lines))
        f.write('\n  ]\n}\n')
    print('  %d 筆 -> %s' % (len(records), dst))


def main():
    index = []
    for name, kind, filename in CATEGORIES:
        print(name)
        if not os.path.exists(os.path.join(RAW_DIR, name + '.csv')):
            sys.exit('找不到 %s/%s.csv' % (RAW_DIR, name))
        convert(name, kind, filename)
        index.append({'name': name, 'file': filename})

    with io.open(os.path.join(DATA_DIR, 'index.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
