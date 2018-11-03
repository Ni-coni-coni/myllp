class Controller {
    constructor(usrFPS) {
        this.usrFPS = usrFPS;
        this.fixedInterval = (usrFPS == null) ? null : 1000 / usrFPS;
        this.beatmap = null;
        this.music = null;
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
        this.startTmg = null;

        this.frameTmg = null;
        this.frameNum = null;
        this.FPS = null;
    }

    setBeatmap(beatmap) {
        this.beatmap = beatmap;
    }

    setMusic(music) {
        this.music = music;
    }

    start(scene) {
        this.startTmg = Date.now();
        this.frameTmg = 0;
        this.frameNum = 0;
        this._playSound(this.music);
        scene.animate();
    }

    update() {
        if (this.beatmap == null) {
            console.error("set beatmap first!");
        }
        let gameTmgNow = Date.now() - this.startTmg;
        if (this.fixedInterval != null) {
            let elapsed = gameTmgNow - this.frameTmg;
            if (elapsed > this.fixedInterval) {
                this.frameTmg = gameTmgNow - elapsed % this.fixedInterval;
            } else {
                return false;
            }
        } else {
            this.frameTmg = gameTmgNow;
        }
        this.beatmap.updatePos(gameTmgNow);
        this.beatmap.updateJdgPtrs(gameTmgNow, Judge.jdgRange["tap"].good);
        this.frameNum ++;
        return true;
    }

    getExactTmg() {
        return Date.now() - this.startTmg;
    }

    _playSound(buffer) {
        let source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);
    }

}


