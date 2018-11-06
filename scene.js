

class Scene {
    constructor(cvsWidth, cvsHeight, scalingLL=1.5, scalingL=1.2, scalingM=1.0, scalingS=0.8, scalingSS=0.66) {
        this.cvsWidth = cvsWidth;
        this.cvsHeight = cvsHeight;
        this.scalingLL = scalingLL;
        this.scalingL = scalingL;
        this.scalingM = scalingM;
        this.scalingS = scalingS;
        this.scalingSS = scalingSS;
        this.controller = null;

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
        this.effectCvs = document.createElement("canvas");
        this.touchCvs = document.createElement("canvas");

        this.bgCtx = this.bgCvs.getContext("2d");
        this.jdgAreaCtx = this.jdgAreaCvs.getContext("2d");
        this.beatmapCtx = this.beatmapCvs.getContext("2d");
        this.effectCtx = this.effectCvs.getContext("2d");

        this.bgCvs.style.zIndex = 0;
        this.jdgAreaCvs.style.zIndex = 1;
        this.beatmapCvs.style.zIndex = 2;
        this.effectCvs.style.zIndex = 3;
        this.touchCvs.style.zIndex = 4;

        document.body.appendChild(this.gameDiv);
        this.gameDiv.appendChild(this.bgCvs);
        this.gameDiv.appendChild(this.jdgAreaCvs);
        this.gameDiv.appendChild(this.beatmapCvs);
        this.gameDiv.appendChild(this.effectCvs);
        this.gameDiv.appendChild(this.touchCvs);

        this._setCanvas(this.bgCvs);
        this._setCanvas(this.jdgAreaCvs);
        this._setCanvas(this.beatmapCvs);
        this._setCanvas(this.effectCvs);
        this._setCanvas(this.touchCvs);

        this._resize();
        window.onresize = () => this._resize();
    }

    initStartButton() {
        this.startDiv = document.createElement("div");
        this.gameDiv.appendChild(this.startDiv);
        this._setStartDiv(this.startDiv);
    }

    setController(controller) {
        this.controller = controller;
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
        if (this.lanePaths.length == 0) {
            console.error("need lanePaths initialized!")
        }
        this.jdgAreaCtx.fillStyle = "#FFE699";
        for (let lanePath of this.lanePaths) {
            let circle = lanePath.jdgCircle;
            this.jdgAreaCtx.beginPath();
            this.jdgAreaCtx.arc(circle.centerX, circle.centerY, circle.radius, 0, 360);
            this.jdgAreaCtx.fill();
            this.jdgAreaCtx.closePath();
        }
    }

    animate() {
        if (this.controller.update()) {
            this._drawBeatmapFrame(this.controller.beatmap);
        }
        requestAnimationFrame(this.animate.bind(this));
    }

    getDefaultOneHot() {
        return new Array(this.lanePaths.length).fill(false);
    }

    addActive(oneHotArr, touchX, touchY, area) {
        let widthScalingInclude, heightScalingInclude, widthScalingExcept, heightScalingExcept = null;
        if (area == "fanL_L") {
            widthScalingInclude = this.scalingL;
            heightScalingInclude = this.scalingL;
        }
        else if (area == "fanSS_L") {
            widthScalingInclude = this.scalingSS;
            heightScalingInclude = this.scalingL;
        }
        else if (area == "fanLL-SS_LL-L") {
            widthScalingInclude = this.scalingLL;
            heightScalingInclude = this.scalingLL;
            widthScalingExcept = this.scalingSS;
            heightScalingExcept = this.scalingL;
        }
        else {
            console.error("area type error");
        }
        for (let idx in this.lanePaths) {
            oneHotArr[idx] = oneHotArr[idx] ||
                this.lanePaths[idx].checkInsideFan(touchX, touchY,
                    widthScalingInclude, heightScalingInclude, widthScalingExcept, heightScalingExcept);
        }
    }

    page2cvsX(pageX) {
        return (pageX - this.cvsOffsetLeft) / this.scaling;
    }

    page2cvsY(pageY) {
        return (pageY - this.cvsOffsetTop) / this.scaling;
    }

