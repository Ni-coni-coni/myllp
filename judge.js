class Judge {

    constructor() {
        this.perfect = 30;
        this.great = 60;
        this.good = 120;
    }

    isInJudgeArea(judgeAreaCenters, radii, canvasX, canvasY) {
        let judgeAreas = [];
        let dX, dY, distance;
        for (let i = 0; i < judgeAreaCenters.length; i++) {
            dX = canvasX - judgeAreaCenters[i][0];
            dY = canvasY - judgeAreaCenters[i][1];
            distance = Math.pow(dX*dX + dY*dY, 0.5);
            if (distance < radii[i]) judgeAreas.push(i);
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
