import re
import json

lane_refs = {
    '16': (0, True), '56': (0, False),
    '11': (1, True), '51': (1, False),
    '12': (2, True), '52': (2, False),
    '13': (3, True), '53': (3, False),
    '14': (4, True), '54': (4, False),
    '15': (5, True), '55': (5, False),
    '18': (6, True), '58': (6, False),
    '19': (7, True), '59': (7, False),
    '21': (8, True), '61': (8, False),
}

label_refs = {
    '01': 0,  # tap
    '02': 1,  # slide
    '03': 2   # flick(not implemented)
}

long_note_label_refs = {
    '01': 3,  # tap-
    '02': 4,  # slide-
    '03': 5,  # tap-slide
    '04': 6,  # slide-slide
    '05': 7
}

# 需要自己修改
hs_label_refs = {
    '0A': 1.0,
    '0B': 2.5,
}


def read_bms(bms_filename):
    start_bpm = None
    bpm_refs = dict()
    data_list = []

    with open(bms_filename) as f:
        lines = f.readlines()
    f.close()
    for line in lines:
        if re.match('#BPM ', line):  # 初始bpm
            start_bpm = int(line.split()[1])
        if re.match('#BPM\S', line):  # 大于255的bpm数值参照
            args = line.split()
            bpm_refs[args[0][4:]] = int(args[1])
        if re.search(':', line):  # 主要数据（note，bpm及speed line）
            args = line.split(':')
            # 解析主要数据：小节，通道，小节内16进制数据（如：1，）
            # 比如：1，“03”，“0000008C”（第1小节第4拍开头bpm变为140）
            # 又如：2，“12”，“0001”（第1小节第3拍开头有一个标签为01的note）
            data_list.append((int(args[0][1:4]), args[0][4:], args[1][:-1]))

    return start_bpm, bpm_refs, data_list


def get_length(data_list):
    return data_list[-1][0] + 1


def separate_bpm_hs(data_list):
    # 从主要数据中分离bpm和speed line数据（实际上创建3个新list）
    bpm_list = []
    note_list = []
    hs_list = []
    for idx, (measure, column, data) in enumerate(data_list):
        # 03表示255及以下（直接），08表示256及以上（间接）
        if column == '03':
            bpm_list.append((measure, True, data))
        elif column == '08':
            bpm_list.append((measure, False, data))
        elif column == '01':  # B1（01）为hs通道
            hs_list.append((measure, data))
        else:
            try:
                lane, is_not_long = lane_refs[column]
                note_list.append((measure, lane, is_not_long, data))
            except KeyError:
                print('note label error!')

    return bpm_list, hs_list, note_list


def get_pos_bpm_measures(bpm_list, start_bpm, bpm_refs, length):
    # 获得谱面所有小节的bpm变化位置及bpm数值，1个小节是1个list，每个list里有至少1个tuple，如[(0.0,120),(0.5,140)]
    pos_bpm_measures = []
    measure_start_bpm = start_bpm
    prev_measure = -1
    for idx, measure_data in enumerate(bpm_list):
        pos_bpm_list = parse_bpm_measure(measure_data, bpm_refs)
        measure = measure_data[0]
        if idx > 0 and measure == prev_measure:  # 说明与前一measure数相同，此measure用间接bpm标签
            pos_bpm_measures[-1].extend(pos_bpm_list).sort()
        if measure == prev_measure + 1:
            if pos_bpm_list[0][0] > 0:  # 小节开始处无bpm线，手动添加上一小节最后的bpm线
                pos_bpm_measures.append([(0.0, measure_start_bpm)])
                pos_bpm_measures[-1].extend(pos_bpm_list)
            else:
                pos_bpm_measures.append(pos_bpm_list)
        if measure > prev_measure + 1:  # 说明跳过了至少一小节
            for count in range(measure - prev_measure - 1):
                pos_bpm_measures.append([(0.0, measure_start_bpm)])  # 把跳过的小节补上
            if pos_bpm_list[0][0] > 0:  # 小节开始处无bpm线，手动添加上一小节最后的bpm线
                pos_bpm_measures.append([(0.0, measure_start_bpm)])
                pos_bpm_measures[-1].extend(pos_bpm_list)
            else:
                pos_bpm_measures.append(pos_bpm_list)
        prev_measure = measure
        measure_start_bpm = pos_bpm_list[-1][1]
    if len(pos_bpm_measures) < length:
        for count in range(length - len(pos_bpm_measures)):
            pos_bpm_measures.append([(0.0, measure_start_bpm)])
    return pos_bpm_measures


def get_measure_start_timings(pos_bpm_measures):
    # 获得每小节开始的timing（一个装有全部小节开始timing的list）
    measure_start_timings = [0.0]
    measure_end_timing = 0.0
    for pos_bpm_measure in pos_bpm_measures[:-1]:
        measure_elapse = calc_timing_in_measure(1.0, pos_bpm_measure)
        measure_end_timing += measure_elapse
        measure_start_timings.append(measure_end_timing)
    return measure_start_timings


