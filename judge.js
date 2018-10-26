class Judge {

    constructor() {
        this.scene = null;

        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();

        this.myDebugger = new Debugger();
        this.myDebugger.createDebugDiv();
        this.myDebugger.logMsg("Judge!!");

    }

    setSounds(perfect, great, good) {
        this.perfectSound = perfect;
        this.greatSound = great;
        this.goodSound = good;
    }

    setScene(scene) {
        this.scene = scene;
    }

    addTouchEvents() {
        this.scene.beatmapCvs.addEventListener("touchstart", this.handleTouchStart.bind(this), false);
        this.scene.beatmapCvs.addEventListener("touchend", this.handleTouchEnd.bind(this), false);
        this.scene.beatmapCvs.addEventListener("touchmove", this.handleTouchMove.bind(this), false);
    }

    handleTouchStart(e) {
        e.preventDefault();
        let touchTmg = this.scene.controller.getExactTmg();
        let oneHotActiveLanes = this._getOneHotActiveLanes(e);
        this._judgeNote(touchTmg, oneHotActiveLanes, "tap");
    }

    handleTouchEnd(e) {
        e.preventDefault();
        let touchTmg = this.scene.controller.getExactTmg();
        let oneHotLanesOnTouch = this._getOneHotLanesOnTouch(e);
        this._judgeAway(touchTmg, oneHotLanesOnTouch);
    }

    handleTouchMove(e) {
        e.preventDefault();
        let touchTmg = this.scene.controller.getExactTmg();
        let oneHotActiveLanes = this._getOneHotActiveLanes(e);
        let oneHotLanesOnTouch = this._getOneHotLanesOnTouch(e);
        this._judgeNote(touchTmg, oneHotActiveLanes, "slide");
        this._judgeAway(touchTmg, oneHotLanesOnTouch);
    }

    _getOneHotActiveLanes(e) {
        let oneHotActiveLanes = this.scene.getDefaultOneHot();
        for (let i = 0; i < e.changedTouches.length; i++) {
            let cvsX = this.scene.page2cvsX(e.changedTouches[i].pageX);
            let cvsY = this.scene.page2cvsY(e.changedTouches[i].pageY);
            this.scene.addActive(oneHotActiveLanes, cvsX, cvsY);
        }
        return oneHotActiveLanes;
    }

    _getOneHotLanesOnTouch(e) {
        let oneHotLanesOnTouch = this.scene.getDefaultOneHot();
        for (let i = 0; i < e.touches.length; i++) {
            let cvsX = this.scene.page2cvsX(e.touches[i].pageX);
            let cvsY = this.scene.page2cvsY(e.touches[i].pageY);
            this.scene.addActive(oneHotLanesOnTouch, cvsX, cvsY);
        }
        return oneHotLanesOnTouch;
    }

    _judgeNote(touchTmg, oneHotActiveLanes, jdgType) {
        for (let laneIdx in oneHotActiveLanes) {
            if (!oneHotActiveLanes[laneIdx]) continue;
            let lane = this.scene.controller.beatmap.lanes[laneIdx];
            let jdgPtr, jdgIndices;
            if (jdgType == "tap")  {
                jdgPtr = lane.jdgPtrOfITS;
                jdgIndices = lane.indicesForTS;
            }
            if (jdgType == "slide") {
                jdgPtr = lane.jdgPtrOfITM;
                jdgIndices = lane.indicesForTM;
            }
            if (jdgPtr == jdgIndices.length) continue;
            let idx = jdgIndices[jdgPtr];
            let note = lane.notesInTmgOrd[idx];
            let judgement = this._getJudgement(touchTmg, note);
            if (judgement == 0) continue;
            this._execJdgEffect(judgement);
            //this.myDebugger.logMsg(touchTmg, judgement, laneIdx, lane.jdgPtrOfITS);
            if (note.isHold) {
                note.setJudging();
                lane.setHoldNote(idx);
                let that = this;
                setTimeout(function (note, lane, that) {
                    if (note.isJudging()) {  // TODO 考虑条尾是slide的情况
                        that._execJdgEffect(3);
                        note.setPassed();
                        lane.freeHoldNote();
                    }
                }, note.tailTmg - note.tmg, note, lane, that);
            } else {
                note.setPassed();
            }
        }
    }

    _judgeAway(touchTmg, oneHotLanesOnTouch) {
        for (let laneIdx in oneHotLanesOnTouch) {
            let lane = this.scene.controller.beatmap.lanes[laneIdx];
            if (lane.checkOnHold() && !oneHotLanesOnTouch[laneIdx]) {
                let note = lane.getHoldNote();
                let judgement = this._getJudgement(touchTmg, note, true);
                this._execJdgEffect(judgement);
                note.setPassed();
                lane.freeHoldNote();
            }
        }
    }

    _getJudgement(touchTmg, note, tail=false) {
        let jdgType, deviation;
        if (!tail) {
            if (note.type == 0 || note.type == 3) {
                jdgType = "tap";
            } else if (note.type == 1 || note.type == 4) {
                jdgType = "slide";
            } else {
                console.error("not implemented yet!")
            }
            deviation = Math.abs(touchTmg - note.tmg);
        } else {
            jdgType = "holdTail";
            deviation = Math.abs(touchTmg - note.tailTmg);
        }

        if (deviation > Judge.jdgRange[jdgType].good) {
            return 0;
        }
        else if (deviation > Judge.jdgRange[jdgType].great) {
            return 1;
        }
        else if (deviation > Judge.jdgRange[jdgType].perfect) {
            return 2;
        }
        else {
            return 3;
        }
    }

    _execJdgEffect(judgement) {
        switch (judgement) {
            case 3:
                this._playSound(this.perfectSound);
                break;
            case 2:
                this._playSound(this.greatSound);
                break;
            case 1:
                this._playSound(this.goodSound);
                break;
            default:
                break;
        }
    }

    _playSound(buffer) {
        let source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);
    }

}

Judge.jdgRange = {
    tap: {
        perfect: 30,
        great: 80,
        good: 160
    },
    slide: {
        perfect: 40,
        great: 100,
        good: 160
    },
    holdTail: {
        perfect: 50,
        great: 120,
        good: 200
    }
};