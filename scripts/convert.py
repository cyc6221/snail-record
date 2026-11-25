"""把 raw/<名稱>.csv（數值<TAB>日期）轉成 data/ 下的 JSON，並更新 data/index.json。

類型（--type）：
  power  綜合實力，單位 M（999 = 999M，1001 = 1.001B）
  level  等級

最高的「有日期」紀錄之上、還沒填日期的列視為預留（尚未達成），會略過。

用法：python -I scripts/convert.py raw/元素法陣.csv data/element.json --type level
"""
import argparse
import io
import json
import os
import re
import sys

DATE_RE = re.compile(r'(\d{4})年(\d{1,2})月(\d{1,2})日')
TYPES = ('power', 'level')


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
                sys.exit('無法解析日期：%r（數值 %d）' % (raw_date, value))
            date = '%04d-%02d-%02d' % tuple(map(int, m.groups())) if m else None
            records.append({'value': value, 'date': date})
    return records


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--type', required=True, choices=TYPES)
    args = ap.parse_args()

    name = os.path.splitext(os.path.basename(args.src))[0]
    records = parse(args.src)

    top = max((r['value'] for r in records if r['date']), default=0)
    skipped = sorted(r['value'] for r in records if r['date'] is None and r['value'] > top)
    records = [r for r in records if r['value'] <= top]
    if skipped:
        print('略過尚未達成的預留列：%s' % skipped)

    values = [r['value'] for r in records]
    if len(values) != len(set(values)):
        sys.exit('有重複的數值')
    records.sort(key=lambda r: r['value'])

    missing = sorted(set(range(values and min(values), top + 1)) - set(values)) if values else []
    if missing:
        print('提醒：缺少數值 %s' % missing)
    prev = None
    for r in records:
        if r['date']:
            if prev and r['date'] < prev[1]:
                print('提醒：日期順序不一致：%d (%s) 早於 %d (%s)' % (r['value'], r['date'], prev[0], prev[1]))
            prev = (r['value'], r['date'])
    undated = sum(1 for r in records if r['date'] is None)

    lines = [json.dumps(r, ensure_ascii=False) for r in records]
    with io.open(args.dst, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n  "name": %s,\n  "type": "%s",\n  "records": [\n    ' % (json.dumps(name, ensure_ascii=False), args.type))
        f.write(',\n    '.join(lines))
        f.write('\n  ]\n}\n')
    print('wrote %d records (%d without date) -> %s' % (len(records), undated, args.dst))

    # 更新目錄：同名取代，新的接在後面
    index_path = os.path.join(os.path.dirname(args.dst), 'index.json')
    index = []
    if os.path.exists(index_path):
        with io.open(index_path, encoding='utf-8') as f:
            index = json.load(f)
    entry = {'name': name, 'file': os.path.basename(args.dst)}
    for i, e in enumerate(index):
        if e['name'] == name:
            index[i] = entry
            break
    else:
        index.append(entry)
    with io.open(index_path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
