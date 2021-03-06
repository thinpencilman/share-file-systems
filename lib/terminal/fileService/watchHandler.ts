/* lib/terminal/fileService/watchHandler - An event handler for file system watch events. */

import directory from "../commands/directory.js";
import error from "../utilities/error.js";
import httpClient from "../server/httpClient.js";
import log from "../utilities/log.js";
import response from "../server/response.js";
import serverVars from "../server/serverVars.js";
import vars from "../utilities/vars.js";

import watchLocal from "./watchLocal.js";

const watchHandler = function terminal_fileService_watchHandler(config:fileServiceWatch):void {
    const localDevice:boolean = (config.data.agent === serverVars.hashDevice && config.data.agentType === "device");
    if (config.value.indexOf(vars.projectPath.replace(/(\\|\/)$/, "").replace(/\\/g, "\\\\")) !== 0) {
        if (localDevice === true) {
            if (serverVars.watches[config.value] !== undefined) {
                const now:number = Date.now();
                vars.testLogger("fileService", "watchHandler", "Central watch handler for local device file system");
                if (serverVars.watches[config.value].time > now - 2000) {
                    watchLocal(config.value, config.logRecursion);
                }
                serverVars.watches[config.value].time = now;
            }
        } else {
            const intervalHandler = function terminal_fileServices_watchHandler_intervalHandler():void {
                    if (serverVars.watches[config.value] === undefined) {
                        clearInterval(interval);
                    } else if (Date.now() > serverVars.watches[config.value].time - 7200000) {
                        serverVars.watches[config.value].close();
                        delete serverVars.watches[config.value];
                        clearInterval(interval);
                    }
                },
                dirConfig:readDirectory = {
                    callback: function terminal_fileService_watchHandler_remote(result:directoryList):void {
                        const update:fsUpdateRemote = {
                                agent: config.data.agent,
                                agentType: config.data.agentType,
                                dirs: result,
                                fail: [],
                                location: config.value
                            },
                            payload:string = JSON.stringify({
                                "fs-update-remote": update
                            }),
                            requestError = function terminal_fileService_watchHandler_remote_requestError(message:nodeError):void {
                                const copyStatus:copyStatus = {
                                        failures: [],
                                        message: config.data.id.slice(config.data.id.indexOf("|") + 1),
                                        target: config.data.id.slice(0, config.data.id.indexOf("|"))
                                    },
                                    fsRemote:fsRemote = {
                                        dirs: "missing",
                                        fail: [],
                                        id: (config.data.id.indexOf("|Copying ") > 0)
                                            ? JSON.stringify({
                                                "file-list-status": copyStatus
                                            })
                                            : config.data.id
                                    };
                                if (message.code !== "ETIMEDOUT" && message.code !== "ECONNREFUSED" && ((vars.command.indexOf("test") === 0 && message.code !== "ECONNREFUSED") || vars.command.indexOf("test") !== 0)) {
                                    error([errorMessage, message.toString()]);
                                }
                                response(config.serverResponse, "application/json", JSON.stringify(fsRemote));
                            },
                            responseError = function terminal_fileService_watchHandler_remote_responseError(message:nodeError):void {
                                if (message.code !== "ETIMEDOUT" && ((vars.command.indexOf("test") === 0 && message.code !== "ECONNREFUSED") || vars.command.indexOf("test") !== 0)) {
                                    log([errorMessage, errorMessage.toString()]);
                                    vars.ws.broadcast(JSON.stringify({
                                        error: errorMessage
                                    }));
                                }
                            },
                            errorMessage:string = `Error related to remote file system watch at ${config.data.agent}.`,
                            httpConfig:httpConfiguration = {
                                agentType: config.data.agentType,
                                callback: function terminal_fileService_watchHandler_remote_directoryCallback(message:Buffer|string):void {
                                    response(config.serverResponse, "application/json", message.toString());
                                },
                                errorMessage: errorMessage,
                                ip: serverVars[config.data.agentType][config.data.agent].ip,
                                payload: payload,
                                port: serverVars[config.data.agentType][config.data.agent].port,
                                remoteName: config.data.agent,
                                requestError: requestError,
                                requestType: config.data.action,
                                responseStream: httpClient.stream,
                                responseError: responseError
                            };
                        httpClient(httpConfig);
                    },
                    depth: 2,
                    exclusions: [],
                    logRecursion: config.logRecursion,
                    mode: "read",
                    path: config.value,
                    symbolic: true
                },
                interval = setInterval(intervalHandler, 60000);
            vars.testLogger("fileService", "watchHandler", "Central watch handler for file systems outside current device, checked against a timed interval");
            if (serverVars.watches[config.value] !== undefined) {
                serverVars.watches[config.value].time = Date.now();
            }
            // create directoryList object and send to remote
            directory(dirConfig);
            config.logRecursion = false;
        }
    }
};

export default watchHandler;