import xml.etree.ElementTree as ET
from datetime import datetime

# trackingPath 전체를 Python 리스트로 변환
tracking_path = [
    {"latitude": 37.5299823, "longitude": 126.710553, "altitude": 57.599998474121094, "timestamp": 1752630203334},
    {"latitude": 37.5299823, "longitude": 126.710553, "altitude": 57.599998474121094, "timestamp": 1752630203396},
    {"latitude": 37.5299917, "longitude": 126.7106113, "altitude": 57.39999771118164, "timestamp": 1752630213816},
    {"latitude": 37.530031, "longitude": 126.710648, "altitude": 57.39999771118164, "timestamp": 1752630216710},
    {"latitude": 37.5300796, "longitude": 126.7106561, "altitude": 57.39999771118164, "timestamp": 1752630220032},
    {"latitude": 37.5300962, "longitude": 126.710601, "altitude": 57.39999771118164, "timestamp": 1752630226347},
    {"latitude": 37.5300917, "longitude": 126.7105442, "altitude": 57.39999771118164, "timestamp": 1752630230992},
    {"latitude": 37.5300877, "longitude": 126.7104807, "altitude": 57.39999771118164, "timestamp": 1752630235995},
    {"latitude": 37.5301086, "longitude": 126.7105425, "altitude": 57.39999771118164, "timestamp": 1752630248151},
    {"latitude": 37.5301065, "longitude": 126.710606, "altitude": 57.39999771118164, "timestamp": 1752630252381},
    {"latitude": 37.5301003, "longitude": 126.710679, "altitude": 57.39999771118164, "timestamp": 1752630255206},
    {"latitude": 37.530084, "longitude": 126.7107401, "altitude": 57.39999771118164, "timestamp": 1752630258382},
    {"latitude": 37.5300724, "longitude": 126.7108017, "altitude": 57.39999771118164, "timestamp": 1752630261988},
    {"latitude": 37.5300597, "longitude": 126.7108561, "altitude": 57.39999771118164, "timestamp": 1752630265337},
    {"latitude": 37.5300664, "longitude": 126.7109136, "altitude": 57.39999771118164, "timestamp": 1752630267839},
    {"latitude": 37.5300751, "longitude": 126.7109732, "altitude": 57.39999771118164, "timestamp": 1752630270909},
    {"latitude": 37.5300899, "longitude": 126.7110375, "altitude": 57.39999771118164, "timestamp": 1752630274313},
    {"latitude": 37.5300845, "longitude": 126.7110985, "altitude": 57.39999771118164, "timestamp": 1752630277995},
    {"latitude": 37.5300602, "longitude": 126.7111467, "altitude": 57.39999771118164, "timestamp": 1752630281487},
    {"latitude": 37.5300229, "longitude": 126.7111829, "altitude": 57.39999771118164, "timestamp": 1752630289379},
    {"latitude": 37.5299767, "longitude": 126.7111811, "altitude": 56.099998474121094, "timestamp": 1752630294815},
    {"latitude": 37.5299299, "longitude": 126.7111901, "altitude": 56.099998474121094, "timestamp": 1752630299384},
    {"latitude": 37.5298842, "longitude": 126.7111862, "altitude": 56.099998474121094, "timestamp": 1752630303402},
    {"latitude": 37.529838, "longitude": 126.7111748, "altitude": 54.89999771118164, "timestamp": 1752630307385},
    {"latitude": 37.5297955, "longitude": 126.7111547, "altitude": 54.5, "timestamp": 1752630312384},
    {"latitude": 37.5297645, "longitude": 126.7111095, "altitude": 54.89999771118164, "timestamp": 1752630321226},
    {"latitude": 37.529731, "longitude": 126.7111488, "altitude": 54.89999771118164, "timestamp": 1752630329398},
    {"latitude": 37.5296835, "longitude": 126.711161, "altitude": 54.89999771118164, "timestamp": 1752630335373},
    {"latitude": 37.5296538, "longitude": 126.7111163, "altitude": 55, "timestamp": 1752630339230},
    {"latitude": 37.5295966, "longitude": 126.7110988, "altitude": 54.89999771118164, "timestamp": 1752630342010},
    {"latitude": 37.529571, "longitude": 126.711052, "altitude": 54.89999771118164, "timestamp": 1752630345387},
    {"latitude": 37.5295664, "longitude": 126.7109956, "altitude": 55, "timestamp": 1752630356398},
    {"latitude": 37.5296129, "longitude": 126.7109686, "altitude": 54.70000076293945, "timestamp": 1752630377925},
    {"latitude": 37.5296521, "longitude": 126.7109318, "altitude": 53.20000076293945, "timestamp": 1752630381320},
    {"latitude": 37.5296789, "longitude": 126.7108635, "altitude": 54.89999771118164, "timestamp": 1752630390473},
    {"latitude": 37.5297427, "longitude": 126.7108449, "altitude": 53.20000076293945, "timestamp": 1752630393700},
    {"latitude": 37.5297909, "longitude": 126.7108369, "altitude": 53.20000076293945, "timestamp": 1752630396830},
    {"latitude": 37.5298198, "longitude": 126.7108885, "altitude": 53.20000076293945, "timestamp": 1752630399996},
    {"latitude": 37.5298506, "longitude": 126.7109504, "altitude": 53.20000076293945, "timestamp": 1752630404391},
]

def timestamp_to_iso(ts):
    return datetime.utcfromtimestamp(ts/1000).isoformat() + "Z"

gpx = ET.Element('gpx', attrib={
    'version': '1.1',
    'creator': 'RouteFinding',
    'xmlns': 'http://www.topografix.com/GPX/1/1'
})

trk = ET.SubElement(gpx, 'trk')
trkseg = ET.SubElement(trk, 'trkseg')

for p in tracking_path:
    trkpt = ET.SubElement(trkseg, 'trkpt', attrib={
        'lat': str(p['latitude']),
        'lon': str(p['longitude'])
    })
    ele = ET.SubElement(trkpt, 'ele')
    ele.text = str(p['altitude'])
    if p.get('timestamp', 0):
        time = ET.SubElement(trkpt, 'time')
        time.text = timestamp_to_iso(p['timestamp'])

tree = ET.ElementTree(gpx)
tree.write('approach.gpx', encoding='utf-8', xml_declaration=True)
print('approach.gpx 파일 생성 완료!')
