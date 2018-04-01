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
var notesBefore = [];
var notesAfter = [];
var speedLines = [];
var gameTiming;
var gamePosition;
var baselineHiSpeed = 0.2;
var offset = 0;
var renderRange = 425;
var globalRatio = 1;

var imagesReady = true;
var mapReady = false;
var audioReady = true;
var touchAreaReady = true;

main();

function main() {

    window.onresize = function() {
        resize();
    };

    initImages();
    initMap(); // load asynchronously
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
        bgContext.fillStyle = "rgb(10,0,20)";
        bgContext.fillRect(0, 0, 1024, 682);
    };
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
        // get offset, - offset should not be larger than first speed change timing.
        offset = mapData.offset;
        // fill speed line array, speedLines[i][0] means timing of i-th speed line(with offset),
        // speedLines[i][1] means speed line position in hi-speed-based beatmap of i-th speed line
        // speedLines[i][2] means speed ratio between i-th speed line and (i+1)-th or the end.
        // first set a baseline speed line of 0 timing(with offset)
        speedLines.push([0, 0, mapData.originSpeedRatio]);
        let prevSpeedLine = speedLines[0];
        for (let i in mapData.speed) {
            let oneSpeedLine = new Array(2);
            oneSpeedLine[0] = mapData.speed[i].speedChangeTiming + offset;
            oneSpeedLine[1] = baselineHiSpeed * prevSpeedLine[2] * (oneSpeedLine[0] - prevSpeedLine[0]) +
                prevSpeedLine[1];
            oneSpeedLine[2] = mapData.speed[i].speedRatio;
            speedLines.push(oneSpeedLine);
            prevSpeedLine = oneSpeedLine;
        }
        // fill note array, notes[i][0] means timing of i-th note(with offset),
        // notes[i][1] means destination of i-th note,
        // notes[i][2] means position of i-th note(in hi-speed-based beatmap).
        let currSpeedLineIdx = 0;
        let prevSpeedLineIdx = 0;
        let accumulatedDist = 0;
        for (let i in mapData.notes) {
            let oneNote = new Array(3);
            oneNote[0] = mapData.notes[i].noteTiming + offset;
            // get current speed line index(the speed line just before current note).
            while (currSpeedLineIdx < speedLines.length && oneNote[0] > speedLines[currSpeedLineIdx][0]) {
                currSpeedLineIdx ++;
            }
            currSpeedLineIdx --;
            // accumulate distance(in hi-speed-based beatmap) from previous speed line to the current.
            for (let j = prevSpeedLineIdx; j < currSpeedLineIdx; j ++) {
                accumulatedDist += speedLines[j][2] * baselineHiSpeed *
                    (speedLines[j+1][0] - speedLines[j][0]);
            }
            // calculate the position of current note(in hi-speed-based beatmap) and push into array.
            oneNote[1] = accumulatedDist + speedLines[currSpeedLineIdx][2] * baselineHiSpeed *
                (oneNote[0] - speedLines[currSpeedLineIdx][0]);
            notes.push(oneNote);
            // record previous speed line for next loop.
            prevSpeedLineIdx = currSpeedLineIdx;
            oneNote[2] = mapData.notes[i].destination;
        }
        console.log(speedLines);
        console.log(notes);


    }
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                loadMap();
                imagesReady = true;
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
    addCircleDiv(
        notesStartX,
        notesStartY,
        0, "startPoint", "circleDiv"
    );
}

function addCircleDiv(centerX, centerY, diameter, id, className) {
    let circleDiv = document.createElement("div");
    circleDiv.className = className;
    circleDiv.id = id;
    circleDiv.style.currentPosition = "absolute";
    circleDiv.style.display = "block";
    circleDiv.style.background = "yellow";
    circleDiv.style.width = diameter / 1024 * 100 + "%";
    circleDiv.style.height = diameter / 682 * 100 + "%";
    circleDiv.style.left = (centerX - diameter / 2) / 1024 * 100 + "%";
    circleDiv.style.top = (centerY - diameter / 2) / 682 * 100 + "%";
    gameDiv.appendChild(circleDiv);
}

function resize() {
    let ratio = 682 / 1024;
    let w = window.innerWidth;
    let h = window.innerHeight;
    if (h/w < ratio) {
        let gameDivWidth = h / ratio;
        gameDiv.style.width = gameDivWidth + "px";
        gameDiv.style.height = h + "px";
        gameDiv.style.left = (w - gameDivWidth) / 2 + "px";
        gameDiv.style.top = "0px";
        globalRatio = h / 682;
    } else {
        let gameDivHeight = w * ratio;
        gameDiv.style.width = w + "px";
        gameDiv.style.height = gameDivHeight + "px";
        gameDiv.style.left = "0px";
        gameDiv.style.top = (h - gameDivHeight) / 2 + "px";
        globalRatio = w / 1024;
    }

}

