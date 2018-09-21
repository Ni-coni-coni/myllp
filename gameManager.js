class Game {
    constructor() {
        this.assets = {
            image: {
                bg: "assets/image/bg.jpg",
                skin: "assets/image/skin.png"
            },
            sound: {
                perfect: "assets/sound/perfect.mp3",
                great: "assets/sound/great.mp3",
                good: "assets/sound/good.mp3",
                music: "assets/sound/perfect.mp3"
            },
            json: {
                beatmap: "assets/beatmap/minus_spdlines.json",
                skinData: "assets/layout/skinData.json"
            }
        };

        this.loader = new Loader();
        this.beatmap = new Beatmap(0.5, 0); // usrHS（每秒飞行usrHS/1000个lanePath长度），offset
        this.scene = new Scene(1024, 682); // canvas宽，canvas高
        this.controller = new Controller();

    }

    init() {
        this.loader.loadBatch(this.assets)
        .then(() => {
            this.beatmap.init(this.loader.getAsset("beatmap"));
            this.beatmap.setMultiMarks();
            this.scene.createGameScene(this.loader.getAsset("bg"),
                                       this.loader.getAsset("skin"),
                                       this.loader.getAsset("skinData"));
            this.scene.initLanePaths();
            this.scene.drawBackGround();
            this.scene.drawJdgCircles();
            console.log(this.beatmap);
            this.controller.start();
            this.scene.animate(this.beatmap, this.controller);

            //this.soundEffects.perfect = this.loader.getAsset("perfect");
            //this.soundEffects.great = this.loader.getAsset("great");
            //this.soundEffects.good = this.loader.getAsset("good");
            //this.music = this.loader.getAsset("music");



            //let that = this;
            //let startCtx = this.refs.startCanvas.getContext("2d");
            //startCtx.font = "300px Georgia";
            //startCtx.fillText("Start!!", 100, 400);
            //this.refs.startCanvas.addEventListener("click", () => {
            //    that.refs.startCanvas.style.zIndex = -1;
            //    that.start();
            //});
        });
    }

}