
/* lib/terminal/commands/remove - A command driven utility to recursively remove file system artifacts. */
import common from "../../common/common.js"
import directory from "./directory.js";
import error from "../utilities/error.js";
import log from "../utilities/log.js";
import vars from "../utilities/vars.js";

// similar to posix "rm -rf" command
const remove = function terminal_commands_remove(filePath:string, callback:Function):void {
        let testLog:testLogFlag = vars.testLogFlag,
            testLogFlag:boolean = (vars.testLogFlag !== "");
        const numb:any = {
                dirs: 0,
                file: 0,
                link: 0,
                size: 0
            },
            removeItems = function terminal_commands_remove_removeItems(fileList:directoryList):void {
                let a:number = 0;
                const len:number = fileList.length,
                    destroy = function terminal_commands_remove_removeItems_destroy(item:directoryItem) {
                        const type:"rmdir"|"unlink" = (item[1] === "directory")
                            ? "rmdir"
                            : "unlink";
                        if (testLogFlag === true) {
                            vars.testLogger("remove", "destroy", "recursively remove items, rmdir for directories and unlink for other artifacts");
                        }
                        vars.node.fs[type](item[0], function terminal_commands_remove_removeItems_destroy_callback(er:nodeError):void {
                            if (vars.verbose === true && er !== null && er.toString().indexOf("no such file or directory") < 0) {
                                if (er.code === "ENOTEMPTY") {
                                    testLogFlag = false;
                                    terminal_commands_remove_removeItems_destroy(item);
                                    return;
                                }
                                error([er.toString()]);
                                return;
                            }
                            if (item[0] === fileList[0][0]) {
                                vars.testLogFlag = testLog;
                                callback();
                            } else {
                                fileList[item[3]][4] = fileList[item[3]][4] - 1;
                                if (fileList[item[3]][4] < 1) {
                                    testLogFlag = false;
                                    terminal_commands_remove_removeItems_destroy(fileList[item[3]]);
                                }
                            }
                        });
                    };
                if (fileList.length < 1) {
                    vars.testLogFlag = testLog;
                    callback();
                    return;
                }
                do {
                    if (vars.command === "remove") {
                        if (fileList[a][1] === "file") {
                            numb.file = numb.file + 1;
                            numb.size = numb.size + fileList[a][5].size;
                        } else if (fileList[a][1] === "directory") {
                            numb.dirs = numb.dirs + 1;
                        } else if (fileList[a][1] === "link") {
                            numb.link = numb.link + 1;
                        }
                    }
                    if ((fileList[a][1] === "directory" && fileList[a][4] === 0) || fileList[a][1] !== "directory") {
                        destroy(fileList[a]);
                    }
                    a = a + 1;
                } while (a < len);
            },
            dirConfig:readDirectory = {
                callback: removeItems,
                depth: 0,
                exclusions: [],
                logRecursion: true,
                mode: "read",
                path: filePath,
                symbolic: true
            };
        if (callback !== undefined && callback.name === "test_testListRunner_increment_remove") {
            vars.testLogFlag = "";
            testLogFlag = false;
        }
        if (vars.command === "remove") {
            if (vars.verbose === true) {
                log.title("Remove");
            }
            if (testLogFlag === true) {
                vars.testLogger("remove", "command", "prepare the application to work with standard input/output");
            }
            if (process.argv.length < 1) {
                error([
                    "Command remove requires a file path",
                    `${vars.text.cyan + vars.version.command} remove ../jsFiles${vars.text.none}`
                ]);
                return;
            }
            dirConfig.path = vars.node.path.resolve(process.argv[0]);
            callback = function terminal_commands_remove_callback() {
                if (vars.verbose === true) {
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
                    out.push(common.commas(numb.size));
                    out.push(vars.text.none);
                    out.push(" bytes.");
                    log(["", out.join(""), `Removed ${vars.text.cyan + dirConfig.path + vars.text.none}`], true);
                }
            };
        }
        if (testLogFlag === true) {
            vars.testLogger("remove", "directory", "gather a directory list of descendant items and then remove them all");
        }
        directory(dirConfig);
    };

export default remove;