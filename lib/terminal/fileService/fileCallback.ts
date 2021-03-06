/* lib/terminal/fileService/fileCallback - A callback to file system requests that provides directory tree data. */

import { ServerResponse } from "http";

import directory from "../commands/directory.js";
import response from "../server/response.js";
import serverVars from "../server/serverVars.js";
import vars from "../utilities/vars.js";

const fileCallback = function terminal_fileService_fileCallback(serverResponse:ServerResponse, data:fileService, message:string):void {
    const localDevice:boolean = (data.agent === serverVars.hashDevice && data.agentType === "device"),
        copyStatus:copyStatus = {
            failures: [],
            message: message,
            target: `remote-${data.id}`
        },
        payload:string = (message.indexOf("Copy complete.") === 0)
            ? JSON.stringify({
                "file-list-status": copyStatus
            })
        : message;
    if (localDevice === true) {
        vars.testLogger("fileService", "fileCallback", "When the operation is limited to the local device simply issue the HTTP response with payload.");
        response(serverResponse, "application/json", payload);
    } else {
        const dirConfig:readDirectory = {
            callback: function terminal_fileService_fileCallback_dir(directory:directoryList):void {
                const location:string = (data.name.indexOf("\\") < 0 || data.name.charAt(data.name.indexOf("\\") + 1) === "\\")
                        ? data.name
                        : data.name.replace(/\\/g, "\\\\"),
                    update:fsUpdateRemote = {
                        agent: data.agent,
                        agentType: data.agentType,
                        dirs: directory,
                        fail: [],
                        location: location,
                        status: copyStatus
                    };
                response(serverResponse, "application/json", JSON.stringify({
                    "fs-update-remote": update
                }));
            },
            depth: 2,
            exclusions: [],
            logRecursion: false,
            mode: "read",
            path: data.name,
            symbolic: true
        };
        vars.testLogger("fileService", "fileCallback", "When the operation is not limited to the local device perform a directory operation for the HTTP payload.");
        directory(dirConfig);
    }
};

export default fileCallback;