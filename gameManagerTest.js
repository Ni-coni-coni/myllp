class Game {

    constructor() {

        this.refs = {
            gameDiv: document.getElementById("gameDiv"),
            fpsCounterDiv: document.getElementById("fpsCounterDiv"),
            debugDiv: document.getElementById("debugDiv"),
            bgCanvas: document.getElementById("bgCanvas"),
            judgePosCanvas: document.getElementById("judgePosCanvas"),
            gameCanvas: document.getElementById("gameCanvas")
        };

        this.loader = new Loader();
        this.judge = new Judge();

        this.music = null;
        this.soundEffects = {};
        this.bgImage = null;
        this.skinImage = null;
        this.startTiming = null;

        this.status = null;

        this.fps = 30;
        this.frameInterval = 1000 / this.fps;
        this.allNotes = [[], [], [], [], [], [], [], [], []];
        this.allNoteIndices = [[], [], [], [], [], [], [], [], []]; // position从小到大所对应的note索引
        this.speedLines = [];
        this.baselineHiSpeed = 0.5;
        this.renderRange = 425;
        this.startPoints = [[], [], [], [], [], [], [], [], []];
        this.judgeAreaCenters = [[], [], [], [], [], [], [], [], []];
        this.judgeAreaRadii = new Array(9);
        this.judgeIndices = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 正在等待判定的note的索引

        this.resizeRatio = 1;
        this.canvasOffsetLeft = 0;
        this.canvasOffsetTop = 0;

        this.gameTiming = null;
    }

    init() {
        window.onresize = () => this._resize();
        this._resize();
        this.loader.loadImage([
            "image/bg.jpg",
            "image/skin.png"
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
                "sound/perfect.mp3",
                "sound/great.mp3",
                "sound/good.mp3"
            ]);
        }).then(([perfect, great, good]) => {
            this.soundEffects.perfect = perfect;
            this.soundEffects.great = great;
            this.soundEffects.good = good;
            return this.loader.loadJson([
                "map/noteDemo.json"
            ]);
        }).then(([beatmap]) => {
            // speedLines[i][0] means the timing of i-th speed line,
            // speedLines[i][1] means the speed ratio between i-th speed line and (i+1)-th or the end.
            // speedLines[i][2] means the position of i-th speed line.
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
            // allNotes[i][j][0] means the timing of j-th note of i-th destination,
            // allNotes[i][j][1] means the position of j-th note of i-th destination,
            // allNotes[i][j][2] means the type of j-th note of i-th destination.
            // allNotes[i][j][3] means the existence of j-th note of i-th destination.
            // allNotes[i][j][4] means the position rank of j-th note of i-th destination.
            let noteTiming, notePosition, noteType, isExist, destination;
            for (let i = 0; i < 9; i++) {  // todo
                for (let j = 0; j < beatmap.notes[i].length; j++) {
                    noteTiming = beatmap.notes[i][j][0];
                    notePosition = this._getPosition(noteTiming, this.speedLines,
                        0, this.speedLines.length-1, this.baselineHiSpeed);
                    noteType = beatmap.notes[i][j][1];
                    isExist = true;
                    this.allNotes[i].push([noteTiming, notePosition, noteType, isExist]);
                    let index = this.allNotes[i].length - 1;
                    this.allNoteIndices[i].push(index);
                }
            }
            for (let i = 0; i < this.allNoteIndices.length; i++) {
                this.allNoteIndices[i].sort((indexA, indexB) =>
                    this.allNotes[i][indexA][1] - this.allNotes[i][indexB][1]);
            }
            for (let i = 0; i < this.allNoteIndices.length; i++) {
                for (let j = 0; j < this.allNoteIndices[i].length; j++) {
                    this.allNotes[i][this.allNoteIndices[i][j]].push(j);
                }
            }
            console.log("check all speedLines, notes, indices and initial thresholds");
            console.log(this.speedLines);
            console.log(this.allNotes);
            console.log(this.allNoteIndices);
            console.log(this._getInitialThresholds());

            this.initCoordinates();
            this.renderJudgeAreas();
            return this.start();
        });
    }

    initCoordinates() {
        let startX = 512;
        let startY = 170;
        let distance = this.renderRange;
        let pi = Math.PI;
        let angle = pi / 8;
        let radius = 68;
        let centerX, centerY;
        for (let i = 0; i < 9; i ++) {
            centerX = startX + distance * Math.cos(pi + angle * i);
            centerY = startY - distance * Math.sin(pi + angle * i);
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
            cxt.fillStyle = "yellow";
            cxt.fill();
            cxt.closePath();
        }
    }

    addMouseEventListener() {
        this.refs.gameCanvas.addEventListener("mousedown", (e) => {
            let touchTiming = Date.now() - this.startTiming;
            let canvasX = e.offsetX / this.resizeRatio;
            let canvasY = e.offsetY / this.resizeRatio;
            let canvasTouchCoords = [[canvasX, canvasY]];
            let judgement;
            // console.log("x:" + canvasX);
            // console.log("y:" + canvasY);
            let judgeAreas = this.judge.getJudgeAreas(this.judgeAreaCenters, this.judgeAreaRadii,
                canvasTouchCoords);
            if (judgeAreas.length != 0) {
                for (let i of judgeAreas) {
                    if (this.judgeIndices[i] < this.allNotes[i].length) {
                        judgement = this.judge.getJudgement(touchTiming,
                            this.allNotes[i][this.judgeIndices[i]][0]);
                        this._executeJudgeEffect(judgement);
                        console.log(judgement);
                        if (judgement != null) {
                            this.allNotes[i][this.judgeIndices[i]][3] = false;
                            this.judgeIndices[i]++;
                        }
                    }
                }
            }
        })
    }

    addMouseMoveEventListener() {
        this.refs.gameCanvas.addEventListener("mousemove", (e) => {
            let touchTiming = Date.now() - this.startTiming;
            let canvasX = e.offsetX / this.resizeRatio;
            let canvasY = e.offsetY / this.resizeRatio;
            let canvasTouchCoords = [[canvasX, canvasY]];
            let judgement;
            console.log("x:" + canvasX);
            console.log("y:" + canvasY);
            let judgeAreas = this.judge.getJudgeAreas(this.judgeAreaCenters, this.judgeAreaRadii,
                canvasTouchCoords);
            if (judgeAreas.length != 0) {
                for (let i of judgeAreas) {
                    if (this.judgeIndices[i] < this.allNotes[i].length) {
                        judgement = this.judge.getJudgement(touchTiming,
                            this.allNotes[i][this.judgeIndices[i]][0]);
                        this._executeJudgeEffect(judgement);
                        console.log(judgement);
                        if (judgement != null) {
                            this.allNotes[i][this.judgeIndices[i]][3] = false;
                            this.judgeIndices[i]++;
                        }
                    }
                }
            }
        })
    }

    addTouchEventListener() {
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
            this.refs.debugDiv.innerText = "canvasX:" + canvasX + "\ncanvasY:" + canvasY;
            let judgement;
            let judgeAreas = this.judge.getJudgeAreas(this.judgeAreaCenters, this.judgeAreaRadii,
                canvasTouchCoords);
            if (judgeAreas.length != 0) {
                for (let i of judgeAreas) {
                    if (this.judgeIndices[i] < this.allNotes[i].length) {
                        judgement = this.judge.getJudgement(touchTiming,
                            this.allNotes[i][this.judgeIndices[i]][0]);
                        this._executeJudgeEffect(judgement);
                        if (judgement != null) {
                            this.allNotes[i][this.judgeIndices[i]][3] = false;
                            this.judgeIndices[i]++;
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
            let canvasX, canvasY;
            for (let i = 0; i < e.changedTouches.length; i++) {
                // this.refs.debugDiv.innerText = "touch" + e.touches[i].pageX;
                canvasX = (e.changedTouches[i].pageX - this.canvasOffsetLeft) / this.resizeRatio;
                canvasY = (e.changedTouches[i].pageY - this.canvasOffsetTop) / this.resizeRatio;
                canvasTouchCoords.push([canvasX, canvasY]);
            }
            this.refs.debugDiv.innerText = "canvasX:" + canvasX + "\ncanvasY:" + canvasY;
            let judgement;
            let judgeAreas = this.judge.getJudgeAreas(this.judgeAreaCenters, this.judgeAreaRadii,
                canvasTouchCoords);
            if (judgeAreas.length != 0) {
                for (let i of judgeAreas) {
                    if (this.judgeIndices[i] < this.allNotes[i].length) {
                        judgement = this.judge.getJudgement(touchTiming,
                            this.allNotes[i][this.judgeIndices[i]][0]);
                        this._executeJudgeEffect(judgement);
                        if (judgement != null) {
                            this.allNotes[i][this.judgeIndices[i]][3] = false;
                            this.judgeIndices[i]++;
                        }
                    }
                }
            }
        })
    }

    _executeJudgeEffect(judgement) {
        switch (judgement) {
            case "perfect":
                this.soundEffects.perfect.play();
                break;
            case "great":
                this.soundEffects.great.play();
                break;
            case "good":
                this.soundEffects.good.play();
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

    _getInitialThresholds() {
        let thresholdsIn = [];
        let thresholdsOut = [];
        for (let i = 0; i < this.allNoteIndices.length; i++) {
            let thresholdIn = 0;
            let thresholdOut = 0;
            for (let index of this.allNoteIndices[i]) {
                if (this.allNotes[i][index][1] < - this.renderRange) {
                    thresholdIn ++; thresholdOut ++;
                }
                else if (this.allNotes[i][index][1] < this.renderRange) {
                    thresholdIn ++;
                }
                else break;
            }
            thresholdsIn.push(thresholdIn);
            thresholdsOut.push(thresholdOut);
        }
        return [thresholdsIn, thresholdsOut];
    }

    _updateJudgeIndices(judgeIndices, gameTiming) {
        for (let i = 0; i < this.allNotes.length; i++) {
            for (let j = judgeIndices[i]; j < this.allNotes[i].length; j++) {
                if (gameTiming - this.allNotes[i][j][0] > this.judge.good) {
                    judgeIndices[i]++;
                }
                else break;
            }
        }
    }

    start() {
        console.log("renderGame");
        this.gameTiming = 0;
        let gamePosition, lastGamePosition = 0;
        let thresholds = this._getInitialThresholds(); // 屏幕边界处的note索引
        //this.addMouseMoveEventListener();
        this.addTouchMoveEventListener();

        let frameCount = 0;
        let now, elapsed;
        // this.music.play();
        this.startTiming = Date.now();
        let then = this.startTiming;
        // count FPS
        let lastFPSCountTiming = then;
        let lastFrameCount = 0;

        let that = this;
        (function animate() {
            requestAnimationFrame(animate);
            now = Date.now();
            elapsed = now - then;
            //if (elapsed > that.frameInterval) {
            frameCount ++;
            if (now - lastFPSCountTiming > 1000) {
                let fps = (frameCount - lastFrameCount) * 1000 / (now - lastFPSCountTiming);
                //console.log(fps);
                that.refs.fpsCounterDiv.innerText = "fps:" + fps;

                lastFrameCount = frameCount;
                lastFPSCountTiming = now;
            }
            then = now - (elapsed % that.frameInterval);
            that.gameTiming = now - that.startTiming;
            gamePosition = that._getPosition(that.gameTiming, that.speedLines,
                0, that.speedLines.length-1, that.baselineHiSpeed);
            that._updateJudgeIndices(that.judgeIndices, that.gameTiming);
            that._renderOneFrame(gamePosition, lastGamePosition, that.renderRange, thresholds);
            lastGamePosition = gamePosition;
            //}
        })();
    }

    _renderOneFrame(gamePosition, lastGamePosition, renderRange, thresholds) {
        let indexIn, indexOut;
        let notePos;
        if (gamePosition > lastGamePosition) {
            for (let i = 0; i < 9; i++) {
                indexIn = thresholds[0][i];
                for (let j = indexIn; j < this.allNoteIndices[i].length; j++) {
                    notePos = this.allNotes[i][this.allNoteIndices[i][j]][1];
                    if (notePos < gamePosition + renderRange) {
                        thresholds[0][i]++;
                    } else break;
                }
                indexOut = thresholds[1][i];
                for (let j = indexOut; j < this.allNoteIndices[i].length; j++) {
                    notePos = this.allNotes[i][this.allNoteIndices[i][j]][1];
                    if (notePos < gamePosition - renderRange) {
                        thresholds[1][i]++;
                    } else break;
                }
            }
        }
        else {
            for (let i = 0; i < 9; i++) {
                indexIn = thresholds[0][i];
                for (let j = indexIn - 1; j >= 0; j--) {
                    notePos = this.allNotes[i][this.allNoteIndices[i][j]][1];
                    if (notePos > gamePosition + renderRange) {
                        thresholds[0][i]--;
                    } else break;
                }
                indexOut = thresholds[1][i];
                for (let j = indexOut - 1; j >= 0; j--) {
                    notePos = this.allNotes[i][this.allNoteIndices[i][j]][1];
                    if (notePos > gamePosition - renderRange) {
                        thresholds[1][i]--;
                    } else break;
                }
            }
        }

        this.refs["gameCanvas"].getContext("2d").clearRect(0, 0, 1024, 682);

        for (let i = 0; i < 9; i++) {
            for (let j = thresholds[1][i]; j < thresholds[0][i]; j++) {
                if (this.allNotes[i][this.allNoteIndices[i][j]][3]) {
                    notePos = this.allNotes[i][this.allNoteIndices[i][j]][1];
                    this._drawNote(this.startPoints[i][0], this.startPoints[i][1],
                        this.judgeAreaCenters[i][0], this.judgeAreaCenters[i][1],
                        notePos, gamePosition, renderRange);
                }
            }
        }

    }

    _drawNote(startX, startY, destX, destY, notePosition, gamePosition, renderRange) {
        let finishedDistanceRatio = (gamePosition - notePosition + renderRange) / renderRange;
        let noteX = startX + (destX - startX) * finishedDistanceRatio;
        let noteY = startY + (destY - startY) * finishedDistanceRatio;
        let noteSizeRatio = finishedDistanceRatio > 1 ? 1 : finishedDistanceRatio;
        let noteLeft = noteX - 68 * noteSizeRatio;
        let noteTop = noteY - 68 * noteSizeRatio;
        let noteSize = 136 * noteSizeRatio;
        this.refs.gameCanvas.getContext("2d").drawImage(
            this.skinImage, 396, 15, 128, 128,
            noteLeft, noteTop, noteSize, noteSize);
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

}
