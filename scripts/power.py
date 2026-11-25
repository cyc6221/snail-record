"""綜合實力（單位 M：999 = 999M，1001 = 1.001B）。

用法：python scripts/power.py
讀 raw/綜合實力.csv，寫 data/power.json，並更新 data/index.json。
raw 每列「數值<TAB>日期」，日期如 2026年11月22日；
最高的「有日期」紀錄之上、還沒填日期的列視為預留（尚未達成），會略過。
"""
import io
import json
import os
import re
import sys

NAME = '綜合實力'
TYPE = 'power'
OUT = 'power.json'

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'raw', NAME + '.csv')
DST = os.path.join(ROOT, 'data', OUT)
INDEX = os.path.join(ROOT, 'data', 'index.json')
DATE_RE = re.compile(r'(\d{4})年(\d{1,2})月(\d{1,2})日')


def parse():
    records = []
    with io.open(SRC, encoding='utf-8-sig') as f:
        for line in f.read().splitlines():
            parts = line.split('\t')
            if not re.fullmatch(r'\d+', parts[0].strip()):
                continue  # 標題列、空列
            value = int(parts[0])
            raw_date = parts[1].strip() if len(parts) > 1 else ''
            m = DATE_RE.fullmatch(raw_date)
            if raw_date and not m:
                sys.exit('無法解析日期 %r（數值 %d）' % (raw_date, value))
            date = '%04d-%02d-%02d' % tuple(map(int, m.groups())) if m else None
            records.append({'value': value, 'date': date})
    return records


def main():
    print(NAME)
    if not os.path.exists(SRC):
        sys.exit('找不到 %s' % SRC)
    records = parse()

    top = max((r['value'] for r in records if r['date']), default=0)
    skipped = sorted(r['value'] for r in records if r['date'] is None and r['value'] > top)
    records = [r for r in records if r['value'] <= top]
    if skipped:
        print('  略過尚未達成的預留列：%s' % skipped)

    values = [r['value'] for r in records]
    if len(values) != len(set(values)):
        sys.exit('有重複的數值')
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
    with io.open(DST, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n  "name": %s,\n  "type": "%s",\n  "records": [\n    '
                % (json.dumps(NAME, ensure_ascii=False), TYPE))
        f.write(',\n    '.join(lines))
        f.write('\n  ]\n}\n')
    print('  %d 筆 -> data/%s' % (len(records), OUT))

    # 更新目錄：同名取代，新的接在最後面（順序就是網站導航的順序）
    index = []
    if os.path.exists(INDEX):
        with io.open(INDEX, encoding='utf-8') as f:
            index = json.load(f)
    entry = {'name': NAME, 'file': OUT}
    for i, e in enumerate(index):
        if e['name'] == NAME:
            index[i] = entry
            break
    else:
        index.append(entry)
    with io.open(INDEX, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