def get_spdline_list(hs_list, pos_bpm_measures, measure_start_timings):
    # 获得所有lane的hs信息（直接用于输出json，注意tuple自动转成数组）
    spdline_list = []
    for measure_data in hs_list:
        measure, data = measure_data
        measure_start_timing = measure_start_timings[measure]
        hs_pos_list = parse_hs_measure(measure_data)
        for hs_pos, hs in hs_pos_list:
            hs_change_timing_in_measure = calc_timing_in_measure(hs_pos, pos_bpm_measures[measure])
            hs_change_timing = measure_start_timing + hs_change_timing_in_measure
            spdline_list.append((hs_change_timing, hs))
    return spdline_list


def get_timing_note_lists(note_list, pos_bpm_measures, measure_start_timings):
    # 获得所有lane的note信息（直接用于输出json，注意tuple自动转成数组）
    timing_note_lists = [[] for _ in range(9)]
    for measure_data in note_list:
        measure, lane, not_long, data = measure_data
        measure_start_timing = measure_start_timings[measure]
        note_pos_list = parse_note_measure(measure_data)
        for note_pos, note_type in note_pos_list:
            note_timing_in_measure = calc_timing_in_measure(note_pos, pos_bpm_measures[measure])
            note_timing = measure_start_timing + note_timing_in_measure
            timing_note_lists[lane].append((note_timing, note_type))
    return timing_note_lists


def parse_bpm_measure(measure_data, bpm_refs):
    pos_bpm_list = []
    data = measure_data[-1]
    data_len = len(data)
    if measure_data[1]:
        for index in range(0, data_len, 2):
            label = data[index:index+2]
            if label != '00':
                pos_bpm_list.append((index / data_len, int(label, 16)))
    else:
        for index in range(0, data_len, 2):
            label = data[index:index+2]
            if label != '00':
                pos_bpm_list.append((index / data_len, bpm_refs[label]))
    return pos_bpm_list


def parse_hs_measure(measure_data):
    pos_hs_list = []
    data = measure_data[-1]
    data_len = len(data)
    for index in range(0, data_len, 2):
        label = data[index:index+2]
        if label != '00':
            try:
                pos_hs_list.append((index / data_len, hs_label_refs[label]))
            except KeyError:
                print('hs label error!')
    return pos_hs_list


def parse_note_measure(measure_data):
    pos_note_list = []
    data = measure_data[-1]
    data_len = len(data)
    not_long = measure_data[2]
    for index in range(0, data_len, 2):
        label = data[index:index+2]
        if label != '00':
            try:
                pos_note_list.append((index / data_len,
                                      label_refs[label] if not_long else
                                      long_note_label_refs[label]))
            except KeyError:
                print('note label error!')
    return pos_note_list


def calc_timing_in_measure(my_pos, pos_bpm_measure):
    my_timing = 0.0
    prev_pos, prev_bpm = pos_bpm_measure[0]
    pos_bpm_measure_with_tail = pos_bpm_measure + [(1.0, None)]
    for pos, bpm in pos_bpm_measure_with_tail[1:]:
        if my_pos > pos:
            my_timing += (pos - prev_pos) * 240000 / prev_bpm  # 增加的毫秒数 = 增加的小节数（是小数）× 每小节毫秒数
        else:
            my_timing += (my_pos - prev_pos) * 240000 / prev_bpm
            break
        prev_pos = pos
        prev_bpm = bpm
    return my_timing


def sort_timing_note_lists(timing_note_lists):
    for timing_note_list in timing_note_lists:
        timing_note_list.sort(key=lambda note: note[0])


def generate_json_with_speed_line(timing_note_lists, spdline_list, json_filename):
    data = json.dumps(timing_note_lists)
    spdline_data = json.dumps(spdline_list)
    whole_json_data = '{"spdLinesData":' + spdline_data + ',"lanesData":' + data + '}'
    print(whole_json_data)
    with open(json_filename, mode='w+') as f:
        f.write(whole_json_data)
    f.close()


def convert(bms_filename, json_filename):
    start_bpm, bpm_refs, data_list = read_bms(bms_filename)
    print('bpm_refs:\n', bpm_refs)
    print('data_list:\n', data_list)
    bpm_list, hs_list, note_list = separate_bpm_hs(data_list)
    print('bpm_list:\n', bpm_list)
    print('hs_list:\n', hs_list)
    print('note_list:\n', note_list)
    length = get_length(data_list)
    print('length:\n', length)
    pos_bpm_measures = get_pos_bpm_measures(bpm_list, start_bpm, bpm_refs, length)
    print('pos_bpm_measures:\n', pos_bpm_measures)
    measure_start_timings = get_measure_start_timings(pos_bpm_measures)
    print('measure_start_timings:\n', measure_start_timings)
    spdline_list = get_spdline_list(hs_list, pos_bpm_measures, measure_start_timings)
    print('spdline_list:\n', spdline_list)
    timing_note_lists = get_timing_note_lists(note_list, pos_bpm_measures, measure_start_timings)
    print('timing_note_lists:\n', timing_note_lists)
    sort_timing_note_lists(timing_note_lists)
    print()
    generate_json_with_speed_line(timing_note_lists, spdline_list, json_filename)


if __name__ == '__main__':
    import sys
    print(sys.argv)
    for arg in sys.argv[1:]:
        file = arg
        bms_file = 'C:/Users/Ushio/Desktop/ibmsc/Data/' + file + '.bms'
        json_file = 'C:/Users/Ushio/WebstormProjects/myllp/converter_bms2json/json/' + file + '.json'
        convert(bms_file, json_file)



