class Judge {

    constructor() {
        this.perfect = 30;
        this.great = 60;
        this.good = 120;
    }

    getJudgeAreas(judgeAreaCenters, radii, canvasTouchCoords) {
        let judgeAreas = [];
        let oneHot = [false, false, false, false, false, false, false, false, false];
        let dX, dY, distance;
        for (let i = 0; i < judgeAreaCenters.length; i++) {
            for (let touch of canvasTouchCoords) {
                dX = touch[0] - judgeAreaCenters[i][0];
                dY = touch[1] - judgeAreaCenters[i][1];
                distance = Math.pow(dX*dX + dY*dY, 0.5);
                if (distance < radii[i]) {
                    oneHot[i] = true;
                }
            }
        }
        for (let i = 0; i < judgeAreaCenters.length; i++) {
            if (oneHot[i] == true) judgeAreas.push(i);
        }
        return judgeAreas;
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




}
