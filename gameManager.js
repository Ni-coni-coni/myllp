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
        
        // 可能需要重构的部分
        this.fps = 60;
        this.frameInterval = 1000 / this.fps;
        this.notes = [];
        this.notesDestination = [[], [], [], [], [], [], [], [], []];
        this.notesToRender = [];
        this.notesBefore = [];
        this.notesAfter = [];
        this.speedLines = [];
        this.gameTiming = null;
        this.gamePosition = null;
        this.baselineHiSpeed = 0.2;
        this.offset = 0;
        this.renderRange = 425;
        this.resizeRatio = 1;
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
        }).then(([beatmap]) => { //以后也许重构
            this.offset = beatmap.offset;
            // fill speed line array,
            // speedLines[i][0] means timing of i-th speed line(with offset),
            // speedLines[i][1] means speed line position in hi-speed-based beatmap of i-th speed line
            // speedLines[i][2] means speed ratio between i-th speed line and (i+1)-th or the end.
            // first set a baseline speed line of 0 timing(with offset)
            this.speedLines.push([0, 0, beatmap.originSpeedRatio]);
            let prevSpeedLine = this.speedLines[0];
            for (let speedLineObj of beatmap.speed) {
                let oneSpeedLine = new Array(3);
                oneSpeedLine[0] = speedLineObj.speedChangeTiming + this.offset;
                oneSpeedLine[1] = this.baselineHiSpeed * prevSpeedLine[2] * (oneSpeedLine[0] - prevSpeedLine[0]) +
                    prevSpeedLine[1];
                oneSpeedLine[2] = speedLineObj.speedRatio;
                this.speedLines.push(oneSpeedLine);
                prevSpeedLine = oneSpeedLine;
            }
            // fill note array,
            // notes[i][0] means timing of i-th note(with offset),
            // notes[i][1] means position of i-th note(in hi-speed-based beatmap),
            // notes[i][2] means destination of i-th note.
            // notes[i][3] means index.
            let currSpeedLineIdx = 0;
            let prevSpeedLineIdx = 0;
            let accumulatedDist = 0;
            for (let noteObj of beatmap.notes) {
                let oneNote = new Array(3);
                let i = 0;
                oneNote[0] = noteObj.noteTiming + this.offset;
                // get current speed line index(the speed line just before current note).
                while (currSpeedLineIdx < this.speedLines.length && oneNote[0] > this.speedLines[currSpeedLineIdx][0]) {
                    currSpeedLineIdx ++;
                }
                currSpeedLineIdx --;
                // accumulate distance(in hi-speed-based beatmap) from previous speed line to the current.
                for (let j = prevSpeedLineIdx; j < currSpeedLineIdx; j ++) {
                    accumulatedDist += this.speedLines[j][2] * this.baselineHiSpeed *
                        (this.speedLines[j+1][0] - this.speedLines[j][0]);
                }
                // calculate the position of current note(in hi-speed-based beatmap) and push into array.
                oneNote[1] = accumulatedDist + this.speedLines[currSpeedLineIdx][2] * this.baselineHiSpeed *
                    (oneNote[0] - this.speedLines[currSpeedLineIdx][0]);
                this.notes.push(oneNote);
                // record previous speed line for next loop.
                prevSpeedLineIdx = currSpeedLineIdx;
                oneNote[2] = noteObj.destination;
                oneNote[3] = i;
                i += 1;
            }
            // console.log("check inited speedlines and notes");
            // console.log(this.speedLines);
            // console.log(this.notes);

            // fill notesDestination array,
            // notesDestination[i][j][0] means the timing of j-th note of i-th destination,
            // notesDestination[i][j][1] means the timing of j-th note of i-th destination.
            for (let noteObj of this.notes) {
                console.log(noteObj[2]);
                let oneNoteInCertainDestination = new Array(2);
                oneNoteInCertainDestination[0] = noteObj[0];
                oneNoteInCertainDestination[1] = noteObj[3];
                this.notesDestination[1].push(oneNoteInCertainDestination);
            }
            console.log(this.notesDestination);

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
        for (let i = 1; i <= 9; i ++) {
            this._addCircleDiv(
                notesStartX + distance * Math.cos(pi + angle * (i - 1)),
                notesStartY - distance * Math.sin(pi + angle * (i - 1)),
                diameter, "circle" + i, "circleDiv"
            );
        }
        this._addCircleDiv(
            notesStartX,
            notesStartY,
            0, "startPoint", "circleDiv"
        );
    }

    _addCircleDiv(centerX, centerY, diameter, id, className) {
        let circleDiv = document.createElement("div");
        circleDiv.className = className;
        circleDiv.id = id;
        circleDiv.style.currentPosition = "absolute";
        circleDiv.style.display = "block";
        circleDiv.style.background = "yellow";
        circleDiv.style.width = diameter / 1024 * 100 + "%";
        circleDiv.style.height = diameter / 682 * 100 + "%";
        circleDiv.style.left = (centerX - diameter / 2) / 1024 * 100 + "%";
        circleDiv.style.top = (centerY - diameter / 2) / 682 * 100 + "%";
        this.refs["gameDiv"].appendChild(circleDiv);
    }

    start() { //以后可能重构
        console.log("renderGame");
        let currSpeedLineIdx = 0;
        let prevSpeedLineIdx = 0;
        let accumulatedDist = 0;
        // initialize game and notes to render in first frame.
        this.gameTiming = 0;
        this.gamePosition = 0;
        let index;
        for (index = 0; index < this.notes.length && this.notes[index][1] < this.renderRange; index ++) {
            if (this.notes[index][1] > - this.renderRange) {
                this.notesToRender.push(this.notes[index]);
            }
        }
        // put the rest notes into notesAfter array(inverse it for efficiency).
        for (let i = this.notes.length - 1; i >= index; i--) {
            this.notesAfter.push(this.notes[i]);
        }

        // console.log("check notesBefore: ");
        // console.log(this.notesBefore);
        // console.log("check notesAfter: ");
        // console.log(this.notesAfter);
        // console.log("check notesToRender2: ");
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

                // calculate current game position the same as the part of initialization.
                while (currSpeedLineIdx < that.speedLines.length && that.gameTiming > that.speedLines[currSpeedLineIdx][0]) {
                    currSpeedLineIdx ++;
                }
                currSpeedLineIdx --;
                for (let j = prevSpeedLineIdx; j < currSpeedLineIdx; j ++) {
                    accumulatedDist += that.speedLines[j][2] * that.baselineHiSpeed *
                        (that.speedLines[j+1][0] - that.speedLines[j][0]);
                }
                that.gamePosition = accumulatedDist + that.speedLines[currSpeedLineIdx][2] * that.baselineHiSpeed *
                    (that.gameTiming - that.speedLines[currSpeedLineIdx][0]);
                prevSpeedLineIdx = currSpeedLineIdx;

                that._renderOneFrame(that.gamePosition, that.notesToRender, that.notesBefore, that.notesAfter);
            }
        })();
    }

    _renderOneFrame(gamePosition, notesToRender, notesBefore, notesAfter) {

        // shift notes from notesAfter[] into notesToRender[]
        for (let i = notesAfter.length - 1; i >= 0; i--) {
            if (notesAfter[i][1] < gamePosition + this.renderRange) {
                notesToRender.push(notesAfter.pop());
            } else break;
        }

        // shift notes from notesToRender[] into notesBefore[]
        for (let i = 0; i < notesToRender.length - 1; i++) {
            if (notesToRender[i][1] < gamePosition - this.renderRange) {
                notesBefore.push(notesToRender.shift());
            } else break;
        }

        // shift notes from notesToRender[] into notesAfter[]
        for (let i = notesToRender.length - 1; i >= 0; i--) {
            if (notesToRender[i][1] > gamePosition + this.renderRange) {
                notesAfter.push(notesToRender.pop());
            } else break;
        }

        // shift notes from notesBefore[] into notesToRender[]
        for (let i = notesBefore.length - 1; i >= 0; i--) {
            if (notesBefore[i][1] > gamePosition - this.renderRange) {
                notesToRender.unshift(notesBefore.pop());
            } else break;
        }

        this.refs["gameCanvas"].getContext("2d").clearRect(0, 0, 1024, 682);

        for (let index in notesToRender) {
            //以后用事先定义好的touchAreaCenterPoints[]
            var circleDiv = document.getElementById("circle" + notesToRender[index][2]);
            var startPoint = document.getElementById("startPoint");
            this._drawNote(startPoint.offsetLeft / this.resizeRatio, startPoint.offsetTop / this.resizeRatio,
                (circleDiv.offsetLeft + circleDiv.offsetWidth / 2) / this.resizeRatio,
                (circleDiv.offsetTop + circleDiv.offsetHeight / 2) / this.resizeRatio,
                notesToRender[index][1], gamePosition
            );
        }
        
    }

    _drawNote(startX, startY, destX, destY, notePosition, gamePosition) {
        let finishedDistanceRatio = (gamePosition - notePosition + this.renderRange) / this.renderRange;
        let noteX = startX + (destX - startX) * finishedDistanceRatio;
        let noteY = startY + (destY - startY) * finishedDistanceRatio;
        let noteSizeRatio = finishedDistanceRatio > 1 ? 1 : finishedDistanceRatio;
        // if (noteSizeRatio < 0) {
        //     noteSizeRatio = 0;
        // } //fix afterwards
        let noteLeft = noteX - 68 * noteSizeRatio;
        let noteTop = noteY - 68 * noteSizeRatio;
        let noteSize = 136 * noteSizeRatio;
        if(destX == 87){
            console.log(startX, startY, destX, destY, noteLeft, noteTop, noteSize);
        }
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
