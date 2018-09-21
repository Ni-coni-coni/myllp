
setCoordinates(startX, startY, destR) {
    let distance = this.renderRange;
    let pi = Math.PI;
    let angle = pi / 8;
    let radius = destR;
    let centerX, centerY;
    for (let i = 0; i < 9; i ++) {
        centerX = startX + distance * Math.cos(pi + angle * i);
        centerY = startY - distance * Math.sin(pi + angle * i);
        this.judgeAreaCenters[i] = [centerX, centerY];
        this.startPoints[i] = [startX, startY];
        this.judgeAreaRadii[i] = radius;
    }
}

setCoordinatesMaiMai(startX, startY, destR) {
    let distance = this.renderRange;
    let pi = Math.PI;
    let angle = pi / 4;
    let radius = destR;
    let centerX, centerY;
    for (let i = 0; i < 9; i ++) {
        centerX = startX + distance * Math.cos(pi / 8 * 5 + angle * i);
        centerY = startY - distance * Math.sin(pi / 8 * 5 + angle * i);
        this.judgeAreaCenters[i] = [centerX, centerY];
        this.startPoints[i] = [startX, startY];
        this.judgeAreaRadii[i] = radius;
    }
}