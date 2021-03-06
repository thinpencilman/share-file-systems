
/* lib/terminal/server/storage - A library for writing data to storage. */

import error from "../utilities/error.js";
import vars from "../utilities/vars.js";

import response from "./response.js";
import serverVars from "./serverVars.js";

const storage = function terminal_server_storage(data:storage):void {
    const location:string = serverVars.storage + data.type,
        fileName:string = `${location}-${Math.random()}.json`,
        testFlag:boolean = (serverVars.testBrowser === null && vars.command.indexOf("test") === 0),
        rename = function terminal_server_storage_rename():void {
            vars.testLogger("storage", "rename", "Storage file is renamed from random name to proper name to reduce the potential of write collisions.");
            if (testFlag === false) {
                vars.node.fs.rename(fileName, `${location}.json`, function terminal_server_storage_rename_renameNode(erName:Error) {
                    if (erName !== null) {
                        vars.node.fs.unlink(fileName, function terminal_server_storage_rename_renameNode_unlink(erUnlink:Error) {
                            if (erUnlink !== null) {
                                error([erUnlink.toString()]);
                            }
                        });
                    }
                });
            }
        },
        writeCallback = function terminal_server_storage_writeCallback(erSettings:Error):void {
            vars.testLogger("storage", "writeCallback", "Callback for writing a data storage file to disk with a random name.");
            if (erSettings !== null) {
                error([erSettings.toString()]);
                return;
            }
            if (data.type === "settings") {
                const settings:ui_data = <ui_data>data.data;
                if (vars.command.indexOf("test") !== 0) {
                    serverVars.brotli = settings.brotli;
                    serverVars.hashType = settings.hashType;
                    serverVars.hashUser = settings.hashUser;
                    serverVars.nameUser = settings.nameUser;
                    if (serverVars.hashDevice === "") {
                        serverVars.hashDevice = settings.hashDevice;
                        serverVars.nameDevice = settings.nameDevice;
                    }
                }
                rename();
            } else {
                rename();
            }
        };
    vars.testLogger("storage", "", `Write application data to disk for type ${data.type}`);
    if (data.type === undefined) {
        error(["Submitted a 'type' value of undefined to the storage utility."]);
        return;
    }
    if (testFlag === true) {
        writeCallback(null);
    } else {
        vars.node.fs.writeFile(fileName, JSON.stringify(data.data), "utf8", writeCallback);
    }
    response(data.response, "text/plain", `${data.type} storage written`);
};

export default storage;