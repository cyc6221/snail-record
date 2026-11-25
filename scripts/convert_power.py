"""把 raw/綜合實力.csv（編號<TAB>日期）轉成 data/power.json。

編號就是綜合實力，單位 M（999 = 999M，1001 = 1.001B）。
用法：python -I scripts/convert_power.py raw/綜合實力.csv data/power.json
"""
import io
import json
import re
import sys

DATE_RE = re.compile(r'(\d{4})年(\d{1,2})月(\d{1,2})日')


def main(src, dst):
    records = []
    with io.open(src, encoding='utf-8-sig') as f:
        for line in f.read().splitlines():
            parts = line.split('\t')
            if not re.fullmatch(r'\d+', parts[0].strip()):
                continue  # 標題列、空列
            power = int(parts[0])
            raw_date = parts[1].strip() if len(parts) > 1 else ''
            m = DATE_RE.fullmatch(raw_date)
            if raw_date and not m:
                sys.exit('無法解析日期：%r（編號 %d）' % (raw_date, power))
            date = '%04d-%02d-%02d' % tuple(map(int, m.groups())) if m else None
            records.append({'power': power, 'date': date})

    # 最高的「有日期」紀錄之上，還沒填日期的是預留（尚未達成），略過
    top = max((r['power'] for r in records if r['date']), default=0)
    skipped = [r['power'] for r in records if r['date'] is None and r['power'] > top]
    records = [r for r in records if r['power'] <= top]
    if skipped:
        print('略過尚未達成的預留列：%s' % sorted(skipped))

    powers = [r['power'] for r in records]
    if len(powers) != len(set(powers)):
        sys.exit('有重複的編號')
    records.sort(key=lambda r: r['power'])

    lines = [json.dumps(r, ensure_ascii=False) for r in records]
    with io.open(dst, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n  "name": "綜合實力",\n  "unit": "M",\n  "records": [\n    ')
        f.write(',\n    '.join(lines))
        f.write('\n  ]\n}\n')
    blank = sum(1 for r in records if r['date'] is None)
    print('wrote %d records (%d without date) -> %s' % (len(records), blank, dst))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
