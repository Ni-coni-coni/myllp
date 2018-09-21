class SpdLine {
    constructor(tmg, pos, spdRatio) {
        this.tmg = tmg;
        this.pos = pos;
        this.spdRatio = spdRatio;
    }
}

class Note {
    constructor(tmg, pos, noteType) {
        this.tmg = tmg;
        this.pos = pos; // pos的单位为一个起点到终点
        this.noteType = noteType; // 0:tap 1:slide 2:flick 3:tap-hold 4:slide-hold
        this.posRank = null;
        this.multiMark = false;
        this.isExist = true;
    }

    setMulti() {
        this.multiMark = true;
    }

    setPosRank(rank) {
        this.posRank = rank;
    }

    destroy() {
        this.isExist = false;
    }

}

class holdNote extends Note {
    constructor(tmg, pos, noteType, tailTmg, tailPos) {
        super(tmg, pos, noteType);
        this.tailTmg = tailTmg;
        this.tailPos = tailPos;
        this.isOnHold = false;
    }

    switchOnHold() {
        this.isOnHold = true;
    }

    switchOffHold() {
        this.isOnHold = false;
    }

}

class Lane {
    constructor(laneData, usrHS, spdLines, offset) {
        this.notesInTmgOrd = [];
        this.indicesForTS = []; // 存放能被TouchStart判定的note的索引列表
        this.indicesForTM = []; // 存放能被TouchMove判定的note的索引列表
        this.indicesInPosOrd = []; // position从小到大所对应的note索引

        this.frontPtrOfIPO = null;
        this.backPtrOfIPO = null;
        this.judgePtrOfITS = 0;
        this.judgePtrOfITM = 0;

        this._initNotesAndIndices(laneData, usrHS, spdLines, offset);
        this._initFrontBackPtrs()
    }

    _initNotesAndIndices(laneData, usrHS, spdLines, offset) {
        let noteIdx = 0;
        for (let i = 0; i < laneData.length; i++) {
            let noteData = laneData[i];
            let noteTmg = noteData[0] + offset;
            if (noteTmg < 0) {
                console.error("offset is minus too much!");
            }
            //console.log(noteTmg);
            let notePos = _searchPos(noteTmg, usrHS, 0, spdLines.length - 1, spdLines);
            //console.log(notePos);
            let noteType = noteData[1]; // 0:tap 1:slide 2:flick 3:tap-hold 4:slide-hold
            if (noteType <= 2) {
                this.notesInTmgOrd.push(new Note(noteTmg, notePos, noteType));
            } else {
                let holdTailData = laneData[++i];
                let holdTailTmg = holdTailData[0];
                let holdTailPos = _searchPos(holdTailTmg, usrHS, 0, spdLines.length - 1, spdLines);
                this.notesInTmgOrd.push(new Note(noteTmg, notePos, noteType, holdTailTmg, holdTailPos));
            }
            if (noteType == 0 || noteType == 3) {
                this.indicesForTS.push(noteIdx);
            } else if (noteType == 1 || noteType == 4) {
                this.indicesForTS.push(noteIdx);
                this.indicesForTM.push(noteIdx);
            }
            this.indicesInPosOrd.push(noteIdx); //先放入，在下面排序
            noteIdx++;
        }
        // 排序indicesInPosOrd
        this.indicesInPosOrd.sort(
            (indexA, indexB) => this.notesInTmgOrd[indexA].pos - this.notesInTmgOrd[indexB].pos);
        // 将position rank添加到notesInTmgOrd中每个note的属性里
        for (let i = 0; i < this.indicesInPosOrd.length; i++) {
            this.notesInTmgOrd[this.indicesInPosOrd[i]].setPosRank(i);
        }
    }

    _initFrontBackPtrs() {
        let frontPtr = 0;
        let backPtr = 0;
        for (let idx of this.indicesInPosOrd) {
            if (this.notesInTmgOrd[idx].pos < -1) {
                frontPtr ++; backPtr ++;
            }
            else if (this.notesInTmgOrd[idx].pos < 1) {
                frontPtr ++;
            }
            else break;
        }
        this.frontPtrOfIPO = frontPtr;
        this.backPtrOfIPO = backPtr;
    }

}

class Group {
    constructor(groupData, usrHS, offset) {
        this.spdLines = [];
        this.lanes = [];

        this.currPos = 0;
        this.status = null; // forward:1 backward:-1 stop:0

        this._initSpdLines(groupData["spdLinesData"], usrHS, offset);
        this._initLanes(groupData["lanesData"], usrHS, offset);
    }

