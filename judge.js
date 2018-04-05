class Judge {

    constructor() {
        this.perfect = 30;
        this.good = 60;
        this.miss = 90;
    }

    static isInJudgeArea(judgeAreaCenters, radius, clientX, clientY) {
        let judgeAreaIndices = [];
        let dX, dY, distance;
        for (let i = 0; i < judgeAreaCenters.length; i++) {
            dX = clientX - judgeAreaCenters[i][0];
            dY = clientY - judgeAreaCenters[i][1];
            distance = Math.pow(dX*dX + dY*dY, 0.5);
            if (distance < radius) judgeAreaIndices.push(i);
        }
        if (judgeAreaIndices.length == 0) return false;
        else return judgeAreaIndices;
    }


}