    _drawBeatmapFrame(beatmap) {
        this.beatmapCtx.clearRect(0, 0, this.cvsWidth, this.cvsHeight);
        this.effectCtx.clearRect(0, 0, this.cvsWidth, this.cvsHeight);
        for (let laneIdx in beatmap.lanes) {
            let lane = beatmap.lanes[laneIdx];
            let lanePath = this.lanePaths[laneIdx];
            for (let ptr = lane.backPtrOfIPO; ptr < lane.frontPtrOfIPO; ptr++) {
                let noteIdx = lane.indicesInPosOrd[ptr];
                let note = lane.notesInTmgOrd[noteIdx];
                if (!note.isPassed()) {
                    //console.log(laneIdx, "draw note");
                    this._drawNote(note, beatmap.getCurrPos(note.group), lanePath.startCircle, lanePath.jdgCircle);
                }
            }
            let timeOut = 0;
            for (let effect of lanePath.effects) {
                timeOut += this._drawEffect(effect[0], effect[1], lanePath.jdgCircle);
            }
            for (let i = 0; i < timeOut; i++) {
                lanePath.removeEffect();
            }
        }
    }

    _drawEffect(effectType, effectStartTmg, effectStartCircle, effectDuring=200) {
        let spr, startScaling, endScaling;
        let effectTmg = this.controller.frameTmg - effectStartTmg;
        let alpha = 1 - effectTmg / effectDuring;
        alpha = alpha < 0 ? 0 : alpha;
        let effectCenterX = effectStartCircle.centerX;
        let effectCenterY = effectStartCircle.centerY;
        switch (effectType) {
            case 3:
                spr = this.skinData["perfectSpr"];
                startScaling = 1; endScaling = 2.2;
                break;
            case 2:
                spr = this.skinData["greatSpr"];
                startScaling = 1; endScaling = 1.7;
                break;
            case 1:
                spr = this.skinData["goodSpr"];
                startScaling = 1; endScaling = 1.7;
                break;
            default:
                console.error("effect type 0!");
                break;
        }
        let scaling = startScaling + (endScaling - startScaling) * (effectTmg / effectDuring);
        let effectR = effectStartCircle.radius * scaling;
        this.effectCtx.globalAlpha = alpha;
        this.effectCtx.drawImage(
            this.skinImage, spr["left"], spr["top"], spr["width"], spr["height"],
            effectCenterX - effectR, effectCenterY - effectR, effectR*2, effectR*2);
        return effectTmg < effectDuring ? 0 : 1;
    }

