class Beatmap {
    constructor(usrHS, offset) {
        this.HS = usrHS * 0.001;
        this.offset = offset;
        this.spdGroups = [];
        this.lanes = [];
        this.duration = null;
        this.scoreBoard = null;
    }

    init(beatmapData) {
        this._initSpdGroups(beatmapData["spdLinesData"]);
        this._initLanes(beatmapData["lanesData"]);
        this.duration = this._getDuration();
        this.scoreBoard = new ScoreBoard(this);
    }

    _initSpdGroups(spdLinesData) {
        this.spdGroups = [new SpdGroup(spdLinesData, this.HS, this.offset)]; // TODO 以后扩展
    }

    _initLanes(lanesData) {
        if (this.spdGroups.length > 0) {
            for (let laneData of lanesData) {
                this.lanes.push(new Lane(laneData, this.HS, this.spdGroups, this.offset));
            }
        } else {
            console.error("spdGroups has not been initialized yet");
        }
    }

    _getDuration() {
        let duration = this.offset > 0 ? this.offset : 0;
        for (let lane of this.lanes) {
            let length = lane.notesInTmgOrd.length;
            if (length == 0) continue;
            let lastNote = lane.notesInTmgOrd[length-1];
            let laneDuration = lastNote.tailTmg || lastNote.tmg;
            if (laneDuration > duration) duration = laneDuration;
        }
        return duration;
    }

