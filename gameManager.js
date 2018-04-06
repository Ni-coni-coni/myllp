class Game {

    constructor() {

        this.refs = {
            gameDiv: document.getElementById("gameDiv"),
            bgCanvas: document.getElementById("bgCanvas"),
            judgePosCanvas: document.getElementById("judgePosCanvas"),
            gameCanvas: document.getElementById("gameCanvas")
        };

        this.loader = new Loader();
        this.judge = new Judge();

        this.music = null;
        this.bgImage = null;
        this.skinImage = null;
        this.startTiming = null;

        this.status = null;

        this.fps = 60;
        this.frameInterval = 1000 / this.fps;
        this.allNotes = [[], [], [], [], [], [], [], [], []];
        this.allNoteIndices = [[], [], [], [], [], [], [], [], []]; // position从小到大所对应的note索引
        this.speedLines = [];
        this.baselineHiSpeed = 0.2;
        this.renderRange = 425;
        this.resizeRatio = 1;
        this.startPoints = [[], [], [], [], [], [], [], [], []];
        this.judgeAreaCenters = [[], [], [], [], [], [], [], [], []];
        this.judgeAreaRadii = new Array(9);
        this.judgeIndices = [0, 0, 0, 0, 0, 0, 0, 0, 0];

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
            return this.loader.loadJson([
                "map/demo2.json"
            ]);
        }).then(([beatmap]) => {
            // speedLines[i][0] means the timing of i-th speed line,
            // speedLines[i][1] means the speed ratio between i-th speed line and (i+1)-th or the end.
            // speedLines[i][2] means the position of i-th speed line.
            let position = 0;
            for (let i = 0; i < beatmap.speedLines.length; i++) {
                let oneSpeedLine = new Array(3);
                oneSpeedLine[0] = beatmap.speedLines[i].speedChangeTiming;
                oneSpeedLine[1] = beatmap.speedLines[i].speedRatio;
                oneSpeedLine[2] = position;
                this.speedLines.push(oneSpeedLine);
                if (i < beatmap.speedLines.length - 1) {
                    position += this.baselineHiSpeed * oneSpeedLine[1] * 
                        (beatmap.speedLines[i+1].speedChangeTiming - oneSpeedLine[0]);
                }
            }
            console.log(beatmap);
            // notesAfter[i][j][0] means the timing of j-th note of i-th destination,
            // notesAfter[i][j][1] means the position of j-th note of i-th destination,
            // notesAfter[i][j][2] means the type of j-th note of i-th destination.
            // notesAfter[i][j][3] means the existence of j-th note of i-th destination.
            // notesAfter[i][j][4] means the position rank of j-th note of i-th destination.
            let noteTiming, notePosition, noteType, isExist, destination;
            for (let noteObj of beatmap.notes) {
                noteTiming = noteObj.noteTiming;
                notePosition = this._getPosition(noteTiming, this.speedLines,
                    0, this.speedLines.length-1, this.baselineHiSpeed);
                noteType = parseInt(noteObj.noteType);
                isExist = true;
                destination = parseInt(noteObj.destination) - 1;
                this.allNotes[destination].push([noteTiming, notePosition, noteType, isExist]);
                let index = this.allNotes[destination].length - 1;
                this.allNoteIndices[destination].push(index);
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
            let judgement;
            // console.log("x:" + canvasX);
            // console.log("y:" + canvasY);
            let judgeAreas = this.judge.isInJudgeArea(this.judgeAreaCenters, this.judgeAreaRadii,
                canvasX, canvasY);
            if (judgeAreas.length != 0) {
                for (let i of judgeAreas) {
                    if (this.judgeIndices[i] < this.allNotes[i].length) {
                        judgement = this.judge.getJudgement(touchTiming,
                            this.allNotes[i][this.judgeIndices[i]][0]);
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
        let thresholds = this._getInitialThresholds();
        this.addMouseEventListener();

        let frameCount = 0;
        let now, elapsed;
        this.startTiming = Date.now();
        let then = this.startTiming;
        let that = this;
        (function animate() {
            requestAnimationFrame(animate);
            now = Date.now();
            elapsed = now - then;
            if (elapsed > that.frameInterval) {
                frameCount ++;
                then = now - (elapsed % that.frameInterval);
                that.gameTiming = now - that.startTiming;
                gamePosition = that._getPosition(that.gameTiming, that.speedLines,
                    0, that.speedLines.length-1, that.baselineHiSpeed);
                that._updateJudgeIndices(that.judgeIndices, that.gameTiming);
                that._renderOneFrame(gamePosition, lastGamePosition, that.renderRange, thresholds);
                lastGamePosition = gamePosition;
            }
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
            this.resizeRatio = h / 682;
        } else {
            let gameDivHeight = w * ratio;
            this.refs["gameDiv"].style.width = w + "px";
            this.refs["gameDiv"].style.height = gameDivHeight + "px";
            this.refs["gameDiv"].style.left = "0px";
            this.refs["gameDiv"].style.top = (h - gameDivHeight) / 2 + "px";
            this.resizeRatio = w / 1024;
        }
    }

}
