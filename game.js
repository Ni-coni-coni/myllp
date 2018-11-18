class Game {
    constructor() {
        this.assets = {
            image: {
                bg: "assets/image/bg.jpg",
                skin: "assets/image/skin1.png"
            },
            sound: {
                perfect: "assets/sound/perfect.mp3",
                great: "assets/sound/great.mp3",
                good: "assets/sound/good.mp3",
                music: "assets/music/oshama_scramble.mp3"
            },
            json: {
                beatmap: "assets/beatmap/oshama_scramble.json",
                skinData: "assets/layout/skinData.json"
            }
        };

        this.loader = new Loader();
        this.beatmap = new Beatmap(1.6, -3640); // usrHS（每秒飞行usrHS/1000个lanePath长度），offset
        this.controller = new Controller();
        this.scene = new Scene(1024, 682); // canvas宽，canvas高
        this.judge = new Judge();

    }

    init() {
        this.loader.loadBatch(this.assets)
        .then(() => {
            this.beatmap.init(this.loader.getAsset("beatmap"));
            console.log(this.beatmap);
            this.beatmap.setMultiMarks();
            this.controller.setBeatmap(this.beatmap);
            this.controller.setMusic(this.loader.getAsset("music"));
            this.controller.setDuration();
            this.scene.setController(this.controller);
            let gameDiv = this.scene.createGameScene(this.loader.getAsset("bg"),
                                                     this.loader.getAsset("skin"),
                                                     this.loader.getAsset("skinData"));
            this.scene.initLanePaths();
            this.scene.drawBackGround();
            this.scene.drawJdgCircles();
            this.judge.setScene(this.scene);
            this.judge.setController(this.controller);
            this.judge.setSounds(this.loader.getAsset("perfect"),
                                  this.loader.getAsset("great"),
                                  this.loader.getAsset("good"));
            this.judge.addTouchEvents();
            this.controller.setGameDiv(gameDiv);
            this.controller.setStartDiv(this.scene);

        });
    }

}