    setMultiMarks() {
        if (this.spdGroups.length > 0) {
            let allNotes = [];
            for (let lane of this.lanes) {
                for (let note of lane.notesInTmgOrd) {
                    allNotes.push(note);
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
            console.error("spdGroups has not been initialized yet");
        }
    }

    calcPos(tmg, groupIdx) {
        return _searchPos(tmg, this.HS,
            0, this.spdGroups[groupIdx].spdLines.length - 1,
            this.spdGroups[groupIdx].spdLines);
    }

    getCurrPos(groupIdx) {
        return this.spdGroups[groupIdx].currPos;
    }

    updatePos(gameTmg) {
        let eps = 1e-7;
        let idx, notePos;
        for (let groupIdx in this.spdGroups) {
            let group = this.spdGroups[groupIdx];
            let pos = this.calcPos(gameTmg, groupIdx);
            if (pos > group.currPos + eps) {
                for (let lane of this.lanes) {
                    for (let ptr = lane.frontPtrOfIPO; ptr < lane.indicesInPosOrd.length; ptr++) {
                        idx = lane.indicesInPosOrd[ptr];
                        notePos = lane.notesInTmgOrd[idx].pos;
                        if (notePos < pos + 1) {
                            lane.frontPtrOfIPO ++;
                        } else break;
                    }
                    for (let ptr = lane.backPtrOfIPO; ptr < lane.indicesInPosOrd.length; ptr++) {
                        idx = lane.indicesInPosOrd[ptr];
                        notePos = lane.notesInTmgOrd[idx].tailPos || lane.notesInTmgOrd[idx].pos; //hold需要用条尾的pos
                        if (notePos < pos - 1) {
                            lane.backPtrOfIPO ++;
                        } else break;
                    }
                }
            } else if (pos < group.currPos - eps) {
                for (let lane of this.lanes) {
                    for (let ptr = lane.frontPtrOfIPO - 1; ptr >= 0; ptr--) {
                        idx = lane.indicesInPosOrd[ptr];
                        notePos = lane.notesInTmgOrd[idx].pos;
                        if (notePos > pos + 1) {
                            lane.frontPtrOfIPO --;
                        } else break;
                    }
                    for (let ptr = lane.backPtrOfIPO - 1; ptr >= 0; ptr--) {
                        idx = lane.indicesInPosOrd[ptr];
                        notePos = lane.notesInTmgOrd[idx].tailPos || lane.notesInTmgOrd[idx].pos; //hold需要用条尾的pos
                        if (notePos > pos - 1) {
                            lane.backPtrOfIPO --;
                        } else break;
                    }
                }
            }
            group.currPos = pos;
        }
    }

    updateJdgPtrs(gameTmg, outRange) {
        for (let lane of this.lanes) {
            // 销毁出good范围的note，条头出范围也能判断下个note
            if (lane.jdgPtrOfITS < lane.indicesForTS.length) {
                let noteToJdgForTS = lane.notesInTmgOrd[lane.indicesForTS[lane.jdgPtrOfITS]];
                if (gameTmg - noteToJdgForTS.tmg > outRange) {
                    noteToJdgForTS.setPassed(this.scoreBoard);
                }
            }
            if (lane.jdgPtrOfITM < lane.indicesForTM.length) {
                let noteToJdgForTM = lane.notesInTmgOrd[lane.indicesForTM[lane.jdgPtrOfITM]];
                if (gameTmg - noteToJdgForTM.tmg > outRange) {
                    noteToJdgForTM.setPassed(this.scoreBoard);
                }
            }
            // 调整judge pointer
            while (lane.jdgPtrOfITS < lane.indicesForTS.length) {
                let noteToJdgForTS = lane.notesInTmgOrd[lane.indicesForTS[lane.jdgPtrOfITS]];
                if (!noteToJdgForTS.isComing()) lane.jdgPtrOfITS ++;
                else break;
            }
            while (lane.jdgPtrOfITM < lane.indicesForTM.length) {
                let noteToJdgForTM = lane.notesInTmgOrd[lane.indicesForTM[lane.jdgPtrOfITM]];
                if (!noteToJdgForTM.isComing()) lane.jdgPtrOfITM ++;
                else break;
            }
        }
    }
}

class Lane {
    constructor(laneData, HS, spdGroups, offset) {
        this.notesInTmgOrd = [];
        this.indicesForTS = []; // 存放能被TouchStart判定的note的索引列表
        this.indicesForTM = []; // 存放能被TouchMove判定的note的索引列表
        this.indicesInPosOrd = []; // position从小到大所对应的note索引

        this.frontPtrOfIPO = null;
        this.backPtrOfIPO = null;
        this.jdgPtrOfITS = 0;
        this.jdgPtrOfITM = 0;
        this.holdNoteIdx = -1;
        this.slideStat = 1;

        this._initNotesAndIndices(laneData, HS, spdGroups, offset);
        this._initFrontBackPtrs()
    }

    _initNotesAndIndices(laneData, HS, spdGroups, offset) {
        let noteIdx = 0;
        for (let i = 0; i < laneData.length; i++) {
            let noteData = laneData[i];
            let noteTmg = noteData[0] + offset;
            if (noteTmg < 0) {
                console.error("offset is minus too much!");
            }
            //console.log(noteTmg);
            let noteGroup = 0; // TODO 以后扩展
            let notePos = _searchPos(noteTmg, HS,
                0, spdGroups[noteGroup].spdLines.length - 1,
                spdGroups[noteGroup].spdLines);
            //console.log(notePos);
            let noteType = noteData[1]; // 0:tap 1:slide 2:flick 3:tap-hold 4:slide-hold
            if (noteType <= 2) {
                this.notesInTmgOrd.push(new Note(noteTmg, notePos, noteType, noteGroup));
            } else {
                let holdTailData = laneData[++i];
                let holdTailTmg = holdTailData[0];
                let holdTailPos = _searchPos(holdTailTmg, HS,
                    0, spdGroups[noteGroup].spdLines.length - 1,
                    spdGroups[noteGroup].spdLines);
                this.notesInTmgOrd.push(new HoldNote(noteTmg, notePos, noteType, noteGroup, holdTailTmg, holdTailPos));
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
        // for (let i = 0; i < this.indicesInPosOrd.length; i++) {
        //    this.notesInTmgOrd[this.indicesInPosOrd[i]].setPosRank(i);
        // }
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

    setHoldNote(noteIdx) {
        this.holdNoteIdx = noteIdx;
    }

    getHoldNote() {
        if (this.holdNoteIdx == -1) {
            console.error("no hold note!");
            return false;
        }
        else {
            return this.notesInTmgOrd[this.holdNoteIdx];
        }
    }

    checkOnHold() {
        return this.holdNoteIdx != -1
    }

    freeHoldNote() {
        this.holdNoteIdx = -1;
    }

    slideJudgeOn() {
        this.slideStat = 1;
    }

    slideJudgeOff() {
        this.slideStat = 0;
    }

    checkSlideJudgeOn() {
        return this.slideStat == 1;
    }

}

class Note {
    constructor(tmg, pos, type, group) {
        this.tmg = tmg;
        this.pos = pos; // pos的单位为起点到判定点的距离
        this.type = type; // 0:tap 1:slide 2:flick 3:tap-hold 4:slide-hold
        this.group = group;
        this.multiMark = false;
        this.isHold = type > 2;

        this.state = 0;
    }

    setMulti() {
        this.multiMark = true;
    }

    setJudging() {
        this.state = 1;
    }

    setPassed(scoreBoard) {
        if (this.isNotExist()) {
            scoreBoard.update(0);
            if (this.isHold) scoreBoard.update(0);
        }
        this.state = 2;
    }

    setDestroyed() {
        this.state = 2;
    }

    isComing() {
        return this.state == 0;
    }

    isJudging() {
        return this.state == 1;
    }

    isNotExist() {
        return this.state == 2;
    }

}

class HoldNote extends Note {
    constructor(tmg, pos, noteType, group, tailTmg, tailPos) {
        super(tmg, pos, noteType, group);
        this.tailTmg = tailTmg;
        this.tailPos = tailPos;
        this.isOnHold = false;
    }

}

class SpdLine {
    constructor(tmg, pos, spdRatio) {
        this.tmg = tmg;
        this.pos = pos;
        this.spdRatio = spdRatio;
    }
}

class SpdGroup {
    constructor(spdLinesData, HS, offset) {
        this.spdLines = [];

        this.currPos = 0;
        // this.status = null; // forward:1 backward:-1 stop:0
        this._initSpdLines(spdLinesData, HS, offset);
    }

    _initSpdLines(spdLinesData, HS, offset) {
        let tmg = 0;
        let pos = 0;
        let spdRatio = spdLinesData[0][1];
        this.spdLines.push(new SpdLine(tmg, pos, spdRatio));
        for (let i = 1; i < spdLinesData.length; i++) {
            pos += HS * spdRatio * (spdLinesData[i][0] + offset - tmg);
            tmg = spdLinesData[i][0] + offset;
            spdRatio = spdLinesData[i][1];
            if (tmg < 0) {
                console.error("offset is minus too much!");
            }
            this.spdLines.push(new SpdLine(tmg, pos, spdRatio));
        }
    }
}

function _searchPos(timing, HS, left, right, spdLines) {
    if (timing >= spdLines[spdLines.length-1].tmg) {
        return HS * (timing - spdLines[spdLines.length-1].tmg) * spdLines[spdLines.length-1].spdRatio +
            spdLines[spdLines.length-1].pos;
    }
    if (left == right) {
        return HS * (timing - spdLines[left].tmg) * spdLines[left].spdRatio + spdLines[left].pos;
    }
    let mid = Math.ceil((left + right) / 2);
    if (timing < spdLines[mid].tmg) {
        return _searchPos(timing, HS, left, mid-1, spdLines);
    }
    else {
        return _searchPos(timing, HS, mid, right, spdLines);
    }
}


class ScoreBoard {
    constructor (beatmap, perfectCoeff=1.0, greatCoeff=0.8, goodCoeff=0.5) {
        this.perfectCoeff = perfectCoeff;
        this.greatCoeff = greatCoeff;
        this.goodCoeff = goodCoeff;
        this.totalUnitNum = this._getUnitNum(beatmap);
        this.totalScore = 1000000;
        this.unitScore = this.totalScore / this.totalUnitNum;

        this.scoreDiv = null;

        this.unitCount = 0;
        this.perfect = 0;
        this.great = 0;
        this.good = 0;
        this.miss = 0;
        this.score = 0;
        this.combo = 0;

    }

    setScoreDiv(gameDiv) {
        let div = document.createElement("div");
        div.style.cssText = "left:40%;top:10%;width:20%;height:3%;color:white";
        div.style.zIndex = 100;
        div.style.fontSize = "24px";
        div.style.textAlign = "center";
        div.innerText = this.score;
        this.scoreDiv = div;
        gameDiv.appendChild(div);
    }

    showResult(gameDiv) {
        this.scoreDiv.zIndex = -1;

        let div = document.createElement("div");
        div.style.cssText = "left:30%;top:30%;width:40%;height:40%;color:white";
        div.style.zIndex = 100;
        div.style.fontSize = "24px";
        div.style.textAlign = "center";
        div.innerText = "Score:" + Math.round(this.score) + "\n\n" +
            "Total Notes:" + this.totalUnitNum + "\n" +
            "Perfect:" + this.perfect + "\n" +
            "Great:" + this.great + "\n" +
            "Good:" + this.good + "\n" +
            "Miss:" + this.miss;
        this.scoreDiv = div;
        gameDiv.appendChild(div);
    }


    _getUnitNum(beatmap) {
        let unitNum = 0;
        for (let lane of beatmap.lanes) {
            for (let note of lane.notesInTmgOrd) {
                if (note.isHold) unitNum ++;
                unitNum ++;
            }
        }
        return unitNum;
    }

    update (judgement) {
        this.unitCount ++;
        switch (judgement) {
            case 3:
                this.perfect ++;
                this.combo ++;
                this.score += this.perfectCoeff * this.unitScore;
                break;
            case 2:
                this.great ++;
                this.combo ++;
                this.score += this.greatCoeff * this.unitScore;
                break;
            case 1:
                this.good ++;
                this.combo ++;
                this.score += this.goodCoeff * this.unitScore;
                break;
            case 0:
                this.miss ++;
                this.combo = 0;
                break;
            default:
                console.error("judgement error");
                break;
        }
        this.scoreDiv.innerText = Math.round(this.score);
    }

}














