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
    '21': (8, True), '61': (8, False)
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


def read_bms(bms_filename):
    start_bpm = None
    bpm_refs = dict()
    data_list = []

    with open(bms_filename) as f:
        lines = f.readlines()
    f.close()
    for line in lines:
        if re.match('#BPM ', line):
            start_bpm = int(line.split()[1])
        if re.match('#BPM\S', line):
            args = line.split()
            bpm_refs[args[0][4:]] = int(args[1])
        if re.search(':', line):
            args = line.split(':')
            data_list.append((int(args[0][1:4]), args[0][4:], args[1][:-1]))

    return start_bpm, bpm_refs, data_list


def get_length(data_list):
    return data_list[-1][0] + 1


def separate_bpm(data_list):
    bpm_list = []
    notes_list = []
    for idx, (measure, column, data) in enumerate(data_list):
        if column == '03':
            bpm_list.append((measure, True, data))
        elif column == '08':
            bpm_list.append((measure, False, data))
        else:
            lane, is_not_long = lane_refs[column]
            try:
                notes_list.append((measure, lane, is_not_long, data))
            except KeyError:
                print('note out of range!')

    return bpm_list, notes_list


def get_pos_bpm_measures(bpm_list, start_bpm, bpm_refs, length):
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
    measure_start_timings = [0.0]
    measure_end_timing = 0.0
    for pos_bpm_measure in pos_bpm_measures[:-1]:
        measure_elapse = calc_timing_in_measure(1.0, pos_bpm_measure)
        measure_end_timing += measure_elapse
        measure_start_timings.append(measure_end_timing)
    return measure_start_timings


def get_timing_note_lists(notes_lists, pos_bpm_measures, measure_start_timings,
                          label_refs, long_note_label_refs):
    timing_note_lists = [[] for _ in range(9)]
    for measure_data in notes_lists:
        measure, lane, not_long, data = measure_data
        measure_start_timing = measure_start_timings[measure]
        note_pos_list = parse_note_measure(measure_data, label_refs, long_note_label_refs)
        for note_pos, note_type in note_pos_list:
            note_timing_in_measure = calc_timing_in_measure(note_pos, pos_bpm_measures[measure])
            note_timing = measure_start_timing + note_timing_in_measure
            timing_note_lists[lane].append((note_timing, note_type))
    return timing_note_lists


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


def parse_note_measure(measure_data, label_refs, long_note_label_refs):
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


def sort_timing_note_lists(timing_note_lists):
    for timing_note_list in timing_note_lists:
        timing_note_list.sort(key=lambda note: note[0])


def generate_json_with_speed_line(timing_note_lists, json_filename):
    data = json.dumps(timing_note_lists)
    whole_json_data = '{"speedLines":[[0,1.3]],"notes":' + data + '}'
    print(whole_json_data)
    with open('json/' + json_filename, mode='w+') as f:
        f.write(whole_json_data)
    f.close()


def convert(bms_filename, json_filename):
    start_bpm, bpm_refs, data_list = read_bms(bms_filename)
    # print('bpm_refs:\n', bpm_refs)
    # print('data_list:\n', data_list)
    bpm_list, notes_list = separate_bpm(data_list)
    # print('bpm_list:\n', bpm_list)
    # print('notes_list:\n', notes_list)
    length = get_length(data_list)
    # print('length:\n', length)
    pos_bpm_measures = get_pos_bpm_measures(bpm_list, start_bpm, bpm_refs, length)
    # print('pos_bpm_measures:\n', pos_bpm_measures)
    # print('pos_notes_list of the data of notes_list:\n', pos_notes_list)
    measure_start_timings = get_measure_start_timings(pos_bpm_measures)
    # print('measure_start_timings:\n', measure_start_timings)
    timing_note_lists = get_timing_note_lists(notes_list, pos_bpm_measures, measure_start_timings,
                                              label_refs, long_note_label_refs)
    # print('timing_note_lists:\n', timing_note_lists)
    sort_timing_note_lists(timing_note_lists)
    print()
    generate_json_with_speed_line(timing_note_lists, json_filename)


if __name__ == '__main__':
    bms_file = 'C:/Users/Ushio/Desktop/ibmsc/Data/circle.bms'
    json_file = 'circle.json'
    convert(bms_file, json_file)



