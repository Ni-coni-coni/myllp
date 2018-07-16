class Game {

    constructor() {

        this.assets = {
            bg: "image/bg.jpg",
            skin: "image/skin.png",
            perfect: "sound/perfect.mp3",
            great: "sound/great.mp3",
            good: "sound/good.mp3",
            music: "sound/perfect.mp3",
            beatmap: "map/holdTest2.json"
        };

        this.refs = {
            gameDiv: document.getElementById("gameDiv"),
            fpsCounterCanvas: document.getElementById("fpsCounterCanvas"),
            startCanvas: document.getElementById("startCanvas"),
            debugDiv: document.getElementById("debugDiv"),
            debugDiv1: document.getElementById("debugDiv1"),
            debugDiv2: document.getElementById("debugDiv2"),
            bgCanvas: document.getElementById("bgCanvas"),
            judgePosCanvas: document.getElementById("judgePosCanvas"),
            gameCanvas: document.getElementById("gameCanvas")
        };

        this.loader = new Loader();
        this.judge = new Judge();

        this.music = null;
        this.soundEffects = {};
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();

        this.bgImage = null;
        this.skinImage = null;
        this.startTiming = null;

        this.status = null;

        this.fps = 60;
        this.frameInterval = 1000 / this.fps;

        // notesInTmgOrd[i][j][k]表示第i个轨道，按时间排第j个note的第k个属性
        // k=0->timing, k=1->position, k=2->type, k=3->isMulti, k=4->existence, k=5->judgeablility,
        // k=6->end timing(if type == hold), k=7->end pos(if type == hold)
        this.notesInTmgOrd = [[], [], [], [], [], [], [], [], []];
        // indicesForTS[i]中存放第i个轨道，能被TouchStart判定的note的索引列表
        this.indicesForTS = [[], [], [], [], [], [], [], [], []];
        this.indicesForTM = [[], [], [], [], [], [], [], [], []];
        this.lengthsOfITS = new Array(9);
        this.lengthsOfITM = new Array(9);

        this.indicesInPosOrd = [[], [], [], [], [], [], [], [], []]; // position从小到大所对应的note索引

        // speedLines[i][j]表示第i条速度线的第j个属性
        // j=1->timing j=2->speed ratio j=3->position
        this.speedLines = [];
        this.baselineHiSpeed = 0.5;
        this.renderRange = 425;  // TODO 260
        this.startX = 512;
        this.startY = 170;  // TODO 342
        this.destR = 68;  // TODO 56
        this.startPoints = [[], [], [], [], [], [], [], [], []];
        this.judgeAreaCenters = [[], [], [], [], [], [], [], [], []];
        this.judgeAreaRadii = new Array(9);

        this.judgePtrsOfITS = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 指向正在等待判定的note的索引（TouchStart用）
        this.judgePtrsOfITM = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.onhold = [-1, -1, -1, -1, -1, -1, -1, -1, -1];


        this.resizeRatio = 1;
        this.canvasOffsetLeft = 0;
        this.canvasOffsetTop = 0;

        this.gameTiming = null;
    }

    init() {
        window.onresize = () => this._resize();
        this._resize();
        this.loader.loadImage([
            this.assets.bg,
            this.assets.skin
        ]).then(([bg, skin]) => {
            this.bgImage = bg;
            this.skinImage = skin;
            this.refs["bgCanvas"].getContext("2d").drawImage(
                this.bgImage, 0, 0, 1024, 682);
            this.refs["bgCanvas"].getContext("2d").drawImage(
                this.skinImage, 396, 15, 128, 128, 0, 0, 136, 136);
            this.refs["bgCanvas"].getContext("2d").fillStyle = "rgb(20,0,40)";
            this.refs["bgCanvas"].getContext("2d").fillRect(0, 0, 1024, 682);
            return this.loader.loadSound([
                this.assets.perfect,
                this.assets.great,
                this.assets.good,
                this.assets.music
            ]);
        }).then(([perfect, great, good, music]) => {
            this.soundEffects.perfect = perfect;
            this.soundEffects.great = great;
            this.soundEffects.good = good;
            this.music = music;
            return this.loader.loadJson([
                this.assets.beatmap
            ]);
        }).then(([beatmap]) => {
            let position = 0;
            let speedChangeTiming, speedRatio;
            for (let i = 0; i < beatmap.speedLines.length; i++) {
                speedChangeTiming = beatmap.speedLines[i][0];
                speedRatio = beatmap.speedLines[i][1];
                this.speedLines.push([speedChangeTiming, speedRatio, position]);
                if (i < beatmap.speedLines.length - 1) {
                    position += this.baselineHiSpeed * speedRatio *
                        (beatmap.speedLines[i+1][0] - speedChangeTiming);
                }
            }
            console.log(beatmap);

            let noteIdx, noteTiming, notePosition, noteType, isMulti, isExist, isOnhold, noteEndTiming, noteEndPosition;
            for (let i = 0; i < 9; i++) {
                noteIdx = 0;
                for (let j = 0; j < beatmap.notes[i].length; j++) {
                    noteTiming = beatmap.notes[i][j][0];
                    notePosition = this._getPosition(noteTiming, this.speedLines,
                        0, this.speedLines.length-1, this.baselineHiSpeed);
                    noteType = beatmap.notes[i][j][1];
                    isMulti = false;
                    isExist = true;
                    isOnhold = false;
                    if (noteType <= 2) {
                        this.notesInTmgOrd[i].push([noteTiming, notePosition, noteType, isMulti, isExist]);
                    } else {
                        noteEndTiming = beatmap.notes[i][++j][0];
                        noteEndPosition = this._getPosition(noteEndTiming, this.speedLines,
                            0, this.speedLines.length-1, this.baselineHiSpeed);
                        this.notesInTmgOrd[i].push([noteTiming, notePosition, noteType, isMulti, isExist, isOnhold,
                            noteEndTiming, noteEndPosition]);
                    }
                    if (noteType == 0) {
                        this.indicesForTS[i].push(noteIdx);
                    }
                    else if (noteType == 1) {
                        this.indicesForTS[i].push(noteIdx);
                        this.indicesForTM[i].push(noteIdx);
                    }
                    // TODO
                    else if (noteType == 3) {
                        this.indicesForTS[i].push(noteIdx);
                    }
                    else if (noteType == 4) {
                        this.indicesForTS[i].push(noteIdx);
                        this.indicesForTM[i].push(noteIdx);
                    }
                    // TODO

                    this.indicesInPosOrd[i].push(noteIdx); //先放入，在下面排序
                    noteIdx++;
                }
                this.lengthsOfITS[i] = this.indicesForTS[i].length;
                this.lengthsOfITM[i] = this.indicesForTM[i].length;
            }
            // 检测多押并加标记
            let notes = [];
            for (let i = 0; i < 9; i++) {
                let oneLaneNotes = this.notesInTmgOrd[i];
                for (let j = 0; j < oneLaneNotes.length; j++) {
                    noteTiming = oneLaneNotes[j][0];
                    notes.push([noteTiming, i, j])
                }
            }
            notes.sort((note1, note2) => note1[0] - note2[0]);
            for (let i = 0; i < notes.length-1; i++) {
                if (notes[i][0] == notes[i+1][0]) {
                    this.notesInTmgOrd[notes[i][1]][notes[i][2]][3] = true;
                    this.notesInTmgOrd[notes[i+1][1]][notes[i+1][2]][3] = true;
                }
            }
            // 按noteIdx对应的note的pos排序indicesInPosOrd
            for (let i = 0; i < this.indicesInPosOrd.length; i++) {
                this.indicesInPosOrd[i].sort((indexA, indexB) =>
                this.notesInTmgOrd[i][indexA][1] - this.notesInTmgOrd[i][indexB][1]);
            }
            // 将position rank添加到notesInTmgOrd中每个note的属性里
            for (let i = 0; i < this.indicesInPosOrd.length; i++) {
                for (let j = 0; j < this.indicesInPosOrd[i].length; j++) {
                    this.notesInTmgOrd[i][this.indicesInPosOrd[i][j]].push(j);
                }
            }
            this.windowPtrsOfIPO = this._getInitialPtrsOfIPO();

            console.log("check speedLines, notesInTmgOrd, indicesInPosOrd, indicesForTS/TM and windowPtrsOfIPO");
            console.log(this.speedLines);
            console.log(this.notesInTmgOrd);
            console.log(this.indicesInPosOrd);
            console.log(this.indicesForTS);
            console.log(this.indicesForTM);
            console.log(this.windowPtrsOfIPO);

            this.initCoordinates(this.startX, this.startY, this.destR);
            // this.initCoordinatesMaiMai(this.startX, this.startY, this.destR);
            this.renderJudgeAreas();

            let that = this;
            let startCtx = this.refs.startCanvas.getContext("2d");
            startCtx.font = "300px Georgia";
            startCtx.fillText("Start!!", 100, 400);
            this.refs.startCanvas.addEventListener("click", function(){
                that.refs.startCanvas.style.zIndex = -1;
                that.start();
            });
        });
    }

    initCoordinates(startX, startY, destR) {
        let distance = this.renderRange;
        let pi = Math.PI;
        let angle = pi / 8;
        let radius = destR;
        let centerX, centerY;
        for (let i = 0; i < 9; i ++) {
            centerX = startX + distance * Math.cos(pi + angle * i);
            centerY = startY - distance * Math.sin(pi + angle * i);
            this.judgeAreaCenters[i] = [centerX, centerY];
            this.startPoints[i] = [startX, startY];
            this.judgeAreaRadii[i] = radius;
        }
    }

    initCoordinatesMaiMai(startX, startY, destR) {
        let distance = this.renderRange;
        let pi = Math.PI;
        let angle = pi / 4;
        let radius = destR;
        let centerX, centerY;
        for (let i = 0; i < 9; i ++) {
            centerX = startX + distance * Math.cos(pi / 8 * 5 + angle * i);
            centerY = startY - distance * Math.sin(pi / 8 * 5 + angle * i);
            this.judgeAreaCenters[i] = [centerX, centerY];
            this.startPoints[i] = [startX, startY];
            this.judgeAreaRadii[i] = radius;
        }
    }

    renderJudgeAreas() {
        let cxt = this.refs.judgePosCanvas.getContext("2d");
        let centerX, centerY, radius;
        for (let i = 0; i < this.judgeAreaCenters.length; i++) {
            centerX = this.judgeAreaCenters[i][0];
            centerY = this.judgeAreaCenters[i][1];
            radius = this.judgeAreaRadii[i];
            cxt.beginPath();
            cxt.arc(centerX, centerY, radius, 0, 360);
            cxt.fillStyle = "#FFE699";
            cxt.fill();
            cxt.closePath();
        }
    }

    /*
    addMouseEventListener() {
        this.refs.gameCanvas.addEventListener("mousedown", (e) => {
            let touchTiming = Date.now() - this.startTiming;
            let canvasX = e.offsetX / this.resizeRatio;
            let canvasY = e.offsetY / this.resizeRatio;
            let canvasTouchCoords = [[canvasX, canvasY]];
            // console.log("x:" + canvasX);
            // console.log("y:" + canvasY);
            let judgement, holdJudgement;
            let lanesToJudge = this.judge.getLanesToJudge(this.judgeAreaCenters, this.judgeAreaRadii,
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
                            this.debugNum++;
                            let holdTime = noteToJudge[6] - noteTiming;
                            this._executeJudgeEffect(holdJudgement);
                            this.notesInTmgOrd[lane][idxToJudge][4] = false;
                            this.notesInTmgOrd[lane][idxToJudge][5] = true;
                            this.onhold[lane] = idxToJudge;
                            let that = this;

                            setTimeout(function () {
                                that.refs.debugDiv.innerText = "TIME OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOUT!!!!"; //TODO
                                let onholdIdx = that.onhold[lane];
                                if (onholdIdx != -1) {  // TODO 考虑条尾是slide的情况
                                    that._executeJudgeEffect("perfect");
                                    that.notesInTmgOrd[lane][onholdIdx][4] = false;
                                    that.notesInTmgOrd[lane][onholdIdx][5] = false;
                                    that.onhold[lane] = -1;
                                }
                            }, holdTime);
                            this.refs.debugDiv2.innerText = "1holdnum:" + this.debugNum;
                        }
                    }
                }
            }
        })
    }
    */

    addTouchStartEventListener() {
        this.refs.gameCanvas.addEventListener("touchstart", (e) => {
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
            let lanesToJudge = this.judge.getLanesToJudge(this.judgeAreaCenters, this.judgeAreaRadii,
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
        })
    }

    addTouchMoveEventListener() {
        this.refs.gameCanvas.addEventListener("touchmove", (e) => {
            e.preventDefault();
            let touchTiming = Date.now() - this.startTiming;
            let canvasTouchCoords = [];
            let canvasOnTouchCoords = [];
            let canvasX, canvasY;
            for (let i = 0; i < e.changedTouches.length; i++) {
                // this.refs.debugDiv.innerText = "touch" + e.touches[i].pageX;
                canvasX = (e.changedTouches[i].pageX - this.canvasOffsetLeft) / this.resizeRatio;
                canvasY = (e.changedTouches[i].pageY - this.canvasOffsetTop) / this.resizeRatio;
                canvasTouchCoords.push([canvasX, canvasY]);
            }
            for (let i = 0; i < e.touches.length; i++) {
                // this.refs.debugDiv.innerText = "touch" + e.touches[i].pageX;
                canvasX = (e.touches[i].pageX - this.canvasOffsetLeft) / this.resizeRatio;
                canvasY = (e.touches[i].pageY - this.canvasOffsetTop) / this.resizeRatio;
                canvasOnTouchCoords.push([canvasX, canvasY]);
            }
            // this.refs.debugDiv.innerText = "canvasX:" + canvasX + "\ncanvasY:" + canvasY;
            let judgement, holdJudgement;
            let lanesToJudge = this.judge.getLanesToJudge(this.judgeAreaCenters, this.judgeAreaRadii,
                canvasTouchCoords);
            let lanesOnTouchOneHot = this.judge.getLanesToJudge(this.judgeAreaCenters, this.judgeAreaRadii,
                canvasOnTouchCoords, true);
            if (lanesToJudge.length != 0) {
                for (let lane of lanesToJudge) {
                    let ptr = this.judgePtrsOfITM[lane];
                    if (ptr < this.lengthsOfITM[lane]) {
                        let idxToJudge = this.indicesForTM[lane][ptr];
                        let noteToJudge = this.notesInTmgOrd[lane][idxToJudge];
                        let noteType = noteToJudge[2];
                        let noteTiming = noteToJudge[0];
                        if (noteType == 1) {
                            judgement = this.judge.getSlideJudgement(touchTiming, noteTiming);
                        }
                        else if (noteType == 4) {
                            holdJudgement = this.judge.getSlideJudgement(touchTiming, noteTiming);
                        }
                        if (judgement != null) {
                            this._executeJudgeEffect(judgement);
                            this.notesInTmgOrd[lane][idxToJudge][4] = false;
                        }
                        if (holdJudgement != null) {
                            let holdTime = noteToJudge[6] - noteTiming;
                            this._executeJudgeEffect(holdJudgement);
                            this.notesInTmgOrd[lane][idxToJudge][5] = true;
                            this.onhold[lane] = idxToJudge;

                            // this.refs.debugDiv1.innerText = this.onhold.join(","); // TODO debug

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
            // 判断在有hold的情况是否有手指移出范围
            for (let lane = 0; lane < 9; lane++) {
                if (this.onhold[lane] != -1 && lanesOnTouchOneHot[lane] == false) { // move out
                    let onholdIdx = this.onhold[lane];
                    let noteEndTiming = this.notesInTmgOrd[lane][onholdIdx][6];
                    judgement = this.judge.getHoldEndJudgement(touchTiming, noteEndTiming);
                    this._executeJudgeEffect(judgement);
                    this.notesInTmgOrd[lane][onholdIdx][5] = false;
                    this.onhold[lane] = -1;
                }
            }

        })
    }

    addTouchEndEventListener() {
        this.refs.gameCanvas.addEventListener("touchend", (e) => {
            e.preventDefault();
            let touchTiming = Date.now() - this.startTiming;
            let canvasTouchCoords = [];
            let canvasOnTouchCoords = [];
            let canvasX, canvasY;
            for (let i = 0; i < e.changedTouches.length; i++) {
                // this.refs.debugDiv.innerText = "touch" + e.touches[i].pageX;
                canvasX = (e.changedTouches[i].pageX - this.canvasOffsetLeft) / this.resizeRatio;
                canvasY = (e.changedTouches[i].pageY - this.canvasOffsetTop) / this.resizeRatio;
                canvasTouchCoords.push([canvasX, canvasY]);
            }
            for (let i = 0; i < e.touches.length; i++) {
                // this.refs.debugDiv.innerText = "touch" + e.touches[i].pageX;
                canvasX = (e.touches[i].pageX - this.canvasOffsetLeft) / this.resizeRatio;
                canvasY = (e.touches[i].pageY - this.canvasOffsetTop) / this.resizeRatio;
                canvasOnTouchCoords.push([canvasX, canvasY]);
            }
            // this.refs.debugDiv.innerText = "canvasX:" + canvasX + "\ncanvasY:" + canvasY;
            let judgement;
            let lanesTouchEnd = this.judge.getLanesToJudge(this.judgeAreaCenters, this.judgeAreaRadii,
                canvasTouchCoords);
            let lanesOnTouch = this.judge.getLanesToJudge(this.judgeAreaCenters, this.judgeAreaRadii,
                canvasOnTouchCoords);
            if (lanesTouchEnd.length != 0) {
                for (let lane of lanesTouchEnd) {
                    // 判断在有hold的情况是否有手指抬起
                    if (this.onhold[lane] != -1) {
                        let away = true;
                        for (let laneOnTouch of lanesOnTouch) {
                            if (laneOnTouch == lane) {
                                away = false;
                            }
                        }
                        if (away) {
                            let onholdIdx = this.onhold[lane];
                            let noteEndTiming = this.notesInTmgOrd[lane][onholdIdx][6];
                            judgement = this.judge.getHoldEndJudgement(touchTiming, noteEndTiming);
                            this._executeJudgeEffect(judgement);
                            this.notesInTmgOrd[lane][onholdIdx][5] = false;
                            this.onhold[lane] = -1;
                        }
                    }
                }
            }
        })
    }

    _judgeHoldEndAuto(lane) {
        let onholdIdx = this.onhold[lane];
        if (onholdIdx != -1) {  // TODO 考虑条尾是slide的情况
            this._executeJudgeEffect("perfect");
            this.notesInTmgOrd[lane][onholdIdx][4] = false;
            this.notesInTmgOrd[lane][onholdIdx][5] = false;
            this.onhold[lane] = -1;
        }
    }

    _executeJudgeEffect(judgement) {
        switch (judgement) {
            case "perfect":
                this.playSound(this.soundEffects.perfect);
                break;
            case "great":
                this.playSound(this.soundEffects.great);
                break;
            case "good":
                this.playSound(this.soundEffects.good);
                break;
            default:
                break;
        }
    }

    _getPosition(timing, speedLineArr, left, right, baselineHS) {
        if (left == right) {
            return baselineHS * (timing - speedLineArr[left][0]) * speedLineArr[left][1] +
                speedLineArr[left][2];
        }
        let mid = Math.ceil((left + right) / 2);
        if (timing < speedLineArr[mid][0]) {
            return this._getPosition(timing, speedLineArr, left, mid-1, baselineHS);
        }
        else {
            return this._getPosition(timing, speedLineArr, mid, right, baselineHS);
        }

    }

    _getInitialPtrsOfIPO() {
        let headPtrs = [];
        let TailPtrs = [];
        for (let i = 0; i < this.indicesInPosOrd.length; i++) {
            let headPtr = 0;
            let tailPtr = 0;
            for (let idx of this.indicesInPosOrd[i]) {
                if (this.notesInTmgOrd[i][idx][1] < - this.renderRange) {
                    headPtr ++; tailPtr ++;
                }
                else if (this.notesInTmgOrd[i][idx][1] < this.renderRange) {
                    headPtr ++;
                }
                else break;
            }
            headPtrs.push(headPtr);
            TailPtrs.push(tailPtr);
        }
        return [headPtrs, TailPtrs];
    }

    _updateJudgeIndices(judgePtrsOfITS, judgePtrsOfITM, gameTiming) {
        let idxToJudgeForTS, idxToJudgeForTM;
        for (let i = 0; i < 9; i++) {
            if (judgePtrsOfITS[i] < this.lengthsOfITS[i]) {
                idxToJudgeForTS = this.indicesForTS[i][judgePtrsOfITS[i]];
                if (gameTiming - this.notesInTmgOrd[i][idxToJudgeForTS][0] > this.judge.good) {
                    this.notesInTmgOrd[i][idxToJudgeForTS][4] = false;
                }
            }
            if (judgePtrsOfITM[i] < this.lengthsOfITM[i]) {
                idxToJudgeForTM = this.indicesForTM[i][judgePtrsOfITM[i]];
                if (gameTiming - this.notesInTmgOrd[i][idxToJudgeForTM][0] > this.judge.good) {
                    this.notesInTmgOrd[i][idxToJudgeForTS][4] = false;
                }
            }
            // 调整judge pointer
            while (judgePtrsOfITS[i] < this.lengthsOfITS[i]) {
                idxToJudgeForTS = this.indicesForTS[i][judgePtrsOfITS[i]];
                if (this.notesInTmgOrd[i][idxToJudgeForTS][4] == false) {
                    judgePtrsOfITS[i]++;
                }
                else {
                    break;
                }
            }
            while (judgePtrsOfITM[i] < this.lengthsOfITM[i]) {
                idxToJudgeForTM = this.indicesForTM[i][judgePtrsOfITM[i]];
                if (this.notesInTmgOrd[i][idxToJudgeForTM][4] == false) {
                    judgePtrsOfITM[i]++;
                }
                else {
                    break;
                }
            }
        }
    }

    start() {
        console.log("renderGame");
        this.playSound(this.music);

        this.gameTiming = 0;
        let gamePosition, lastGamePosition = 0;

        //this.addMouseEventListener();
        this.addTouchStartEventListener();
        this.addTouchMoveEventListener();
        this.addTouchEndEventListener();

        let frameCount = 0;
        let now, elapsed;
        // this.music.play();
        this.startTiming = Date.now();
        let then = this.startTiming;
        // count FPS
        let lastFPSCountTiming = then;
        let lastFrameCount = 0;

        let oneFrameTime = 0;

        let that = this;
        (function animate() {
            requestAnimationFrame(animate);
            now = Date.now();
            elapsed = now - then;
            //if (elapsed > that.frameInterval) {
                frameCount ++;
                /*
                if (now - lastFPSCountTiming > 1000) {
                    let fps = (frameCount - lastFrameCount) * 1000 / (now - lastFPSCountTiming);
                    //console.log(fps);
                    that.refs.fpsCounterDiv.innerText = "fps:" + fps;

                    lastFrameCount = frameCount;
                    lastFPSCountTiming = now;
                }
                */
                then = now - (elapsed % that.frameInterval);
                that.gameTiming = now - that.startTiming;
                let oneFrameStart = Date.now(); //TODO
                gamePosition = that._getPosition(that.gameTiming, that.speedLines,
                    0, that.speedLines.length-1, that.baselineHiSpeed);
                that._updateJudgeIndices(that.judgePtrsOfITS, that.judgePtrsOfITM, that.gameTiming);
                that._renderOneFrame(gamePosition, lastGamePosition, that.renderRange, that.windowPtrsOfIPO);
                oneFrameTime = Date.now() - oneFrameStart; //TODO
                if (frameCount % 10 == 0) {
                    that.refs.debugDiv.innerText = "frame count:" + frameCount +
                        "\nrender time every frame:" + oneFrameTime + "ms"; //TODO
                }
                lastGamePosition = gamePosition;

            //}
        })();
    }

    _renderOneFrame(gamePosition, lastGamePosition, renderRange, ptrsOfIPO) {

        this.refs.debugDiv1.innerText = "lane4 onhold:\n" + this.onhold.join(",");
        this.refs.debugDiv2.innerText = "note4 ifhold:\n" + this.notesInTmgOrd[3][0][5];
        let indexIn, indexOut;
        let noteIdx, notePos, noteType, isMulti;
        if (gamePosition > lastGamePosition) {
            for (let i = 0; i < 9; i++) {
                indexIn = ptrsOfIPO[0][i];
                for (let j = indexIn; j < this.indicesInPosOrd[i].length; j++) {
                    notePos = this.notesInTmgOrd[i][this.indicesInPosOrd[i][j]][1];
                    if (notePos < gamePosition + renderRange) {
                        ptrsOfIPO[0][i]++;
                    } else break;
                }
                indexOut = ptrsOfIPO[1][i];
                for (let j = indexOut; j < this.indicesInPosOrd[i].length; j++) {
                    notePos = this.notesInTmgOrd[i][this.indicesInPosOrd[i][j]][7] ||
                        this.notesInTmgOrd[i][this.indicesInPosOrd[i][j]][1]; //hold需要用条尾的pos来计算
                    if (notePos < gamePosition - renderRange) {
                        ptrsOfIPO[1][i]++;
                    } else break;
                }
            }
        }
        else {
            for (let i = 0; i < 9; i++) {
                indexIn = ptrsOfIPO[0][i];
                for (let j = indexIn - 1; j >= 0; j--) {
                    notePos = this.notesInTmgOrd[i][this.indicesInPosOrd[i][j]][1];
                    if (notePos > gamePosition + renderRange) {
                        ptrsOfIPO[0][i]--;
                    } else break;
                }
                indexOut = ptrsOfIPO[1][i];
                for (let j = indexOut - 1; j >= 0; j--) {
                    notePos = this.notesInTmgOrd[i][this.indicesInPosOrd[i][j]][7] ||
                        this.notesInTmgOrd[i][this.indicesInPosOrd[i][j]][1]; //hold需要用条尾的pos来计算
                    if (notePos > gamePosition - renderRange) {
                        ptrsOfIPO[1][i]--;
                    } else break;
                }
            }
        }

        this.refs["gameCanvas"].getContext("2d").clearRect(0, 0, 1024, 682);

        for (let i = 0; i < 9; i++) {
            for (let j = ptrsOfIPO[1][i]; j < ptrsOfIPO[0][i]; j++) {
                noteIdx = this.indicesInPosOrd[i][j];
                if (this.notesInTmgOrd[i][noteIdx][4]) {
                    notePos = this.notesInTmgOrd[i][noteIdx][1];
                    noteType = this.notesInTmgOrd[i][noteIdx][2];
                    isMulti = this.notesInTmgOrd[i][noteIdx][3];
                    if (noteType <= 2) { // TODO 注意这里的分类
                        this._drawNote(this.startPoints[i][0], this.startPoints[i][1],
                            this.judgeAreaCenters[i][0], this.judgeAreaCenters[i][1], this.destR,
                            notePos, noteType, isMulti, gamePosition, renderRange);
                    }
                    else { // TODO 注意这里的分类
                        let isOnhold = this.notesInTmgOrd[i][noteIdx][5];
                        let noteEndPos = this.notesInTmgOrd[i][noteIdx][7];
                        if (noteEndPos > gamePosition + renderRange || noteEndPos < gamePosition - renderRange) {
                            this._drawHalfLongNote(this.startPoints[i][0], this.startPoints[i][1],
                                this.judgeAreaCenters[i][0], this.judgeAreaCenters[i][1], this.destR,
                                notePos, noteType, isMulti, isOnhold, gamePosition, renderRange);
                        }
                        else {
                            this._drawLongNote(this.startPoints[i][0], this.startPoints[i][1],
                                this.judgeAreaCenters[i][0], this.judgeAreaCenters[i][1], this.destR,
                                notePos, noteEndPos, noteType, isMulti, isOnhold, gamePosition, renderRange);
                        }
                    }
                } else if (this.notesInTmgOrd[i][noteIdx][2] >= 3 && this.notesInTmgOrd[i][noteIdx][5]) {
                    // isExist=False noteType=hold isOnHold=True
                    notePos = this.notesInTmgOrd[i][noteIdx][1];
                    noteType = this.notesInTmgOrd[i][noteIdx][2];
                    isMulti = this.notesInTmgOrd[i][noteIdx][3];
                    let isOnhold = this.notesInTmgOrd[i][noteIdx][5];
                    let noteEndPos = this.notesInTmgOrd[i][noteIdx][7];
                    if (noteEndPos > gamePosition + renderRange || noteEndPos < gamePosition - renderRange) {
                        this._drawHalfLongNote(this.startPoints[i][0], this.startPoints[i][1],
                            this.judgeAreaCenters[i][0], this.judgeAreaCenters[i][1], this.destR,
                            notePos, noteType, isMulti, isOnhold, gamePosition, renderRange);
                    }
                    else {
                        this._drawLongNote(this.startPoints[i][0], this.startPoints[i][1],
                            this.judgeAreaCenters[i][0], this.judgeAreaCenters[i][1], this.destR,
                            notePos, noteEndPos, noteType, isMulti, isOnhold, gamePosition, renderRange);
                    }
                }
            }
        }

    }

    _drawNote(startX, startY, destX, destY, destR, notePosition, noteType, isMulti, gamePosition, renderRange) {
        let finishedDistanceRatio = (gamePosition - notePosition + renderRange) / renderRange;
        let noteX = startX + (destX - startX) * finishedDistanceRatio;
        let noteY = startY + (destY - startY) * finishedDistanceRatio;
        // let noteSizeRatio = finishedDistanceRatio > 1 ? 1 : finishedDistanceRatio;
        let noteLeft = noteX - destR * finishedDistanceRatio;
        let noteTop = noteY - destR * finishedDistanceRatio;
        let noteSize = destR * 2 * finishedDistanceRatio;
        let ctx = this.refs.gameCanvas.getContext("2d");
        if (noteType == 0) {
            ctx.drawImage(
                this.skinImage, 396, 175, 128, 128,
                noteLeft, noteTop, noteSize, noteSize);
        } else if (noteType == 1) {
            ctx.drawImage(
                this.skinImage, 396, 337, 128, 128,
                noteLeft, noteTop, noteSize, noteSize);
        }
        if (isMulti) {
            let barLeft = noteX - 68 * finishedDistanceRatio;
            let barTop = noteY - 13 * finishedDistanceRatio;
            let barWidth = 136 * finishedDistanceRatio;
            let barHeight = 26 * finishedDistanceRatio;
            ctx.drawImage(
                this.skinImage, 242, 417, 128, 24,
                barLeft, barTop, barWidth, barHeight);
        }
        /*
        if (isMulti) {//TODO maimai
            ctx.drawImage(
                this.skinImage, 396, 337, 128, 128,
                noteLeft, noteTop, noteSize, noteSize);
        }
        */

    }

    _drawHalfLongNote(startX, startY, destX, destY, destR, notePosition, noteType,
                      isMulti, isOnhold, gamePosition, renderRange) {
        let finishedDistance = gamePosition - notePosition + renderRange;
        let finishedDistanceRatio = finishedDistance / renderRange;
        let finishedX = (destX - startX) * finishedDistanceRatio;
        let finishedY = (destY - startY) * finishedDistanceRatio;
        let noteX = startX + finishedX;
        let noteY = startY + finishedY;
        // let noteSizeRatio = finishedDistanceRatio > 1 ? 1 : finishedDistanceRatio;
        let noteLeft = noteX - destR * finishedDistanceRatio;
        let noteTop = noteY - destR * finishedDistanceRatio;
        let noteSize = destR * 2 * finishedDistanceRatio;
        let noteR = destR * finishedDistanceRatio;
        let rDividedByD = noteR / finishedDistance;
        let head1X = noteX + finishedY * rDividedByD;
        let head1Y = noteY - finishedX * rDividedByD;
        let head2X = noteX - finishedY * rDividedByD;
        let head2Y = noteY + finishedX * rDividedByD;

        let rDividedByRange = destR / renderRange;
        let holdHead1X = destX + (destY - startY) * rDividedByRange;
        let holdHead1Y = destY - (destX - startX) * rDividedByRange;
        let holdHead2X = destX - (destY - startY) * rDividedByRange;
        let holdHead2Y = destY + (destX - startX) * rDividedByRange;
        let ctx = this.refs.gameCanvas.getContext("2d");
        // note飞过来时
        if (!isOnhold) {
            this._drawTriangle(ctx, head1X, head1Y, head2X, head2Y, startX, startY);
            if (noteType == 3) {
                ctx.drawImage(
                    this.skinImage, 396, 175, 128, 128,
                    noteLeft, noteTop, noteSize, noteSize);
            } else if (noteType == 4) {
                ctx.drawImage(
                    this.skinImage, 396, 337, 128, 128,
                    noteLeft, noteTop, noteSize, noteSize);
            }
            if (isMulti) {
                let barLeft = noteX - destR * finishedDistanceRatio;
                let barTop = noteY - 13 * finishedDistanceRatio;
                let barWidth = destR * 2 * finishedDistanceRatio;
                let barHeight = 26 * finishedDistanceRatio;
                ctx.drawImage(
                    this.skinImage, 242, 417, 128, 24,
                    barLeft, barTop, barWidth, barHeight);
            }
        }
        // note判定时
        else {
            this._drawTriangle(ctx, holdHead1X, holdHead1Y, holdHead2X, holdHead2Y, startX, startY);
        }

    }


    _drawLongNote(startX, startY, destX, destY, destR, notePosition, noteEndPos, noteType,
                  isMulti, isOnhold, gamePosition, renderRange) {
        let finishedDistance = gamePosition - notePosition + renderRange;
        let finishedDistanceRatio = finishedDistance / renderRange;
        let finishedX = (destX - startX) * finishedDistanceRatio;
        let finishedY = (destY - startY) * finishedDistanceRatio;
        let noteX = startX + finishedX;
        let noteY = startY + finishedY;
        // let noteSizeRatio = finishedDistanceRatio > 1 ? 1 : finishedDistanceRatio;
        let noteLeft = noteX - destR * finishedDistanceRatio;
        let noteTop = noteY - destR * finishedDistanceRatio;
        let noteSize = destR * 2 * finishedDistanceRatio;
        let noteR = destR * finishedDistanceRatio;
        let rDividedByD = noteR / finishedDistance;
        let head1X = noteX + finishedY * rDividedByD;
        let head1Y = noteY - finishedX * rDividedByD;
        let head2X = noteX - finishedY * rDividedByD;
        let head2Y = noteY + finishedX * rDividedByD;

        finishedDistance = gamePosition - noteEndPos + renderRange;
        finishedDistanceRatio = finishedDistance / renderRange;
        finishedX = (destX - startX) * finishedDistanceRatio;
        finishedY = (destY - startY) * finishedDistanceRatio;
        noteX = startX + finishedX;
        noteY = startY + finishedY;
        // noteSizeRatio = finishedDistanceRatio > 1 ? 1 : finishedDistanceRatio;
        let noteTailLeft = noteX - destR * finishedDistanceRatio;
        let noteTailTop = noteY - destR * finishedDistanceRatio;
        let noteTailSize = destR * 2 * finishedDistanceRatio;
        noteR = destR * finishedDistanceRatio;
        rDividedByD = noteR / finishedDistance;
        let tail1X = noteX + finishedY * rDividedByD;
        let tail1Y = noteY - finishedX * rDividedByD;
        let tail2X = noteX - finishedY * rDividedByD;
        let tail2Y = noteY + finishedX * rDividedByD;

        let rDividedByRange = destR / renderRange;
        let holdHead1X = destX + (destY - startY) * rDividedByRange;
        let holdHead1Y = destY - (destX - startX) * rDividedByRange;
        let holdHead2X = destX - (destY - startY) * rDividedByRange;
        let holdHead2Y = destY + (destX - startX) * rDividedByRange;

        let ctx = this.refs.gameCanvas.getContext("2d");

        if (!isOnhold) {
            this._drawQuadrangle(ctx, head1X, head1Y, head2X, head2Y, tail2X, tail2Y, tail1X, tail1Y);
            if (noteType == 3) {
                ctx.drawImage(
                    this.skinImage, 396, 175, 128, 128,
                    noteLeft, noteTop, noteSize, noteSize);
            } else if (noteType == 4) {
                ctx.drawImage(
                    this.skinImage, 396, 337, 128, 128,
                    noteLeft, noteTop, noteSize, noteSize);
            }

            if (isMulti) {
                let barLeft = noteX - destR * finishedDistanceRatio;
                let barTop = noteY - 13 * finishedDistanceRatio;
                let barWidth = destR * 2 * finishedDistanceRatio;
                let barHeight = 26 * finishedDistanceRatio;
                ctx.drawImage(
                    this.skinImage, 242, 417, 128, 24,
                    barLeft, barTop, barWidth, barHeight);
            }
        }
        else {
            this._drawQuadrangle(ctx, holdHead1X, holdHead1Y, holdHead2X, holdHead2Y,
                                 tail2X, tail2Y, tail1X, tail1Y);
        }

        ctx.drawImage(
            this.skinImage, 255, 275, 128, 128,
            noteTailLeft, noteTailTop, noteTailSize, noteTailSize);
    }

    // tips: 指定原始canvas大小用js或者h5标签（1024×682），
    // css指定canvas大小让图片拉伸（gameDiv的100%，gameDiv随窗口大小改变）
    _resize() {
        let ratio = 682 / 1024;
        let w = window.innerWidth;
        let h = window.innerHeight;
        if (h/w < ratio) {
            let gameDivWidth = h / ratio;
            this.refs["gameDiv"].style.width = gameDivWidth + "px";
            this.refs["gameDiv"].style.height = h + "px";
            this.refs["gameDiv"].style.left = (w - gameDivWidth) / 2 + "px";
            this.refs["gameDiv"].style.top = "0px";
            this.canvasOffsetLeft = (w - gameDivWidth) / 2;
            this.canvasOffsetTop = 0;
            this.resizeRatio = h / 682;
        } else {
            let gameDivHeight = w * ratio;
            this.refs["gameDiv"].style.width = w + "px";
            this.refs["gameDiv"].style.height = gameDivHeight + "px";
            this.refs["gameDiv"].style.left = "0px";
            this.refs["gameDiv"].style.top = (h - gameDivHeight) / 2 + "px";
            this.canvasOffsetLeft = 0;
            this.canvasOffsetTop = (h - gameDivHeight) / 2;
            this.resizeRatio = w / 1024;
        }
    }

    playSound(buffer) {
        let source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);
    }

    _drawTriangle(ctx, x1, y1, x2, y2, x3, y3) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.fillStyle = 'rgba(255, 251, 240, 0.5)';
        ctx.closePath();
        ctx.fill();
    }

    _drawQuadrangle(ctx, x1, y1, x2, y2, x3, y3, x4, y4) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.fillStyle = 'rgba(255, 251, 240, 0.5)';
        ctx.closePath();
        ctx.fill();
    }

}
