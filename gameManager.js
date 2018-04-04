class Game {

    constructor() {

        this.refs = {
            gameDiv: document.getElementById("gameDiv"),
            bgCanvas: document.getElementById("bgCanvas"),
            gameCanvas: document.getElementById("gameCanvas")
        };

        this.loader = new Loader();

        this.music = null;
        this.bgImage = null;
        this.skinImage = null;

        this.status = null;

        this.fps = 60;
        this.frameInterval = 1000 / this.fps;
        this.notesToRender = [[], [], [], [], [], [], [], [], []];
        this.notesBefore = [[], [], [], [], [], [], [], [], []];
        this.notesAfter = [[], [], [], [], [], [], [], [], []];
        this.speedLines = [];
        this.baselineHiSpeed = 0.2;
        this.renderRange = 425;
        this.resizeRatio = 1;
        this.startPoints = [[], [], [], [], [], [], [], [], []];
        this.touchDivCenters =[[], [], [], [], [], [], [], [], []];

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
            this.refs["bgCanvas"].getContext("2d").fillStyle = "rgb(10,0,20)";
            this.refs["bgCanvas"].getContext("2d").fillRect(0, 0, 1024, 682);
            return this.loader.loadJson([
                "map/demo.json"
            ]);
        }).then(([beatmap]) => {
            // speedLines[i][0] means the timing of i-th speed line,
            // speedLines[i][1] means the speed ratio between i-th speed line and (i+1)-th or the end.
            // speedLines[i][2] means the position of i-th speed line.
            let position = 0;
            for (let i = 0; i < beatmap.speed.length; i++) {
                let oneSpeedLine = new Array(3);
                oneSpeedLine[0] = beatmap.speed[i].speedChangeTiming;
                oneSpeedLine[1] = beatmap.speed[i].speedRatio;
                oneSpeedLine[2] = position;
                this.speedLines.push(oneSpeedLine);
                if (i < beatmap.speed.length - 1) {
                    position += this.baselineHiSpeed * oneSpeedLine[1] * 
                        (beatmap.speed[i+1].speedChangeTiming - oneSpeedLine[0]);
                }
            }
            console.log(beatmap);
            // notesAfter[i][j][0] means the timing of j-th note of i-th destination,
            // notesAfter[i][j][1] means the position of j-th note of i-th destination,
            // notesAfter[i][j][2] means the type of j-th note of i-th destination.
            let allNotes = [[], [], [], [], [], [], [], [], []];
            let time = 0.0;
            for (let noteObj of beatmap.notes) {
                let oneNote = new Array(3);
                oneNote[0] = noteObj.noteTiming;
                oneNote[1] = this._getPosition(oneNote[0], this.speedLines,
                    0, this.speedLines.length-1, this.baselineHiSpeed);
                oneNote[2] = parseInt(noteObj.type);
                allNotes[parseInt(noteObj.destination)-1].push(oneNote);
            }
            console.log("check all speedlines and notes");
            console.log(this.speedLines);
            console.log(allNotes);
            // 遍历一次notesAfter，把timing=0屏幕内的note放入notesToRender，已出屏幕的放入notesBefore
            for (let i = 0; i < 9; i++) {
                for (let note of allNotes[i]) {
                    if (note[1] < -this.renderRange) {
                        this.notesBefore[i].push(note);
                    }
                    else if (note[1] < this.renderRange) {
                        this.notesToRender[i].push(note);
                    }
                    else {
                        this.notesAfter[i].push(note);
                    }
                }
                // 为了效率，将notesAfter[i]里的note颠倒顺序
                this.notesAfter[i].reverse();
            }
            console.log("check inited notes: before, toRender, after");
            console.log(this.notesBefore);
            console.log(this.notesToRender);
            console.log(this.notesAfter);
            this.initTouchArea();
            return this.start();
        });
    }

    initTouchArea() {
        let notesStartX = 512;
        let notesStartY = 170;
        let distance = 425;
        let pi = Math.PI;
        let angle = pi / 8;
        let diameter = 136;
        let centerX, centerY;
        for (let i = 0; i < 9; i ++) {
            centerX = notesStartX + distance * Math.cos(pi + angle * i);
            centerY = notesStartY - distance * Math.sin(pi + angle * i);
            this.touchDivCenters[i] = [centerX, centerY];
            this._addCircleDiv(centerX, centerY, diameter, "circle" + i, "circleDiv");
            this.startPoints[i] = [notesStartX, notesStartY];
        }
        console.log(this.refs);
    }

    _addCircleDiv(centerX, centerY, diameter, id, className) {
        let circleDiv = document.createElement("div");
        circleDiv.className = className;
        circleDiv.id = id;
        circleDiv.style.position = "absolute";
        circleDiv.style.display = "block";
        circleDiv.style.background = "yellow";
        circleDiv.style.width = diameter / 1024 * 100 + "px";
        circleDiv.style.height = diameter / 682 * 100 + "px";
        circleDiv.style.left = (centerX - diameter / 2) / 1024 * 100 + "px";
        circleDiv.style.top = (centerY - diameter / 2) / 682 * 100 + "px";
        this.refs.gameDiv.style.background = "yellow";
        this.refs.gameDiv.appendChild(circleDiv);
        this.refs[id] = circleDiv;
        circleDiv.addEventListener("mousedown", () => {
            alert("aaa");
        });
        window.onmouseover = () => {
            // alert("bbb");
        };
    }

    _initMouseEvent(div) {
        div.onmousedown = function() {
            alert("aaa");
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

    start() {
        console.log("renderGame");
        this.gameTiming = 0;
        let gamePosition, lastGamePosition = 0;

        // console.log("check notesAfter: ");
        // console.log(this.notesAfter);
        // console.log("check notesToRender: ");
        // console.log(this.notesToRender);

        let frameCount = 0;
        let now, elapsed;
        let startTiming = Date.now();
        let then = startTiming;
        let that = this;
        (function animate() {
            requestAnimationFrame(animate);
            now = Date.now();
            elapsed = now - then;
            if (elapsed > that.frameInterval) {
                frameCount ++;
                then = now - (elapsed % that.frameInterval);
                that.gameTiming = now - startTiming;
                gamePosition = that._getPosition(that.gameTiming, that.speedLines,
                    0, that.speedLines.length-1, that.baselineHiSpeed);
                that._renderOneFrame(gamePosition, lastGamePosition, that.renderRange,
                    that.notesToRender, that.notesBefore, that.notesAfter);
                lastGamePosition = gamePosition;
            }
        })();
    }

    _renderOneFrame(gamePosition, lastGamePosition, renderRange, notesToRender, notesBefore, notesAfter) {
        if (gamePosition > lastGamePosition) {
            for (let i = 0; i < 9; i++) {
                // from notesToRender[] to notesBefore[]
                for (let j = 0; j < notesToRender[i].length; j++) {
                    if (notesToRender[i][j][1] < gamePosition - renderRange) {
                        notesBefore[i].push(notesToRender[i].shift());
                    } else break;
                }
                // from notesAfter[] to notesToRender[]
                for (let j = notesAfter[i].length - 1; j >= 0; j--) {
                    if (notesAfter[i][j][1] < gamePosition + renderRange) {
                        notesToRender[i].push(notesAfter[i].pop());
                    } else break;
                }
            }
        }
        /*目前负速度线尚存问题
        else {
            for (let i = 0; i < 9; i++) {
                // from notesToRender[] to notesAfter[]
                for (let j = notesToRender[i].length - 1; j >= 0; j--) {
                    if (notesToRender[i][j][1] > gamePosition + renderRange) {
                        notesAfter[i].push(notesToRender[i].pop());
                    } else break;
                }
                // from notesBefore[] to notesToRender[]
                for (let j = notesBefore[i].length - 1; j >= 0; j--) {
                    if (notesBefore[i][j][1] > gamePosition - renderRange) {
                        notesToRender[i].unshift(notesBefore[i].pop());
                    } else break;
                }
            }
        }
        */

        this.refs["gameCanvas"].getContext("2d").clearRect(0, 0, 1024, 682);

        for (let i = 0; i < 9; i++) {
            for (let note of notesToRender[i]) {
                this._drawNote(this.startPoints[i][0], this.startPoints[i][1],
                    this.touchDivCenters[i][0], this.touchDivCenters[i][1],
                    note[1], gamePosition, renderRange);
            }
        }
        
    }

    _drawNote(startX, startY, destX, destY, notePosition, gamePosition, renderRange) {
        let finishedDistanceRatio = (gamePosition - notePosition + renderRange) / renderRange;
        let noteX = startX + (destX - startX) * finishedDistanceRatio;
        let noteY = startY + (destY - startY) * finishedDistanceRatio;
        let noteSizeRatio = finishedDistanceRatio > 1 ? 1 : finishedDistanceRatio;
        // if (noteSizeRatio < 0) {
        //     noteSizeRatio = 0;
        // } //fix afterwards
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