    _getPos(timing, usrHS) {
        return _searchPos(timing, usrHS, 0, this.spdLines.length, this.spdLines);
    }
    
    _initSpdLines(spdLinesData, usrHS, offset) {
        let tmg = 0;
        let pos = 0;
        let spdRatio = spdLinesData[0][1];
        this.spdLines.push(new SpdLine(tmg, pos, spdRatio));
        for (let i = 1; i < spdLinesData.length; i++) {
            pos += usrHS * spdRatio * (spdLinesData[i][0] + offset - tmg);
            tmg = spdLinesData[i][0] + offset;
            spdRatio = spdLinesData[i][1];
            if (tmg < 0) {
                console.error("offset is minus too much!");
            }
            this.spdLines.push(new SpdLine(tmg, pos, spdRatio));
        }
    }

    _initLanes(lanesData, usrHS, offset) {
        if (this.spdLines.length > 0) {
            for (let laneData of lanesData) {
                this.lanes.push(new Lane(laneData, usrHS, this.spdLines, offset));
            }
        } else {
            console.error("spdLines has not been initialized yet");
        }
    }

}

class Beatmap {
    constructor(usrHS, offset) {
        this.HS = usrHS * 0.001;
        this.offset = offset;
        this.groups = [];
    }

    init(beatmapData) {
        for (let groupData of beatmapData["groupsData"]) {
            this.groups.push(new Group(groupData, this.HS, this.offset));
        }
    }

    setMultiMarks() {
        if (this.groups.length > 0) {
            let allNotes = [];
            for (let group of this.groups) {
                for (let lane of group.lanes) {
                    for (let note of lane.notesInTmgOrd) {
                        allNotes.push(note);
                    }
                }
            }
            allNotes.sort((note1, note2) => note1.tmg - note2.tmg);
            for (let i = 0; i < allNotes.length-1; i++) {
                if (allNotes[i].tmg == allNotes[i+1].tmg) {
                    allNotes[i].setMulti();
                    allNotes[i+1].setMulti();
                }
            }
        } else {
            console.error("spdLines has not been initialized yet");
        }
    }

    updatePos(gameTmg) {
        let eps = 1e-7;
        for (let group of this.groups) {
            let pos = group._getPos(gameTmg, this.HS);
            if (pos > group.currPos + eps) {
                for (let lane of group.lanes) {
                    for (let i = lane.frontPtrOfIPO; i < lane.indicesInPosOrd.length; i++) {
                        let notePos = lane.notesInTmgOrd[i].pos;
                        if (notePos < pos + 1) {
                            lane.frontPtrOfIPO ++;
                        } else break;
                    }
                    for (let i = lane.backPtrOfIPO; i < lane.indicesInPosOrd.length; i++) {
                        let notePos = lane.notesInTmgOrd[i].tailPos || lane.notesInTmgOrd[i].pos; //hold需要用条尾的pos
                        if (notePos < pos - 1) {
                            lane.backPtrOfIPO ++;
                        } else break;
                    }
                }
            } else if (pos < group.currPos - eps) {
                for (let lane of group.lanes) {
                    for (let i = lane.frontPtrOfIPO - 1; i >= 0; i--) {
                        let notePos = lane.notesInTmgOrd[i].pos;
                        if (notePos < pos + 1) {
                            lane.frontPtrOfIPO --;
                        } else break;
                    }
                    for (let i = lane.backPtrOfIPO - 1; i >= 0; i--) {
                        let notePos = lane.notesInTmgOrd[i].tailPos || lane.notesInTmgOrd[i].pos; //hold需要用条尾的pos
                        if (notePos < pos - 1) {
                            lane.backPtrOfIPO --;
                        } else break;
                    }
                }
            }
            group.currPos = pos;
        }
    }

}

function _searchPos(timing, usrHS, left, right, spdLines) {
    if (timing >= spdLines[spdLines.length-1].tmg) {
        return usrHS * (timing - spdLines[spdLines.length-1].tmg) * spdLines[spdLines.length-1].spdRatio +
            spdLines[spdLines.length-1].pos;
    }
    if (left == right) {
        return usrHS * (timing - spdLines[left].tmg) * spdLines[left].spdRatio + spdLines[left].pos;
    }
    let mid = Math.ceil((left + right) / 2);
    if (timing < spdLines[mid].tmg) {
        return _searchPos(timing, usrHS, left, mid-1, spdLines);
    }
    else {
        return _searchPos(timing, usrHS, mid, right, spdLines);
    }
}

















