class Scene {
    constructor(cvsWidth, cvsHeight) {
        this.cvsWidth = cvsWidth;
        this.cvsHeight = cvsHeight;

        this.scaling = 1;
        this.cvsOffsetLeft = 0;
        this.cvsOffsetTop = 0;
        this.lanePaths = [];
    }

    createGameScene(bgImage, skinImage, skinData) {
        this.bgImage = bgImage;
        this.skinImage = skinImage;
        this.skinData = skinData;
        this.gameDiv = document.createElement("div");
        this.bgCvs = document.createElement("canvas");
        this.jdgAreaCvs = document.createElement("canvas");
        this.beatmapCvs = document.createElement("canvas");
        this.bgCtx = this.bgCvs.getContext("2d");
        this.jdgAreaCtx = this.jdgAreaCvs.getContext("2d");
        this.beatmapCtx = this.beatmapCvs.getContext("2d");
        this.bgCvs.style.zIndex = 0;
        this.jdgAreaCvs.style.zIndex = 1;
        this.beatmapCvs.style.zIndex = 2;
        document.body.appendChild(this.gameDiv);
        this.gameDiv.appendChild(this.bgCvs);
        this.gameDiv.appendChild(this.jdgAreaCvs);
        this.gameDiv.appendChild(this.beatmapCvs);

        _setCanvas(this.bgCvs, this.cvsWidth, this.cvsHeight);
        _setCanvas(this.jdgAreaCvs, this.cvsWidth, this.cvsHeight);
        _setCanvas(this.beatmapCvs, this.cvsWidth, this.cvsHeight);

        this._resize();
        window.onresize = () => this._resize();
    }

    initLanePaths() {
        let layoutDataArr = getCoordsSIF(512, 170, 0, 68, 425);
        let startCircleCenters = layoutDataArr[0];
        let startCircleRadii = layoutDataArr[1];
        let jdgCircleCenters = layoutDataArr[2];
        let jdgCircleRadii = layoutDataArr[3];
        for (let i = 0; i < jdgCircleCenters.length; i++) {
            this.lanePaths.push(new LanePath(
                startCircleCenters[i][0], startCircleCenters[i][1], startCircleRadii[i],
                jdgCircleCenters[i][0], jdgCircleCenters[i][1], jdgCircleRadii[i]
            ));
        }
    }

    drawBackGround() {
        this.bgCtx.drawImage(this.bgImage, 0, 0, this.cvsWidth, this.cvsHeight);
        this.bgCtx.fillStyle = "rgb(20,0,40)"; // TODO
        this.bgCtx.fillRect(0, 0, this.cvsWidth, this.cvsHeight);
    }

    drawJdgCircles() {
        this.jdgAreaCtx.fillStyle = "#FFE699";
        for (let lanePath of this.lanePaths) {
            let circle = lanePath.jdgCircle;
            this.jdgAreaCtx.beginPath();
            this.jdgAreaCtx.arc(circle.centerX, circle.centerY, circle.radius, 0, 360);
            this.jdgAreaCtx.fill();
            this.jdgAreaCtx.closePath();
        }
    }

    animate(beatmap, controller) {
        if (controller.update(beatmap)) {
            // this._updateJudgeIndices(beatmap);
            this._drawBeatmapFrame(beatmap);
        }
        requestAnimationFrame(this.animate.bind(this, beatmap, controller));
    }

    _drawBeatmapFrame(beatmap) {
        this.beatmapCtx.clearRect(0, 0, this.cvsWidth, this.cvsHeight);
        for (let group of beatmap.groups) {
            for (let laneIdx in group.lanes) {
                let lane = group.lanes[laneIdx];
                let lanePath = this.lanePaths[laneIdx];
                for (let ptr = lane.backPtrOfIPO; ptr < lane.frontPtrOfIPO; ptr++) {
                    let noteIdx = lane.indicesInPosOrd[ptr];
                    let note = lane.notesInTmgOrd[noteIdx];
                    if (note.isExist) {
                        //console.log(laneIdx, "draw note");
                        this._drawNote(note, group.currPos, lanePath.startCircle, lanePath.jdgCircle);
                    }
                }
            }
        }
    }

