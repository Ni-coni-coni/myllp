var now = Date.now();
var then = now;
var lastFPSCountTiming = now;
var elapsed;
var frameCount = 0;
var lastFrameCount = 0;
var frameInterval = 1000 / 200;
var fpsCounterDiv = document.getElementById("fpsCounterDiv");
(function animate() {
    requestAnimationFrame(animate);
    now = Date.now();
    elapsed = now - then;
    //if (elapsed > that.frameInterval) {
    frameCount ++;
    if (now - lastFPSCountTiming > 1000) {
        let fps = (frameCount - lastFrameCount) * 1000 / (now - lastFPSCountTiming);
        console.log(fps);
        fpsCounterDiv.innerText = "fps:" + fps;

        lastFrameCount = frameCount;
        lastFPSCountTiming = now;
    }
    then = now - (elapsed % frameInterval);
    //}
})();