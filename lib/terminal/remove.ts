
import commas from "./commas.js"
import directory from "./directory.js";
import error from "./error.js";
import log from "./log.js";
import vars from "./vars.js";

// similar to posix "rm -rf" command
const library = {
        commas: commas,
        directory: directory,
        error: error,
        log: log
    },
    remove = function node_apps_remove(filePath:string, callback:Function):void {
        const numb:any = {
                dirs: 0,
                file: 0,
                link: 0,
                size: 0
            },
            removeItems = function node_apps_remove_removeItems(fileList:directoryList):void {
                let a:number = 0;
                const len:number = fileList.length,
                    destroy = function node_apps_remove_removeItems_destroy(item:directoryItem) {
                        const type:"rmdir"|"unlink" = (item[1] === "directory")
                            ? "rmdir"
                            : "unlink";
                        vars.node.fs[type](item[0], function node_apps_remove_removeItems_destroy_callback(er:nodeError):void {
                            if (vars.verbose === true && er !== null && er.toString().indexOf("no such file or directory") < 0) {
                                if (er.code === "ENOTEMPTY") {
                                    node_apps_remove_removeItems_destroy(item);
                                    return;
                                }
                                library.error([er.toString()]);
                                return;
                            }
                            if (item[0] === fileList[0][0]) {
                                callback();
                            } else {
                                fileList[item[2]][3] = fileList[item[2]][3] - 1;
                                if (fileList[item[2]][3] < 1) {
                                    node_apps_remove_removeItems_destroy(fileList[item[2]]);
                                }
                            }
                        });
                    };
                if (fileList.length < 1) {
                    callback();
                    return;
                }
                do {
                    if (vars.command === "remove") {
                        if (fileList[a][1] === "file") {
                            numb.file = numb.file + 1;
                            numb.size = numb.size + fileList[a][4].size;
                        } else if (fileList[a][1] === "directory") {
                            numb.dirs = numb.dirs + 1;
                        } else if (fileList[a][1] === "link") {
                            numb.link = numb.link + 1;
                        }
                    }
                    if ((fileList[a][1] === "directory" && fileList[a][3] === 0) || fileList[a][1] !== "directory") {
                        destroy(fileList[a]);
                    }
                    a = a + 1;
                } while (a < len);
            };
        if (vars.command === "remove") {
            if (process.argv.length < 1) {
                library.error([
                    "Command remove requires a file path",
                    `${vars.text.cyan + vars.version.command} remove ../jsFiles${vars.text.none}`
                ]);
                return;
            }
            filePath = vars.node.path.resolve(process.argv[0]);
            callback = function node_apps_remove_callback() {
                const out = [`${vars.version.name} removed `];
                vars.verbose = true;
                out.push(vars.text.angry);
                out.push(String(numb.dirs));
                out.push(vars.text.none);
                out.push(" director");
                if (numb.dirs === 1) {
                    out.push("y, ");
                } else {
                    out.push("ies, ");
                }
                out.push(vars.text.angry);
                out.push(String(numb.file));
                out.push(vars.text.none);
                out.push(" file");
                if (numb.dirs !== 1) {
                    out.push("s");
                }
                out.push(", ");
                out.push(vars.text.angry);
                out.push(String(numb.link));
                out.push(vars.text.none);
                out.push(" symbolic link");
                if (numb.link !== 1) {
                    out.push("s");
                }
                out.push(" at ");
                out.push(vars.text.angry);
                out.push(library.commas(numb.size));
                out.push(vars.text.none);
                out.push(" bytes.");
                library.log(["", out.join(""), `Removed ${vars.text.cyan + filePath + vars.text.none}`], true);
            };
        }
        library.directory({
            callback: removeItems,
            depth: 0,
            exclusions: [],
            path: filePath,
            recursive: true,
            symbolic: true
        });
    };

export default remove;