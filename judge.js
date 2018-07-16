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

    getLanesToJudge(judgeAreaCenters, radii, canvasTouchCoords, ifOneHot=false) {
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
