const fps = 60;
const frameInterval = 1000 / fps;

var gameDiv = document.getElementById("gameDiv");
var bgImage = new Image();
var skinImage = new Image();

var gameCanvas = document.getElementById("gameCanvas");
var gameContext = gameCanvas.getContext("2d");

var mapData;
var notes = [];
var notesToRender = [];
var speedLines = [];
var currentTiming;
var currentPosition;
var baselineHiSpeed = 300;
var offset = 0;

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
    gameCanvas.width = 1024;
    gameCanvas.height = 682;
    skinImage.src = "image/skin.png";
}

function initMap() {
    let mapFile = "map/demo.json";
    let xhr = new XMLHttpRequest;
    function loadMap() {
        mapData = eval("(" + xhr.responseText + ")");
        offset = mapData.offset; // -offset should not be larger than first speed change timing
        for (let i in mapData.speed) {
            let oneSpeedLine = new Array(2);
            oneSpeedLine[0] = mapData.speed[i].changeTiming;
            oneSpeedLine[1] = mapData.speed[i].speedRatio;
            speedLines.push(oneSpeedLine);
        }
        console.log(speedLines);
        let speedLineCount = 0;
        let speedLineCountPrev = 0;
        let accumulateDist = 0;
        for (let i in mapData.notes) {
            let oneNote = new Array(3);
            oneNote[0] = mapData.notes[i].noteTiming;
            console.log(oneNote[0]);
            oneNote[1] = mapData.notes[i].destination;
            console.log(oneNote[1]);
            console.log(speedLines[speedLineCount][0]);
            while (oneNote[0] > speedLines[speedLineCount][0]) {
                speedLineCount ++;
            }
            for (let j = speedLineCountPrev; j < speedLineCount; j ++) {
                accumulateDist += speedLines[j][1] * baselineHiSpeed * speedLines[j][0];
            }
            speedLineCountPrev = speedLineCount;
            oneNote[2] = accumulateDist + speedLines[speedLineCount][1] * baselineHiSpeed *
                (oneNote[0] - speedLines[speedLineCount][0]);
            notes.push(oneNote);
        }
        console.log(notes)
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
    let diameter = 136;
    for (let i = 1; i <= 9; i ++) {
        addCircleDiv(
            notesStartX + distance * Math.cos(pi + angle * (i - 1)),
            notesStartY - distance * Math.sin(pi + angle * (i - 1)),
            diameter, "circle" + i, "circleDiv"
        );
    }
}

function addCircleDiv(centerX, centerY, diameter, id, className) {
    let circleDiv = document.createElement("div");
    circleDiv.className = className;
    circleDiv.id = id;
    circleDiv.style.currentPosition = "absolute";
    circleDiv.style.display = "block";
    circleDiv.style.background = "yellow";
    circleDiv.style.left = (centerX - diameter / 2) / 1024 * 100 + "%";
    circleDiv.style.top = (centerY - diameter / 2) / 682 * 100 + "%";
    circleDiv.style.width = diameter / 1024 * 100 + "%";
    circleDiv.style.height = diameter / 682 * 100 + "%";
    gameDiv.appendChild(circleDiv);
}

function resize() {
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

function renderGame() {
    currentPosition = - baselineHiSpeed * offset;
    let frameCount = 0;
    let now, elapsed;
    let startTiming = Date.now();
    let then = startTiming;
    (function animate() {
        requestAnimationFrame(animate);
        now = Date.now();
        elapsed = now - then;
        if (elapsed > frameInterval) {
            frameCount ++;
            then = now - (elapsed % frameInterval);
            renderOneFrame(now - startTiming, notesToRender, notes);
        }
    })();
}

function renderOneFrame(currentTiming, renderList, wholeList) {

    currentPosition += frameInterval;
    gameCanvas.getContext("2d").clearRect(0, 0, 1024, 682);
    
    for (let index in renderList) {
        var circleDiv = document.getElementById("circle" + renderList[index][1]);
        drawNote(512, 170,
            circleDiv.offsetLeft + circleDiv.offsetWidth / 2,
            circleDiv.offsetTop + circleDiv.offsetHeight / 2,
            renderList[index][0], currentTiming
        );
    }
}

//center:(512px，170px), length:425px, diameter:136px
function drawNote(startX, startY, destX, destY, noteTiming, currentTiming) {
    let wholeDistance = Math.sqrt(Math.pow(destX - startX, 2) + Math.pow(destY - startY, 2));
    let FromDestDistance = baselineHiSpeed * (currentTiming - noteTiming) / 1000;
    let FromDestX = FromDestDistance / wholeDistance * (destX - startX);
    let FromDestY = FromDestDistance / wholeDistance * (destY - startY);
    let noteX = destX + FromDestX;
    let noteY = destY + FromDestY;
    let finishedDistanceRatio = (FromDestDistance + wholeDistance) / wholeDistance;
    let noteSizeRatio = finishedDistanceRatio > 1 ? 1 : finishedDistanceRatio;
    if (noteSizeRatio < 0) {
        noteSizeRatio = 0;
    } //fix afterwards
    let noteLeft = noteX - 68 * noteSizeRatio;
    let noteTop = noteY - 68 * noteSizeRatio;
    let noteSize = 136 * noteSizeRatio;
    gameContext.drawImage(skinImage, 396, 15, 128, 128,
        noteLeft, noteTop, noteSize, noteSize);
}

function test() {
    renderGame();
}