    _drawNote(note, gamePos, startCircle, jdgCircle) {
        //console.log("draw");
        let scalingFromStart = gamePos - note.pos + 1; // finishedDist / AllDist
        let noteCircle = Circle.getScaledCircle(startCircle, jdgCircle, scalingFromStart);
        if (note.noteType > 2) {
            let headCircle, tailCircle;
            let drawHead = true;
            if (note.tailPos > gamePos + 1) {
                let tailScalingFromStart = gamePos - note.tailPos + 1;
                tailCircle = Circle.getScaledCircle(startCircle, jdgCircle, tailScalingFromStart);
            } else {
                tailCircle = startCircle;
            }
            if (!note.isOnHold) {
                headCircle = noteCircle;
            } else {
                headCircle = jdgCircle;
                drawHead = false;
            }
            if (drawHead) {
                this._drawNoteSkin(headCircle, note.noteType, note.multiMark);
            }
            this._drawHoldLight(headCircle, tailCircle);
            this._drawHoldTail(tailCircle);
        } else {
            this._drawNoteSkin(noteCircle, note.noteType, note.multiMark);
        }
    }

    _drawNoteSkin(noteCircle, noteType, multiMark) {
        let spr;
        let noteX = noteCircle.centerX;
        let noteY = noteCircle.centerY;
        let noteR = noteCircle.radius;
        if (noteType == 0 || noteType == 3) {
            spr = this.skinData["noteSpr"];
        } else if (noteType == 1 || noteType == 4) {
            spr = this.skinData["slideNoteSpr"];
        }
        this.beatmapCtx.drawImage(
            this.skinImage, spr["left"], spr["top"], spr["width"], spr["height"],
            noteX - noteR, noteY - noteR, noteR*2, noteR*2);
        if (multiMark) {
            spr = this.skinData["multiMarkSpr"];
            let markWidthHalf = noteR;
            let markHeightHalf = (spr["height"] / spr["width"]) * noteR;
            this.beatmapCtx.drawImage(
                this.skinImage, spr["left"], spr["top"], spr["width"], spr["height"],
                noteX - markWidthHalf, noteY - markHeightHalf, markWidthHalf*2, markHeightHalf*2);
        }
    }

    _drawHoldLight(headCircle, tailCircle) {
        let headX = headCircle.centerX;
        let headY = headCircle.centerY;
        let headR = headCircle.centerY;
        let tailX = tailCircle.centerX;
        let tailY = tailCircle.centerY;
        let tailR = tailCircle.centerY;
        let D = Math.sqrt((tailX-headX)*(tailX-headX) + (tailY-headY)*(tailY-headY));
        let headR_D = headR / D;
        let tailR_D = tailR / D;
        let head1X = headX + (headY - tailY) * headR_D;
        let head1Y = headY - (headX - tailX) * headR_D;
        let head2X = headX - (headY - tailY) * headR_D;
        let head2Y = headY + (headX - tailX) * headR_D;
        let tail1X = tailX + (headY - tailY) * tailR_D;
        let tail1Y = tailY - (headX - tailX) * tailR_D;
        let tail2X = tailX - (headY - tailY) * tailR_D;
        let tail2Y = tailY + (headX - tailX) * tailR_D;
        this.beatmapCtx.fillStyle = "rgba(255, 251, 240, 0.5)";
        this.beatmapCtx.beginPath();
        this.beatmapCtx.moveTo(head1X, head1Y);
        this.beatmapCtx.lineTo(head2X, head2Y);
        this.beatmapCtx.lineTo(tail2X, tail2Y);
        this.beatmapCtx.lineTo(tail1X, tail1Y);
        this.beatmapCtx.closePath();
        this.beatmapCtx.fill();
    }

