class Controller {
    constructor(usrFPS) {
        this.usrFPS = usrFPS;
        this.fixedInterval = (usrFPS == null) ? null : 1000 / usrFPS;
        this.startTmg = null;

        this.gameTmg = null;
        this.frameNum = null;
        this.FPS = null;
    }

    start() {
        this.startTmg = Date.now();
        this.gameTmg = 0;
        this.frameNum = 0;
    }

    update(beatmap) {
        let gameTmgNow = Date.now() - this.startTmg;
        if (this.fixedInterval != null) {
            let elapsed = gameTmgNow - this.gameTmg;
            if (elapsed > this.fixedInterval) {
                gameTmgNow -= elapsed % this.fixedInterval;
            } else {
                return false;
            }
        }
        beatmap.updatePos(gameTmgNow);
        this.gameTmg = gameTmgNow;
        this.frameNum ++;
        return true;
    }

}
