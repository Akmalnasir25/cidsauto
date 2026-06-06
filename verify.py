import json
d = json.load(open('data/rpt-data.json', 'r', encoding='utf-8'))
for k in ['pj4','pj5','pj6','mat6','rbt5','rbt6']:
    data = d.get(k, {})
    has_w8 = '8' in data
    w8 = data.get('8', {})
    if has_w8:
        print(f'{k}: HAS Minggu 8')
        print(f'  bidang: {w8.get("bidang","")[:50]}')
        print(f'  tajuk: {w8.get("tajuk","")[:50]}')
        print(f'  sk: {w8.get("standard_kandungan","")[:60]}')
    else:
        print(f'{k}: NO Minggu 8')
