
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
function getPoFiles(dir, files) {
    if (files === void 0) { files = []; }
    var dirFiles = fs.readdirSync(dir);
    dirFiles.forEach(function (file) {
        var filePath = "".concat(dir, "/").concat(file);
        if (fs.statSync(filePath).isDirectory()) {
            getPoFiles(filePath, files);
        }
        else {
            // 判断是不是js、ts、tsx
            var reg = /\.(js|ts|tsx)$/;
            if (reg.test(file))
                files.push(filePath);
        }
    });
    return files;
}
var localpath = "./src";
var files = getPoFiles(localpath);
var replaceList = [];
var oldPath = "./setting/old.json";
var newPath = "./setting/new.json";
if (fs.existsSync(oldPath) && fs.existsSync(newPath)) {
    var _json = require(oldPath.replace("/setting", ""));
    var _jsonNew = require(newPath.replace("/setting", ""));
    var _jsonList = Object.entries(_json);
    var _jsonListNew_1 = Object.entries(_jsonNew);
    _jsonList.forEach(function (_a) {
        var key = _a[0], value = _a[1];
        _jsonListNew_1.forEach(function (_a) {
            var keyNew = _a[0], valueNew = _a[1];
            if (key === keyNew && value !== valueNew) {
                replaceList.push({
                    from: new RegExp(value, "gi"),
                    to: valueNew
                });
            }
        });
    });
    files.forEach(function (p) {
        var data = fs.readFileSync(p, "utf-8");
        replaceList.forEach(function (sp) {
            data = data.replace(sp.from, sp.to);
        });
        fs.writeFileSync(p, data, "utf-8");
    });
    fs.unlinkSync(oldPath);
    fs.renameSync(newPath, oldPath);
}

// let replaceList = [
//     {
//         from: new RegExp("EDDX", "g"),
//         to: "EDDX"
//     },
//     {
//         from: new RegExp("Eddx", "g"),
//         to: "Eddx"
//     },
//     {
//         from: new RegExp("eddx", "g"),
//         to: "eddx"
//     },
// ]