function renderGame() {

    console.log("renderGame");
    let currSpeedLineIdx = 0;
    let prevSpeedLineIdx = 0;
    let accumulatedDist = 0;
    // initialize game and notes to render in first frame.
    gameTiming = 0;
    gamePosition = 0;
    let index;
    console.log("check notes: ");
    console.log(notes);
    console.log("check notesToRender1: " + notesToRender);
    for (index = 0; index < notes.length && notes[index][1] < renderRange; index ++) {
        if (notes[index][1] > - renderRange) {
            notesToRender.push(notes[index]);
        }
    }
    // put the rest notes into notesAfter array(inverse it for efficiency).
    for (let i = notes.length - 1; i >= index; i--) {
        notesAfter.push(notes[i]);
    }


    console.log("check notesBefore: " + notesBefore);
    console.log("check notesAfter: ");
    console.log(notesAfter);
    console.log("check notesToRender2: " + notesToRender);

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
            gameTiming = now - startTiming;

            // calculate current game position the same as the part of initialization.
            while (currSpeedLineIdx < speedLines.length && gameTiming > speedLines[currSpeedLineIdx][0]) {
                currSpeedLineIdx ++;
            }
            currSpeedLineIdx --;
            for (let j = prevSpeedLineIdx; j < currSpeedLineIdx; j ++) {
                accumulatedDist += speedLines[j][2] * baselineHiSpeed *
                    (speedLines[j+1][0] - speedLines[j][0]);
            }
            gamePosition = accumulatedDist + speedLines[currSpeedLineIdx][2] * baselineHiSpeed *
                (gameTiming - speedLines[currSpeedLineIdx][0]);
            prevSpeedLineIdx = currSpeedLineIdx;


            renderOneFrame(gamePosition, notesToRender, notesBefore, notesAfter);
        }
    })();
}

function renderOneFrame(gamePosition, notesToRender, notesBefore, notesAfter) {

    // shift notes from notesAfter[] into notesToRender[]
    for (let i = notesAfter.length - 1; i >= 0; i --) {
        if (notesAfter[i][1] < gamePosition + renderRange) {
            notesToRender.push(notesAfter.pop());
        } else break;
    }

    // shift notes from notesToRender[] into notesBefore[]
    for (let i = 0; i < notesToRender.length - 1; i ++ ) {
        if (notesToRender[i][1] < gamePosition - renderRange) {
            notesBefore.push(notesToRender.shift());
        } else break;
    }

    // shift notes from notesToRender[] into notesAfter[]
    for (let i = notesToRender.length - 1; i >= 0; i --) {
        if (notesToRender[i][1] > gamePosition + renderRange) {
            notesAfter.push(notesToRender.pop());
        } else break;
    }

    // shift notes from notesBefore[] into notesToRender[]
    for (let i = notesBefore.length - 1; i >= 0; i --) {
        if (notesBefore[i][1] > gamePosition - renderRange) {
            notesToRender.unshift(notesBefore.pop());
        } else break;
    }



    gameCanvas.getContext("2d").clearRect(0, 0, 1024, 682);
    
    for (let index in notesToRender) {
        //今后用事先定义好的touchAreaCenterPoints[]
        var circleDiv = document.getElementById("circle" + notesToRender[index][2]);
        var startPoint = document.getElementById("startPoint");
        drawNote(startPoint.offsetLeft / globalRatio, startPoint.offsetTop / globalRatio,
            (circleDiv.offsetLeft + circleDiv.offsetWidth / 2) / globalRatio,
            (circleDiv.offsetTop + circleDiv.offsetHeight / 2) / globalRatio,
            notesToRender[index][1], gamePosition
        );
    }
}

//center:(512px，170px), length:425px, diameter:136px.
function drawNote(startX, startY, destX, destY, notePosition, gamePosition) {
    // let wholeDistance = Math.sqrt(Math.pow(destX - startX, 2) + Math.pow(destY - startY, 2));
    let finishedDistanceRatio = (gamePosition - notePosition + renderRange) / renderRange;
    let noteX = startX + (destX - startX) * finishedDistanceRatio;
    let noteY = startY + (destY - startY) * finishedDistanceRatio;
    // let wholeDistance = Math.sqrt(Math.pow(destX - startX, 2) + Math.pow(destY - startY, 2));
    // let FromDestDistance = baselineHiSpeed * (gameTiming - noteTiming);
    // let FromDestX = FromDestDistance / wholeDistance * (destX - startX);
    // let FromDestY = FromDestDistance / wholeDistance * (destY - startY);
    // let noteX = destX + FromDestX;
    // let noteY = destY + FromDestY;
    // let finishedDistanceRatio = (FromDestDistance + wholeDistance) / wholeDistance;
    let noteSizeRatio = finishedDistanceRatio > 1 ? 1 : finishedDistanceRatio;
    // if (noteSizeRatio < 0) {
    //     noteSizeRatio = 0;
    // } //fix afterwards
    let noteLeft = noteX - 68 * noteSizeRatio;
    let noteTop = noteY - 68 * noteSizeRatio;
    let noteSize = 136 * noteSizeRatio;
    gameContext.drawImage(skinImage, 396, 15, 128, 128,
        noteLeft, noteTop, noteSize, noteSize);
}

function test() {
    renderGame();
}