    _drawNote(note, gamePos, startCircle, jdgCircle) {
        //console.log("draw");
        let scalingFromStart = gamePos - note.pos + 1; // finishedDist / AllDist
        let noteCircle = Circle.getScaledCircle(startCircle, jdgCircle, scalingFromStart);
        if (note.isHold) {
            let headCircle, tailCircle;
            let drawHead = true;
            if (note.tailPos < gamePos + 1) {
                let tailScalingFromStart = gamePos - note.tailPos + 1;
                tailCircle = Circle.getScaledCircle(startCircle, jdgCircle, tailScalingFromStart);
            } else {
                tailCircle = startCircle;
            }
            if (note.isJudging()) {
                headCircle = jdgCircle;
                drawHead = false;
            } else {
                headCircle = noteCircle;
            }
            if (drawHead) {
                this._drawNoteSkin(headCircle, note.type, note.multiMark);
            }
            this._drawHoldLight(headCircle, tailCircle, note.tmg, note.isHold && note.isJudging());
            this._drawHoldTail(tailCircle);
        } else {
            this._drawNoteSkin(noteCircle, note.type, note.multiMark);
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

    _drawHoldLight(headCircle, tailCircle, noteTmg, isholding, featherRatio=0.05, segment=10) {
        let headX = headCircle.centerX, headY = headCircle.centerY;
        let headR = headCircle.radius;
        let tailX = tailCircle.centerX, tailY = tailCircle.centerY;
        let tailR = tailCircle.radius;
        let D = Math.sqrt((tailX-headX)*(tailX-headX) + (tailY-headY)*(tailY-headY));
        let headR_D = headR / D, tailR_D = tailR / D;
        let head1X = headX + (headY - tailY) * headR_D, head1Y = headY - (headX - tailX) * headR_D;
        let head2X = headX - (headY - tailY) * headR_D, head2Y = headY + (headX - tailX) * headR_D;
        let tail1X = tailX + (headY - tailY) * tailR_D, tail1Y = tailY - (headX - tailX) * tailR_D;
        let tail2X = tailX - (headY - tailY) * tailR_D, tail2Y = tailY + (headX - tailX) * tailR_D;
        let delta1X = (tail1X - head1X) * featherRatio / segment, delta1Y = (tail1Y - head1Y) * featherRatio / segment;
        let delta2X = (tail2X - head2X) * featherRatio / segment, delta2Y = (tail2Y - head2Y) * featherRatio / segment;
        let deltaAlpha = 0.5 / segment, alphaRatio = 1;
        let colorStr = "rgba(255, 251, 245, ", endStr = ")";
        if (isholding) {
            let timeHolded = this.controller.frameTmg - noteTmg;
            alphaRatio = Math.cos(timeHolded / 200) * 0.4 + 0.6;
            colorStr = "rgba(247, 238, 200, ";
        }
        for (let i = 0; i < segment; i++) {
            this._fillQuadrangle(colorStr + (i+1)*deltaAlpha*alphaRatio + endStr,
                                 head1X + i*delta1X, head1Y + i*delta1Y,
                                 head2X + i*delta2X, head2Y + i*delta2Y,
                                 head2X + (i+1)*delta2X, head2Y + (i+1)*delta2Y,
                                 head1X + (i+1)*delta1X, head1Y + (i+1)*delta1Y);
            this._fillQuadrangle(colorStr + (i+1)*deltaAlpha*alphaRatio + endStr,
                                 tail1X - i*delta1X, tail1Y - i*delta1Y,
                                 tail2X - i*delta2X, tail2Y - i*delta2Y,
                                 tail2X - (i+1)*delta2X, tail2Y - (i+1)*delta2Y,
                                 tail1X - (i+1)*delta1X, tail1Y - (i+1)*delta1Y);
        }
        this._fillQuadrangle(colorStr + 0.5*alphaRatio + endStr,
                             head1X + segment*delta1X, head1Y + segment*delta1Y,
                             head2X + segment*delta2X, head2Y + segment*delta2Y,
                             tail2X - segment*delta2X, tail2Y - segment*delta2Y,
                             tail1X - segment*delta1X, tail1Y - segment*delta1Y);
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


    _fillQuadrangle(rgbaStr, pt1x, pt1y, pt2x, pt2y, pt3x, pt3y, pt4x, pt4y) {
        this.beatmapCtx.fillStyle = rgbaStr;
        this.beatmapCtx.beginPath();
        this.beatmapCtx.moveTo(pt1x, pt1y);
        this.beatmapCtx.lineTo(pt2x, pt2y);
        this.beatmapCtx.lineTo(pt3x, pt3y);
        this.beatmapCtx.lineTo(pt4x, pt4y);
        this.beatmapCtx.closePath();
        this.beatmapCtx.fill();
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

    _setCanvas(cvs) {
        cvs.width = this.cvsWidth;
        cvs.height = this.cvsHeight;
        cvs.style.width = "100%";
        cvs.style.height = "100%";
    }

    _setStartDiv(div) {
        div.style.left = "42%";
        div.style.top = "40%";
        div.style.width = "16%";
        div.style.height = "10%";
        div.style.zIndex = 10;

        div.style.color = "white";
        div.style.fontSize = "30px";
        div.style.textAlign = "center";
        div.innerText = "Start!";
        div.addEventListener("click", () => {
            div.style.zIndex = -1;
            this.controller.start(this);
        });
    }

}

class LanePath {
    constructor(startX, startY, startR, destX, destY, destR) {
        this.startCircle = new Circle(startX, startY, startR);
        this.jdgCircle = new Circle(destX, destY, destR);

        this.refPointX = null;
        this.refPointY = null;
        this.jdgCenterRho = null;
        this.jdgCenterPhi = null;
        this.thresholdAngle = null;
        this.effects = [];

        this._setRefPoint();
        this._setRhoPhi();
        this._setThresholdAngle()
    }

    _setRefPoint() {
        this.refPointX = this.startCircle.centerX + (this.startCircle.centerX - this.jdgCircle.centerX) *
            this.startCircle.radius / (this.startCircle.radius - this.jdgCircle.radius);
        this.refPointY = this.startCircle.centerY + (this.startCircle.centerY - this.jdgCircle.centerY) *
            this.startCircle.radius / (this.startCircle.radius - this.jdgCircle.radius);
    }

    _setRhoPhi() {
        let dx = this.jdgCircle.centerX - this.refPointX;
        let dy = this.jdgCircle.centerY - this.refPointY;

        this.jdgCenterRho = Math.sqrt(dx * dx + dy * dy);
        this.jdgCenterPhi = Math.atan2(dy, dx);
    }

    _setThresholdAngle() {
        this.thresholdAngle = Math.asin(this.jdgCircle.radius / this.jdgCenterRho);
    }

    _getPolarCoords(x, y) {
        let dx = x - this.refPointX;
        let dy = y - this.refPointY;
        let rho = Math.sqrt(dx * dx + dy * dy);
        let phi = Math.atan2(dy, dx);
        return [rho, phi];
    }

    checkInsideFan(x, y, widthScalingInclude, heightScalingInclude, widthScalingExcept=null, heightScalingExcept=null) {
        let res = this._getPolarCoords(x, y);
        let rho = res[0], phi = res[1];
        if (phi - this.jdgCenterPhi > Math.PI) {
            phi -= 2 * Math.PI;
        } else if (phi - this.jdgCenterPhi < - Math.PI) {
            phi += 2 * Math.PI;
        }
        let isInside = rho > this.jdgCenterRho - this.jdgCircle.radius * heightScalingInclude &&
                       rho < this.jdgCenterRho + this.jdgCircle.radius * heightScalingInclude &&
                       phi > this.jdgCenterPhi - this.thresholdAngle * widthScalingInclude &&
                       phi < this.jdgCenterPhi + this.thresholdAngle * widthScalingInclude;
        if (widthScalingExcept != null && heightScalingExcept != null) {
            isInside = (rho < this.jdgCenterRho - this.jdgCircle.radius * heightScalingExcept ||
                        rho > this.jdgCenterRho + this.jdgCircle.radius * heightScalingExcept ||
                        phi < this.jdgCenterPhi - this.thresholdAngle * widthScalingExcept ||
                        phi > this.jdgCenterPhi + this.thresholdAngle * widthScalingExcept) &&
                        isInside;
        } else if (widthScalingExcept != null) {
            isInside = (phi < this.jdgCenterPhi - this.thresholdAngle * widthScalingExcept ||
                        phi > this.jdgCenterPhi + this.thresholdAngle * widthScalingExcept) &&
                        isInside;
        } else if (heightScalingExcept != null) {
            isInside = (rho < this.jdgCenterRho - this.jdgCircle.radius * heightScalingExcept ||
                        rho > this.jdgCenterRho + this.jdgCircle.radius * heightScalingExcept) &&
                        isInside;
        }
        return isInside;
    }

    pushEffect(effectType, effectStartTmg) {
        this.effects.push([effectType, effectStartTmg]);
    }

    removeEffect() {
        this.effects.shift();
    }

}

class Effect {
    constructor(effectType, effectStartTmg) {
        this.type = effectType;
        this.startTmg = effectStartTmg;
    }
}

class Circle {
    constructor(centerX, centerY, radius) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.radius = radius;
    }

    checkInside(touchX, touchY, scalingInclude, scalingExcept=null) {
        let dX = touchX - this.centerX;
        let dY = touchY - this.centerY;
        if (scalingExcept == null) {
            return dX*dX + dY*dY < this.radius * this.radius * scalingInclude * scalingInclude;
        } else {
            return dX*dX + dY*dY < this.radius * this.radius * scalingInclude * scalingInclude &&
                dX*dX + dY*dY > this.radius * this.radius * scalingExcept * scalingExcept;
        }
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

function getSquareD(x1, y1, x2, y2) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
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
        jdgCircleRadii.push(destR);
    }
    return [startCircleCenters, startCircleRadii, jdgCircleCenters, jdgCircleRadii];
}

Effect.endScaling = 2;
Effect.thickness = 0.1;