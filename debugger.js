class Debugger {
    constructor() {
        this.msgNum = 0;
        this.msgStrs = [];
        this.maxSize = 10;
        this.debugDiv = null;
    }

    createDiv() {
        let div = document.createElement("div");
        document.body.appendChild(div);

        div.id = "debugDiv";
        div.style.left = "10%";
        div.style.top = "1%";
        div.style.width = "60%";
        div.style.height = "3%";
        div.style.zIndex = 10;

        div.style.color = "white";
        div.style.fontSize = "20px";
        //div.style.textAlign = "center";

        this.debugDiv = div;
    }

    reset() {
        this.msgNum = 0;
        this.msgStrs = [];
    }

    logMsg(msg) {
        let div = this.debugDiv;
        if (div === null) {
            console.error("not initialized yet!");
        }
        this.msgStrs.push(this.msgNum + ":" + msg + "\n");
        if (this.msgStrs.length > this.maxSize) {
            this.msgStrs.shift();
        }
        div.innerText = this._getMsg();
        this.msgNum ++;
    }

    _getMsg() {
        let wholeStr = "";
        for (let str of this.msgStrs) {
            wholeStr += str;
        }
        return wholeStr
    }


}