    _drawHoldTail(tailCircle) {
        let spr = this.skinData["tailSpr"];
        let tailX = tailCircle.centerX;
        let tailY = tailCircle.centerY;
        let tailR = tailCircle.radius;
        this.beatmapCtx.drawImage(
            this.skinImage, spr["left"], spr["top"], spr["width"], spr["height"],
            tailX - tailR, tailY - tailR, tailR*2, tailR*2);
    }

    _resize() {
        let ratio = this.cvsHeight / this.cvsWidth;
        let w = window.innerWidth;
        let h = window.innerHeight;
        if (h/w < ratio) {
            let gameDivWidth = h / ratio;
            this.gameDiv.style.width = gameDivWidth + "px";
            this.gameDiv.style.height = h + "px";
            this.gameDiv.style.left = (w - gameDivWidth) / 2 + "px";
            this.gameDiv.style.top = "0px";
            this.cvsOffsetLeft = (w - gameDivWidth) / 2;
            this.cvsOffsetTop = 0;
            this.scaling = h / 682;
        } else {
            let gameDivHeight = w * ratio;
            this.gameDiv.style.width = w + "px";
            this.gameDiv.style.height = gameDivHeight + "px";
            this.gameDiv.style.left = "0px";
            this.gameDiv.style.top = (h - gameDivHeight) / 2 + "px";
            this.cvsOffsetLeft = 0;
            this.cvsOffsetTop = (h - gameDivHeight) / 2;
            this.scaling = w / 1024;
        }
    }

}

class LanePath {
    constructor(startX, startY, startR, destX, destY, destR) {
        this.startCircle = new Circle(startX, startY, startR);
        this.jdgCircle = new Circle(destX, destY, destR);
    }
}

class Circle {
    constructor(centerX, centerY, radius) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.radius = radius;
    }

    static getScaledCircle(startCircle, endCircle, scalingFromStart) {
        let startX = startCircle.centerX;
        let startY = startCircle.centerY;
        let startR = startCircle.radius;
        let endX = endCircle.centerX;
        let endY = endCircle.centerY;
        let endR = endCircle.radius;
        let noteX = startX + (endX - startX) * scalingFromStart;
        let noteY = startY + (endY - startY) * scalingFromStart;
        let noteR = startR + (endR - startR) * scalingFromStart;
        return new Circle(noteX, noteY, noteR);
    }

}

function getCoordsSIF(startX=512, startY=170, startR=0, destR=68, laneLength=425) {
    let pi = Math.PI;
    let angle = pi / 8;
    let centerX, centerY;
    let startCircleCenters = [];
    let startCircleRadii = [];
    let jdgCircleCenters = [];
    let jdgCircleRadii = [];
    for (let i = 0; i < 9; i ++) {
        centerX = startX + laneLength * Math.cos(pi + angle * i);
        centerY = startY - laneLength * Math.sin(pi + angle * i);
        startCircleCenters.push([startX, startY]);
        startCircleRadii.push(startR);
        jdgCircleCenters.push([centerX, centerY]);
        jdgCircleRadii.push(destR)
    }
    return [startCircleCenters, startCircleRadii, jdgCircleCenters, jdgCircleRadii];
}

function getCoordsMaiMai(startX=512, startY=342, startR=0, destR=56, laneLength=260) {
    let pi = Math.PI;
    let angle = pi / 4;
    let centerX, centerY;
    let startCircleCenters = [];
    let startCircleRadii = [];
    let jdgCircleCenters = [];
    let jdgCircleRadii = [];
    for (let i = 0; i < 8; i ++) {
        centerX = startX + laneLength * Math.cos(pi / 8 * 5 + angle * i);
        centerY = startY - laneLength * Math.sin(pi / 8 * 5 + angle * i);
        startCircleCenters.push([startX, startY]);
        startCircleRadii.push(startR);
        jdgCircleCenters.push([centerX, centerY]);
        jdgCircleRadii.push(destR)
    }
    return [startCircleCenters, startCircleRadii, jdgCircleCenters, jdgCircleRadii];
}

function _setCanvas(cvs, width, height) {
    cvs.width = width;
    cvs.height = height;
    cvs.style.width = "100%";
    cvs.style.height = "100%";
}