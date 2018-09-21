class Judge {

    constructor() {
        this.perfect = 30;
        this.great = 60;
        this.good = 120;
        this.slidePerfect = 60;
        this.slideGreat = 90;
        this.slideGood = 120;
        this.holdEndPerfect = 40;
        this.holdEndGreat = 70;
        this.holdEndGood = 120;
    }

    getJudgeLanes(judgeAreaCenters, radii, canvasTouchCoords, ifOneHot=false) {
        let lanesToJudge = [];
        let oneHot = [false, false, false, false, false, false, false, false, false];
        let dX, dY, distance;
        for (let i = 0; i < judgeAreaCenters.length; i++) {
            for (let touch of canvasTouchCoords) {
                dX = touch[0] - judgeAreaCenters[i][0];
                dY = touch[1] - judgeAreaCenters[i][1];
                distance = Math.pow(dX*dX + dY*dY, 0.5);
                if (distance < radii[i] * 1.2) {
                    oneHot[i] = true;
                }
            }
        }
        if (ifOneHot) {
            return oneHot;
        }
        else {
            for (let i = 0; i < judgeAreaCenters.length; i++) {
                if (oneHot[i] == true) lanesToJudge.push(i);
            }
            return lanesToJudge;
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        let touchTiming = Date.now() - this.startTiming;
        let canvasTouchCoords = [];
        let canvasX, canvasY;
        for (let i = 0; i < e.changedTouches.length; i++) {
            // this.refs.debugDiv.innerText = "touch" + e.touches[i].pageX;
            canvasX = (e.changedTouches[i].pageX - this.canvasOffsetLeft) / this.resizeRatio;
            canvasY = (e.changedTouches[i].pageY - this.canvasOffsetTop) / this.resizeRatio;
            canvasTouchCoords.push([canvasX, canvasY]);
        }
        // this.refs.debugDiv.innerText = "canvasX:" + canvasX + "\ncanvasY:" + canvasY;
        let judgement, holdJudgement;
        let lanesToJudge = this.judge.getJudgeLanes(this.judgeAreaCenters, this.judgeAreaRadii,
            canvasTouchCoords);

        if (lanesToJudge.length != 0) {
            for (let lane of lanesToJudge) {
                let ptr = this.judgePtrsOfITS[lane];
                if (ptr < this.lengthsOfITS[lane]) {
                    let idxToJudge = this.indicesForTS[lane][ptr];
                    let noteToJudge = this.notesInTmgOrd[lane][idxToJudge];
                    let noteType = noteToJudge[2];
                    let noteTiming = noteToJudge[0];
                    if (noteType == 0) {
                        judgement = this.judge.getJudgement(touchTiming, noteTiming);
                    }
                    else if (noteType == 1) {
                        judgement = this.judge.getSlideJudgement(touchTiming, noteTiming);
                    }
                    else if (noteType == 3) {
                        holdJudgement = this.judge.getJudgement(touchTiming, noteTiming);
                    }
                    else if (noteType == 4) {
                        holdJudgement = this.judge.getSlideJudgement(touchTiming, noteTiming);
                    }
                    // 成功判定时将existence置为false，在每帧更新时移动指针
                    if (judgement != null) {
                        this._executeJudgeEffect(judgement);
                        this.notesInTmgOrd[lane][idxToJudge][4] = false;
                    }
                    if (holdJudgement != null) {
                        let holdTime = noteToJudge[6] - noteTiming;
                        this._executeJudgeEffect(holdJudgement);
                        this.notesInTmgOrd[lane][idxToJudge][4] = false;
                        this.notesInTmgOrd[lane][idxToJudge][5] = true;
                        this.onhold[lane] = idxToJudge;

                        //this.refs.debugDiv1.innerText = this.onhold.join(","); // TODO debug

                        let that = this;
                        setTimeout(function (lane, that) {
                            let onholdIdx = that.onhold[lane];
                            if (onholdIdx != -1) {  // TODO 考虑条尾是slide的情况
                                that._executeJudgeEffect("perfect");
                                that.notesInTmgOrd[lane][onholdIdx][5] = false;
                                that.onhold[lane] = -1;
                            }
                        }, holdTime, lane, that);

                    }
                }
            }
        }
    }

    getJudgement(touchTiming, noteTiming) {
        let deviation = Math.abs(touchTiming - noteTiming);
        if (deviation > this.good) {
            return null;
        }
        else if (deviation > this.great) {
            return "good";
        }
        else if (deviation > this.perfect) {
            return "great";
        }
        else {
            return "perfect";
        }
    }

    getSlideJudgement(touchTiming, noteTiming) {
        let deviation = Math.abs(touchTiming - noteTiming);
        if (deviation > this.slideGood) {
            return null;
        }
        else if (deviation > this.slideGreat) {
            return "good";
        }
        else if (deviation > this.slidePerfect) {
            return "great";
        }
        else {
            return "perfect";
        }
    }

    getHoldEndJudgement(touchTiming, noteTiming) {
        let deviation = Math.abs(touchTiming - noteTiming);
        if (deviation > this.holdEndGood) {
            return null;
        }
        else if (deviation > this.holdEndGreat) {
            return "good";
        }
        else if (deviation > this.holdEndPerfect) {
            return "great";
        }
        else {
            return "perfect";
        }
    }

}
