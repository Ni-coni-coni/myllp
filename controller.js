
class Controller {
    constructor(usrFPS) {
        this.usrFPS = usrFPS;
        this.fixedInterval = (usrFPS == null) ? null : 1000 / usrFPS;
        this.beatmap = null;
        this.beatmap_copy = null;
        this.music = null;
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
        this.totalDuration = null;
        this.startTmg = null;

        this.gameDiv = null;
        this.startDiv = null;
        this.resultDiv = null;

        this.frameTmg = null;
        this.frameNum = null;
        this.FPS = null;
        this.isEnd = false;
    }

    setGameDiv(gameDiv) {
        this.gameDiv = gameDiv;
    }

    setBeatmap(beatmap) {
        this.beatmap = beatmap;
    }

    setMusic(music) {
        this.music = music;
    }

    setDuration() {
        this.totalDuration = this.music.duration * 1000 > this.beatmap.duration ?
                             this.music.duration * 1000 : this.beatmap.duration;
        this.totalDuration += 3000;
    }

    setStartDiv(scene) {
        let div = document.createElement("div");

        div.style.cssText = "left:42%;top:40%;width:16%;height:10%;color:white";
        div.style.zIndex = 100;
        div.style.fontSize = "30px";
        div.style.textAlign = "center";
        div.innerText = "Start!";
        div.addEventListener("click", () => {
            div.style.zIndex = -1;
            this.start(scene);
        });
        this.startDiv = div;
        if (scene.gameDiv == null) {
            console.error("set game div first");
        }
        scene.gameDiv.appendChild(div);
    }

    start(scene) {

        this.beatmap.scoreBoard.setScoreDiv(this.gameDiv);
        this.startTmg = Date.now();
        this.frameTmg = 0;
        this.frameNum = 0;
        this._playSound(this.music);
        scene.animate();
    }

    end() {
        if (!this.isEnd) this.beatmap.scoreBoard.showResult(this.gameDiv);
        this.isEnd = true;
    }

    update() {
        if (this.beatmap == null) {
            console.error("set beatmap first!");
        }
        if (this.frameTmg > this.totalDuration) {
            this.end();
            return false;
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



