const fps = 30;

var gameDiv = document.getElementById("gameDiv");
var bgImage = new Image();
var skinImage = new Image();

var mapData;
var notes = [];
var notesToRender = [];
var gameTime;
var noteSpeed = 160;

initGame();

window.onresize = function() {
    resize();
};

function initGame() {

    initImages();
    initMap();
    initAudio();
    initTouchArea();
    resize();
    test();

}

function initImages() {
    // init background
    let bgCanvas = document.getElementById("bgCanvas");
    bgCanvas.width = 1024;
    bgCanvas.height = 682;
    let bgContext = bgCanvas.getContext("2d");
    bgImage.src = "image/bg.jpg";
    bgImage.onload = function() {
        bgContext.drawImage(bgImage, 0, 0, bgCanvas.width, bgCanvas.height);
    }
    // init skin
    let gameCanvas = document.getElementById("gameCanvas");
    gameCanvas.width = 1024;
    gameCanvas.height = 682;
    let gameContext = gameCanvas.getContext("2d");
    skinImage.src = "image/skin.png";
    skinImage.onload = function() {
        gameContext.drawImage(skinImage, 396, 15, 128, 128, 0, 0, 128, 128);
    }
}

function initMap() {
    let mapFile = "map/demo.json";
    let xhr = new XMLHttpRequest;
    function loadMap() {
        mapData = eval("(" + xhr.responseText + ")");
        for (let i in mapData.notes) {
            let noteArr = new Array(2);
            noteArr[0] = mapData.notes[i].noteTrack;
            noteArr[1] = mapData.notes[i].noteTime;
            notes.push(noteArr);
        }
    }
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                loadMap();
            } else {
                console.log("status = " + xhr.status);
            }
        }
    };
    xhr.open("GET", mapFile);
    xhr.send();

}

function initAudio() {

}

function initTouchArea() {
    let notesStartX = 512;
    let notesStartY = 170;
    let distance = 425;
    let pi = Math.PI;
    let angle = pi / 8;
    let diameter = 136
    for (let i = 0; i < 9; i ++) {
        addCircleDiv(
            notesStartX + distance * Math.cos(pi + angle * i),
            notesStartY - distance * Math.sin(pi + angle * i),
            diameter, "circle" + i, "circleDiv"
        );
    }
}

function addCircleDiv(centerX, centerY, diameter, id, className) {
    let circleDiv = document.createElement(id);
    circleDiv.className = className;
    circleDiv.style.position = "absolute";
    circleDiv.style.display = "block";
    circleDiv.style.background = "yellow";
    circleDiv.style.left = (centerX - diameter / 2) / 1024 * 100 + "%";
    circleDiv.style.top = (centerY - diameter / 2) / 682 * 100 + "%";
    circleDiv.style.width = diameter / 1024 * 100 + "%";
    circleDiv.style.height = diameter / 682 * 100 + "%";
    gameDiv.appendChild(circleDiv);
}

function resize() {
    let gameDiv = document.getElementById("gameDiv");
    let ratio = 682 / 1024;
    let w = window.innerWidth;
    let h = window.innerHeight;
    if (h/w < ratio) {
        let gameDivWidth = h / ratio;
        gameDiv.style.left = (w - gameDivWidth) / 2 + "px";
        gameDiv.style.top = "0px";
        gameDiv.style.width = gameDivWidth + "px";
        gameDiv.style.height = h + "px";
    } else {
        let gameDivHeight = w * ratio;
        gameDiv.style.left = "0px";
        gameDiv.style.top = (h - gameDivHeight) / 2 + "px";
        gameDiv.style.width = w + "px";
        gameDiv.style.height = gameDivHeight + "px";
    }

}

function renderGame(fps) {
    let frameCount = 0;
    let frameInterval = 1000 / fps;
    let now, elapsed;
    let startTime = Date.now();
    let then = startTime;
    (function animate() {
        requestAnimationFrame(animate);
        now = Date.now();
        elapsed = now - then;
        if (elapsed > frameInterval) {
            frameCount ++;
            then = now - (elapsed % frameInterval);
            renderOneFrame(now - startTime, notesToRender, notes);
        }
    })();
}

function renderOneFrame(gameTime, renderList, wholeList) {
    let gameCanvas = document.getElementById("gameCanvas"); //TODO var gameCanvas at beginning
    gameCanvas.clearRect(0, 0, 1024, 682);
    for (let i in renderList) {
        drawNote(renderList[i][0], renderList[i][1], gameTime, noteSpeed);
    }
}

//center:(512px，170px), length:425px, diameter:136px
function drawNote(fromX, fromY, toX, toY, noteTime, gameTime, noteSpeed) {

}

function test() {
    //console.log(mapData)
}
