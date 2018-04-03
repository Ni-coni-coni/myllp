class Loader {

    loadImage(src) {
        if (typeof src == "string") {
            return new Promise((resolve, reject) => {
                let img = new Image();
                img.onload = () => resolve(img);
                img.onerror = error => reject(error);
                img.src = src;
            });
        }
        else if (typeof src == "object" && src instanceof Array) {
            let promises = [];
            for (let srcStr of src) {
                promises.push(this.loadImage(srcStr));
            }
            return Promise.all(promises);
        }
        else {
            return new Promise((resolve, reject) => {
                reject(Error("image src is not a path!"));
            });
        }
    }

    loadSound(src) {
        if (typeof src == "string") {
            return new Promise((resolve, reject) => {
                let sound = new Howl({
                    src: [src],
                    onload: () => resolve(sound),
                    onloaderror: error => reject(error)
                });
            })
        }
        else if (typeof src == "object" && src instanceof Array) {
            let promises = [];
            for (let srcStr of src) {
                promises.push(this.loadSound(srcStr));
            }
            return Promise.all(promises);
        }
        else {
            return new Promise((resolve, reject) => {
                reject(Error("sound src is not a path!"));
            });
        }
    }

    loadJson(src) {
        if (typeof src == "string") {
            return new Promise((resolve, reject) => {
                let xhr = new XMLHttpRequest();
                xhr.open("get", src);
                xhr.onreadystatechange = () => {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        let data = JSON.parse(xhr.responseText);
                        resolve(data);
                    }
                };
                xhr.onerror = error => reject(error);
                xhr.send();
            });
        }
        else if (typeof src == "object" && src instanceof Array) {
            let promises = [];
            for (let srcStr of src) {
                promises.push(this.loadJson(srcStr));
            }
            return Promise.all(promises);
        }
        else {
            return new Promise((resolve, reject) => {
                reject(Error("json src is not a path!"));
            });
        }
    }

}