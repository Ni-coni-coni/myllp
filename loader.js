class Loader {

    constructor() {
        this.loadedAssets = {};
    }

    get loadFuncMap() {
        return {
            "image": this.loadImage,
            "sound": this.loadSound,
            "json": this.loadJson
        };
    }

    getAsset(key) {
        if (this.loadedAssets[key] != null) {
            return this.loadedAssets[key];
        } else {
            console.warn(key + " does not exist");
            return false;
        }
    }

    loadBatch(assets) { // assets like {"image": {key: path, key: path}, "sound": {}, "json": {}}
        let promises = [];
        Object.keys(assets).forEach(type => {
            Object.keys(assets[type]).forEach(key => {
                var src = assets[type][key];
                var loadFunc = this.loadFuncMap[type].bind(this);
                promises.push(loadFunc(src, key));
            });
        });
        return Promise.all(promises);
    }

    loadImage(src, key) {
        return new Promise((resolve, reject) => {
            let img = new Image();
            img.onload = () => {
                this.loadedAssets[key] = img;
                resolve(img);
            };
            img.onerror = error => reject(error);
            img.src = src;
        });
    }

    loadSound(src, key) {
        return new Promise((resolve, reject) => {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            let ctx = new AudioContext();
            let xhr = new XMLHttpRequest();
            xhr.open("get", src);
            xhr.responseType = "arraybuffer";
            xhr.onload = () => {
                ctx.decodeAudioData(xhr.response, buffer => {
                    this.loadedAssets[key] = buffer;
                    resolve(buffer);
                });
            };
            xhr.onerror = error => reject(error);
            xhr.send();
        });
    }

    loadJson(src, key) {
        return new Promise((resolve, reject) => {
            let xhr = new XMLHttpRequest();
            xhr.open("get", src);
            xhr.onload = () => {
                let data = JSON.parse(xhr.responseText);
                this.loadedAssets[key] = data;
                resolve(data);
            };
            xhr.onerror = error => reject(error);
            xhr.send();
        });
    }

}