
/* lib/terminal/server/fileService - This library executes various file system related services and actions. */
import { Hash } from "crypto";
import * as fs from "fs";
import * as http from "http";
import { Stream, Writable } from "stream";
import * as zlib from "zlib";

import agents from "../../common/agents.js";
import base64 from "../commands/base64.js";
import commas from "../../common/commas.js";
import copy from "../commands/copy.js";
import directory from "../commands/directory.js";
import error from "../utilities/error.js";
import hash from "../commands/hash.js";
import log from "../utilities/log.js";
import mkdir from "../commands/mkdir.js";
import prettyBytes from "../../common/prettyBytes.js";
import remove from "../commands/remove.js";
import vars from "../utilities/vars.js";

import httpClient from "./httpClient.js";
import response from "./response.js";
import serverVars from "./serverVars.js";

// This logRecursion variable gates test automation logging of the "directory" library
// 1. If the variable is outside the fileService library it will limit logging to one use and only for the first test
// 2. If the variable is moved within the fileService library it will limit logging to one use per each test
// 3. If the variable is reassigned to a value of 'false' it will eliminate "directory" logging for all tests regardless of scope
let logRecursion:boolean = true;
const fileService = function terminal_server_fileService(serverResponse:http.ServerResponse, data:fileService):void {
    // formats a string to convey file copy status
    const localDevice:boolean = (data.agent === serverVars.hashDevice),
        remoteUsers:[string, string] = (function terminal_server_fileService_remoteUsers():[string, string] {
            const values:[string, string] = ["", ""],
                perAgent = function terminal_server_fileService_remoteUsers_perAgent(agentNames:agentNames):void {
                    if (agentNames.agentType === "device") {
                        if (serverVars.device[agentNames.agent].shares[data.share] !== undefined) {// || (index === 1 && serverVars.device[agentNames.agent].shares[data.share] !== undefined)) {
                            values[0] = agentNames.agent;
                        } else if (serverVars.device[agentNames.agent].shares[data.copyShare] !== undefined) {
                            values[1] = agentNames.agent;
                        }
                    }
                };
            if ((data.agentType === "user" && data.agent === serverVars.hashUser) || (data.copyType === "user" && data.copyAgent === serverVars.hashUser)) {
                agents({
                    countBy: "agent",
                    perAgent: perAgent,
                    source: serverVars
                });
            }
            return values;
        }()),
        copyMessage = function (numbers:completeStatus):string {
            const filePlural:string = (numbers.countFile === 1)
                    ? ""
                    : "s",
                failPlural:string = (numbers.failures === 1)
                    ? ""
                    : "s",
                verb:string = (numbers.percent === 100)
                    ? "Copy"
                    : `Copying ${numbers.percent.toFixed(2)}%`;
            vars.testLogger("fileService", "copyMessage", "Status information about multiple file copy.");
            return `${verb} complete. ${commas(numbers.countFile)} file${filePlural} written at size ${prettyBytes(numbers.writtenSize)} (${commas(numbers.writtenSize)} bytes) with ${numbers.failures} integrity failure${failPlural}.`
        },
        // prepares a file list from a remote device otherwise writes the http response if the same device
        fileCallback = function terminal_server_fileService_fileCallback(message:string):void {
            const copyStatus:copyStatus = {
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
                response(serverResponse, "text/plain", payload);
            } else {
                const dirConfig:readDirectory = {
                    callback: function terminal_server_fileService_fileCallback_dir(directory:directoryList):void {
                        const location:string = (data.name.indexOf("\\") < 0 || data.name.charAt(data.name.indexOf("\\") + 1) === "\\")
                                ? data.name
                                : data.name.replace(/\\/g, "\\\\"),
                            update:fsUpdateRemote = {
                                agent: data.agent,
                                agentType: data.agentType,
                                dirs: directory,
                                fail: [],
                                location: location,
                                status: payload
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
        },
        // calls httpClient library for file system operations
        httpRequest = function terminal_server_fileService_httpRequest(callback:Function, errorMessage:string, type:"body"|"object") {
            const test:boolean = (vars.command.indexOf("test") === 0 && (data.action === "fs-base64" || data.action === "fs-destroy" || data.action === "fs-details" || data.action === "fs-hash" || data.action === "fs-new" || data.action === "fs-read" || data.action === "fs-rename" || data.action === "fs-search" || data.action === "fs-write")),
                payload:fileService = {
                    action: data.action,
                    agent: (test === true)
                        ? (data.copyType === "device")
                            ? serverVars.hashDevice
                            : serverVars.hashUser
                        : (data.action === "fs-copy-request" || data.action === "fs-cut-request")
                            ? (data.agentType === "device")
                                ? serverVars.hashDevice
                                : serverVars.hashUser
                            : data.agent,
                    agentType: (test === true && data.copyAgent !== "")
                        ? <agentType>data.copyAgent
                        : data.agentType,
                    copyAgent: (test === true)
                        ? data.agent
                        : data.copyAgent,
                    copyType: (test === true)
                        ? data.agentType
                        : data.copyType,
                    depth: data.depth,
                    id: data.id,
                    location: data.location,
                    name: data.name,
                    remoteWatch: (data.action === "fs-directory")
                        ? `${serverVars.ipAddress}_${serverVars.webPort}`
                        : (data.remoteWatch === undefined)
                            ? null
                            : data.remoteWatch,
                    share: data.share,
                    watch: data.watch
                },
                httpConfig:httpConfiguration = {
                    agentType: data.agentType,
                    callback: callback,
                    callbackType: type,
                    errorMessage: errorMessage,
                    id: data.id,
                    ip: serverVars[data.agentType][data.agent].ip,
                    payload: JSON.stringify({
                        fs: payload
                    }),
                    port: serverVars[data.agentType][data.agent].port,
                    remoteName: data.agent,
                    requestType: data.action,
                    response: serverResponse
                };
            vars.testLogger("fileService", "httpRequest", "An abstraction to the httpClient library for the fileService library.");
            httpClient(httpConfig);
        },
        // a generic handler for responding to file system watch updates
        fsUpdateLocal = function terminal_server_fileService(readLocation:string):void {
            const fsUpdateCallback = function terminal_server_fileService_fsUpdateCallback(result:directoryList):void {
                    vars.ws.broadcast(JSON.stringify({
                        "fs-update-local": result
                    }));
                },
                dirConfig:readDirectory = {
                    callback: fsUpdateCallback,
                    depth: 2,
                    exclusions: [],
                    logRecursion: logRecursion,
                    mode: "read",
                    path: readLocation,
                    symbolic: true
                };
            vars.testLogger("fileService", "fsUpdateLocal", "Read from a directory and send the data to the local browser via websocket broadcast.");
            directory(dirConfig);
            logRecursion = false;
        },
        // the file system watch handler
        watchHandler = function terminal_server_fileService_watchHandler(value:string):void {
            if (value.indexOf(vars.projectPath.replace(/(\\|\/)$/, "").replace(/\\/g, "\\\\")) !== 0) {
                if (localDevice === true) {
                    if (serverVars.watches[value] !== undefined) {
                        const now:number = Date.now();
                        vars.testLogger("fileService", "watchHandler", "Central watch handler for local device file system");
                        if (serverVars.watches[value].time > now - 2000) {
                            fsUpdateLocal(value);
                        }
                        serverVars.watches[value].time = now;
                    }
                } else {
                    const intervalHandler = function terminal_server_fileServices_watchHandler_intervalHandler():void {
                            if (serverVars.watches[value] === undefined) {
                                clearInterval(interval);
                            } else if (Date.now() > serverVars.watches[value].time - 7200000) {
                                serverVars.watches[value].close();
                                delete serverVars.watches[value];
                                clearInterval(interval);
                            }
                        },
                        dirConfig:readDirectory = {
                            callback: function terminal_server_fileService_watchHandler_remote(result:directoryList):void {
                                const update:fsUpdateRemote = {
                                        agent: data.agent,
                                        agentType: data.agentType,
                                        dirs: result,
                                        fail: [],
                                        location: value
                                    },
                                    payload:string = JSON.stringify({
                                        "fs-update-remote": update
                                    }),
                                    httpConfig:httpConfiguration = {
                                        agentType: data.agentType,
                                        callback: function terminal_server_fileService_watchHandler_remote_directoryCallback(responseBody:Buffer|string):void {
                                            response(serverResponse, "application/json", responseBody);
                                        },
                                        callbackType: "body",
                                        errorMessage: `Error related to remote file system watch at ${data.agent}.`,
                                        id: "",
                                        ip: serverVars[data.agentType][data.agent].ip,
                                        payload: payload,
                                        port: serverVars[data.agentType][data.agent].port,
                                        remoteName: data.agent,
                                        requestType: data.action,
                                        response: serverResponse
                                    };
                                httpClient(httpConfig);
                            },
                            depth: 2,
                            exclusions: [],
                            logRecursion: logRecursion,
                            mode: "read",
                            path: value,
                            symbolic: true
                        },
                        interval = setInterval(intervalHandler, 60000);
                    vars.testLogger("fileService", "watchHandler", "Central watch handler for file systems outside current device, checked against a timed interval");
                    if (serverVars.watches[value] !== undefined) {
                        serverVars.watches[value].time = Date.now();
                    }
                    // create directoryList object and send to remote
                    directory(dirConfig);
                    logRecursion = false;
                }
            }
        },
        // prepares the list of selected files on a remote device in response to a file system action
        remoteCopyList = function terminal_server_fileService_remoteCopyList(config:remoteCopyList):void {
            const list: [string, string, string, number][] = [],
                callback = function terminal_server_fileService_remoteCopyList_callback(dir:directoryList):void {
                    const dirLength:number = dir.length,
                        location:string = (function terminal_server_fileServices_remoteCopyList_callback_location():string {
                            let backSlash:number = data.location[config.index].indexOf("\\"),
                                forwardSlash:number = data.location[config.index].indexOf("/"),
                                remoteSep:string = ((backSlash < forwardSlash && backSlash > -1 && forwardSlash > -1) || forwardSlash < 0)
                                    ? "\\"
                                    : "/",
                                address:string[] = data.location[config.index].replace(/(\/|\\)$/, "").split(remoteSep);
                            address.pop();
                            return address.join(remoteSep) + remoteSep;
                        }());
                    let b:number = 0,
                        size:number,
                        largest:number = 0,
                        largeFile:number = 0,
                        stat:fs.Stats;
                    // list schema:
                    // 0. full item path
                    // 1. item type: directory, file
                    // 2. relative path from point of user selection
                    // 3. size in bytes from Stats object
                    do {
                        if (dir[b][1] === "file") {
                            stat = <fs.Stats>dir[b][5];
                            size = stat.size;
                            fileCount = fileCount + 1;
                            fileSize = fileSize + size;
                            if (size > largest) {
                                largest = size;
                            }
                            if (size > 4294967296) {
                                largeFile = largeFile + 1;
                            }
                        } else {
                            size = 0;
                            directories = directories + 1;
                        }
                        list.push([dir[b][0], dir[b][1], dir[b][0].replace(location, ""), size]);
                        b = b + 1;
                    } while (b < dirLength);
                    config.index = config.index + 1;
                    if (config.index < config.length) {
                        const recursiveConfig:readDirectory = {
                            callback: terminal_server_fileService_remoteCopyList_callback,
                            depth: 0,
                            exclusions: [],
                            logRecursion: logRecursion,
                            mode: "read",
                            path: data.location[config.index],
                            symbolic: false
                        };
                        directory(recursiveConfig);
                        logRecursion = false;
                    } else {
                        // sort directories ahead of files and then sort shorter directories before longer directories
                        // * This is necessary to ensure directories are written before the files and child directories that go in them.
                        const details:remoteCopyListData = {
                            directories: directories,
                            fileCount: fileCount,
                            fileSize: fileSize,
                            id: config.id,
                            list: list,
                            stream: (largest > 12884901888 || largeFile > 3 || (fileSize / fileCount) > 4294967296)
                        };
                        list.sort(function terminal_server_fileService_sortFiles(itemA:[string, string, string, number], itemB:[string, string, string, number]):number {
                            if (itemA[1] === "directory" && itemB[1] !== "directory") {
                                return -1;
                            }
                            if (itemA[1] !== "directory" && itemB[1] === "directory") {
                                return 1;
                            }
                            if (itemA[1] === "directory" && itemB[1] === "directory") {
                                if (itemA[2].length < itemB[2].length) {
                                    return -1;
                                }
                                return 1;
                            }
                            if (itemA[2] < itemB[2]) {
                                return -1;
                            }
                            return 1;
                        });
                        config.callback(details);
                    }
                },
                dirConfig:readDirectory = {
                    callback: callback,
                    depth: 0,
                    exclusions: [],
                    logRecursion: logRecursion,
                    mode: "read",
                    path: data.location[config.index],
                    symbolic: false
                };
            let directories:number =0,
                fileCount:number = 0,
                fileSize:number = 0;
            vars.testLogger("fileService", "remoteCopyList", "Gathers the directory data from the requested file system trees so that the local device may request each file from the remote.");
            directory(dirConfig);
            logRecursion = false;
        },
        // when copying files to a different location that location needs to request the files
        requestFiles = function terminal_server_fileService_requestFiles(fileData:remoteCopyListData):void {
            let writeActive:boolean = false,
                writtenSize:number = 0,
                writtenFiles:number = 0,
                a:number = 0,
                activeRequests:number = 0,
                countDir:number = 0,
                countFile:number = 0;
            const fileQueue:[string, number, string, Buffer][] = [],
                hashFail:string[] = [],
                listLength = fileData.list.length,
                cutList:[string, string][] = [],
                // prepares the HTTP response message if all requested files are written
                respond = function terminal_server_fileService_requestFiles_respond():void {
                    const status:completeStatus = {
                            countFile: countFile,
                            failures: hashFail.length,
                            percent: 100,
                            writtenSize: writtenSize
                        },
                        output:copyStatus = {
                            failures: hashFail,
                            message: copyMessage(status),
                            target: `local-${data.name.replace(/\\/g, "\\\\")}`
                        },
                        cut = function terminal_server_fileService_requestFiles_respond_cut():void {
                            if (data.action.indexOf("fs-cut") === 0) {
                                const types:string[] = [];
                                cutList.sort(function terminal_server_fileService_requestFiles_respond_cut_cutSort(itemA:[string, string], itemB:[string, string]):number {
                                    if (itemA[1] === "directory" && itemB[1] !== "directory") {
                                        return 1;
                                    }
                                    return -1;
                                });
                                data.location = [];
                                cutList.forEach(function terminal_server_fileService_requestFiles_respond_cut_cutList(value:[string, string]):void {
                                    data.location.push(value[0]);
                                    types.push(value[1]);
                                });
                                data.action = "fs-cut-remove";
                                data.name = JSON.stringify(types);
                                data.watch = fileData.list[0][0].slice(0, fileData.list[0][0].lastIndexOf(fileData.list[0][2])).replace(/(\/|\\)+$/, "");
                                httpRequest(function terminal_server_fileService_requestFiles_respond_cut_cutCall(responseBody:string|Buffer):void {
                                    log([<string>responseBody]);
                                }, "Error requesting file removal for fs-cut.", "body");
                            }
                        };
                    vars.testLogger("fileService", "requestFiles respond", "When all requested artifacts are written write the HTTP response to the browser.");
                    log([``]);
                    cut();
                    vars.ws.broadcast(JSON.stringify({
                        "file-list-status": output
                    }));
                    output.target = `remote-${fileData.id}`;
                    response(serverResponse, "application/json", JSON.stringify({
                        "file-list-status": output
                    }));
                },
                // handler to write files if files are written in a single shot, otherwise files are streamed with writeStream
                writeFile = function terminal_server_fileService_requestFiles_writeFile(index:number):void {
                    const fileName:string = fileQueue[index][0];
                    vars.testLogger("fileService", "writeFile", "Writing files in a single shot is more efficient, due to concurrency, than piping into a file from an HTTP stream but less good for integrity.");
                    vars.node.fs.writeFile(data.name + vars.sep + fileName, fileQueue[index][3], function terminal_server_fileServices_requestFiles_writeFile_write(wr:nodeError):void {
                        const hashFailLength:number = hashFail.length;
                        if (wr !== null) {
                            log([`Error writing file ${fileName} from remote agent ${data.agent}`, wr.toString()]);
                            vars.ws.broadcast(JSON.stringify({
                                error: `Error writing file ${fileName} from remote agent ${data.agent}`
                            }));
                            hashFail.push(fileName);
                        } else {
                            const status:completeStatus = {
                                    countFile: countFile,
                                    failures: hashFailLength,
                                    percent: ((writtenSize / fileData.fileSize) * 100),
                                    writtenSize: writtenSize
                                },
                                output:copyStatus = {
                                    failures: [],
                                    message: copyMessage(status),
                                    target: `local-${data.name.replace(/\\/g, "\\\\")}`
                                };
                            cutList.push([fileQueue[index][2], "file"]);
                            countFile = countFile + 1;
                            if (vars.command.indexOf("test") !== 0) {
                                writtenFiles = writtenFiles + 1;
                                writtenSize = writtenSize + fileQueue[index][1];
                            }
                            vars.ws.broadcast(JSON.stringify({
                                "file-list-status": output
                            }));
                        }
                        if (index < fileQueue.length - 1) {
                            terminal_server_fileService_requestFiles_writeFile(index + 1);
                        } else {
                            if (countFile + countDir + hashFailLength === listLength) {
                                respond();
                            } else {
                                writeActive = false;
                            }
                        }
                    });
                },
                // stream handler if files are streamed, otherwise files are written in a single shot using writeFile
                writeStream = function terminal_server_fileService_requestFiles_writeStream(fileResponse:http.IncomingMessage):void {
                    const fileName:string = <string>fileResponse.headers.file_name,
                        filePath:string = data.name + vars.sep + fileName,
                        decompress:zlib.BrotliDecompress = (fileResponse.headers.compression === "true")
                            ? vars.node.zlib.createBrotliDecompress()
                            : null,
                        writeStream:fs.WriteStream = vars.node.fs.createWriteStream(filePath),
                        hash:Hash = vars.node.crypto.createHash(serverVars.hashType),
                        fileError = function terminal_server_fileService_requestFiles_writeStream_fileError(message:string, fileAddress:string):void {
                            hashFail.push(fileAddress);
                            error([message]);
                            vars.node.fs.unlink(filePath, function terminal_server_fileService_requestFiles_writeStream_fileError_unlink(unlinkErr:nodeError):void {
                                if (unlinkErr !== null) {
                                    error([unlinkErr.toString()]);
                                }
                            });
                        };
                    vars.testLogger("fileService", "requestFiles writeStream", "Writing files to disk as a byte stream ensures the file's integrity so that it can be verified by hash comparison.");
                    if (fileResponse.headers.compression === "true") {
                        fileResponse.pipe(decompress).pipe(writeStream);
                    } else {
                        fileResponse.pipe(writeStream);
                    }
                    fileResponse.on("data", function terminal_server_fileService_requestFiles_writeStream_data():void {
                        const written:number = writeStream.bytesWritten + writtenSize,
                            status:completeStatus = {
                                countFile: countFile,
                                failures: hashFail.length,
                                percent: (fileData.fileSize === 0 || fileData.fileSize === undefined || vars.command.indexOf("test") === 0)
                                    ? 100
                                    : ((written / fileData.fileSize) * 100),
                                writtenSize: written
                            },
                            output:copyStatus = {
                                failures: [],
                                message: copyMessage(status),
                                target: `local-${data.name.replace(/\\/g, "\\\\")}`
                            };
                        vars.ws.broadcast(JSON.stringify({
                            "file-list-status": output
                        }));
                    });
                    fileResponse.on("end", function terminal_server_fileService_requestFiles_writeStream_end():void {
                        const hashStream:fs.ReadStream = vars.node.fs.ReadStream(filePath);
                        decompress.end();
                        hashStream.pipe(hash);
                        hashStream.on("close", function terminal_server_fileServices_requestFiles_writeStream_end_hash():void {
                            const hashString:string = hash.digest("hex");
                            if (hashString === fileResponse.headers.hash) {
                                cutList.push([<string>fileResponse.headers.cut_path, "file"]);
                                countFile = countFile + 1;
                                writtenFiles = writtenFiles + 1;
                                writtenSize = writtenSize + fileData.list[a][3];
                            } else {
                                log([`Hashes do not match for file ${fileName} from agent ${data.agent}`]);
                                fileError(`Hashes do not match for file ${fileName} from agent ${data.agent}`, filePath);
                            }
                            a = a + 1;
                            if (a < listLength) {
                                requestFile();
                            } else {
                                respond();
                            }
                        });
                    });
                    fileResponse.on("error", function terminal_server_fileService_requestFiles_writeStream_error(error:nodeError):void {
                        fileError(error.toString(), filePath);
                    });
                },
                // the callback for each file request
                fileRequestCallback = function terminal_server_fileService_requestFiles_fileRequestCallback(fileResponse:http.IncomingMessage):void {
                    const fileChunks:Buffer[] = [],
                        writeable:Writable = new Stream.Writable(),
                        responseEnd = function terminal_server_fileService_requestFiles_fileRequestCallback_responseEnd(file:Buffer):void {
                            const fileName:string = <string>fileResponse.headers.file_name,
                                hash:Hash = vars.node.crypto.createHash(serverVars.hashType).update(file),
                                hashString:string = hash.digest("hex");
                            vars.testLogger("fileService", "requestFiles fileRequestCallback responseEnd", "Handler for completely received HTTP response of requested artifact.");
                            if (hashString === fileResponse.headers.hash) {
                                fileQueue.push([fileName, Number(fileResponse.headers.file_size), <string>fileResponse.headers.cut_path, file]);
                                if (writeActive === false) {
                                    writeActive = true;
                                    writeFile(fileQueue.length - 1);
                                }
                            } else {
                                hashFail.push(fileName);
                                log([`Hashes do not match for file ${fileName} from agent ${data.agent}`]);
                                error([`Hashes do not match for file ${fileName} from agent ${data.agent}`]);
                                if (countFile + countDir + hashFail.length === listLength) {
                                    respond();
                                }
                            }
                            activeRequests = activeRequests - 1;
                            if (a < listLength) {
                                requestFile();
                            }
                        };
                    vars.testLogger("fileService", "requestFiles fileRequestCallback", "Callback for the HTTP artifact request if the requests are not streams but the files are written as streams.");
                    writeable.write = function (writeableChunk:Buffer):boolean {
                        fileChunks.push(writeableChunk);
                        return false;
                    };
                    fileResponse.on("data", function terminal_server_fileServices_requestFiles_fileRequestCallback_data(fileChunk:Buffer):void {
                        fileChunks.push(fileChunk);
                    });
                    fileResponse.on("end", function terminal_server_fileServices_requestFiles_fileRequestCallback_end():void {
                        if (fileResponse.headers.compression === "true") {
                            vars.node.zlib.brotliDecompress(Buffer.concat(fileChunks), function terminal_server_fileServices_requestFiles_fileRequestCallback_data_decompress(errDecompress:nodeError, file:Buffer):void {
                                if (errDecompress !== null) {
                                    error([errDecompress.toString()]);
                                    return;
                                }
                                responseEnd(file);
                            });
                        } else {
                            responseEnd(Buffer.concat(fileChunks));
                        }
                    });
                    fileResponse.on("error", function terminal_server_fileServices_requestFiles_fileRequestCallback_error(fileError:nodeError):void {
                        error([fileError.toString()]);
                    });
                },
                // after directories are created, if necessary, request the each file from the file list
                requestFile = function terminal_server_fileService_requestFiles_requestFile():void {
                    const writeCallback:Function = (fileData.stream === true)
                        ? writeStream
                        : fileRequestCallback;
                    vars.testLogger("fileService", "requestFiles requestFile", "Issue the HTTP request for the given artifact and recursively request the next artifact if not streamed.");
                    data.depth = fileData.list[a][3];
                    if (data.copyAgent !== serverVars.hashDevice) {
                        const status:completeStatus = {
                            countFile: countFile,
                            failures: hashFail.length,
                            percent: (fileData.fileSize === 0 || fileData.fileSize === undefined || vars.command.indexOf("test") === 0)
                                ? 100
                                : ((writtenSize / fileData.fileSize) * 100),
                            writtenSize: writtenSize
                        };
                        vars.testLogger("fileService", "requestFiles requestFile", "If copyAgent is not the local device then update the status data.");
                        data.id = `local-${data.name.replace(/\\/g, "\\\\")}|${copyMessage(status)}`;
                    }
                    data.location = [fileData.list[a][0]];
                    data.remoteWatch = fileData.list[a][2];
                    httpRequest(writeCallback, `Error on requesting file ${fileData.list[a][2]} from ${data.agent}`, "object");
                    if (fileData.stream === false) {
                        a = a + 1;
                        if (a < listLength) {
                            activeRequests = activeRequests + 1;
                            if (activeRequests < 8) {
                                terminal_server_fileService_requestFiles_requestFile();
                            }
                        }
                    }
                },
                // callback to mkdir
                dirCallback = function terminal_server_fileService_requestFiles_dirCallback():void {
                    a = a + 1;
                    countDir = countDir + 1;
                    if (a < listLength) {
                        if (fileData.list[a][1] === "directory") {
                            newDir();
                        } else {
                            data.action = <serviceFS>data.action.replace(/((list)|(request))/, "file");
                            requestFile();
                        }
                    }
                    if (countFile + countDir === listLength) {
                        vars.testLogger("fileService", "requestFiles dirCallback", "All artifacts accounted for, so write response.");
                        respond();
                    }
                },
                // recursively create new directories as necessary
                newDir = function terminal_server_fileService_requestFiles_makeLists():void {
                    mkdir(data.name + vars.sep + fileData.list[a][2], dirCallback, false);
                    cutList.push([fileData.list[a][0], "directory"]);
                };
            if (fileData.stream === true) {
                const filePlural:string = (fileData.fileCount === 1)
                        ? ""
                        : "s",
                    output:copyStatus = {
                        failures: [],
                        message: `Copy started for ${fileData.fileCount} file${filePlural} at ${prettyBytes(fileData.fileSize)} (${commas(fileData.fileSize)} bytes).`,
                        target: `local-${data.name.replace(/\\/g, "\\\\")}`
                    };
                vars.ws.broadcast(JSON.stringify({
                    "file-list-status": output
                }));
            }
            vars.testLogger("fileService", "requestFiles", "A giant function to request one or more files from a remote/user device.  Before files are requested the directory structure is locally created.");
            if (fileData.list[0][1] === "directory") {
                newDir();
            } else {
                data.action = <serviceFS>data.action.replace(/((list)|(request))/, "file");
                requestFile();
            }
        },
        // instructions to copy files from one location to another on the same device
        copySameAgent = function terminal_server_fileService_copySameAgent():void {
            let count:number = 0,
                countFile:number = 0,
                writtenSize:number = 0;
            const length:number = data.location.length;
            vars.testLogger("fileService", "copySameAgent", "Copying artifacts from one location to another on the same agent.");
            data.location.forEach(function terminal_server_fileService_copySameAgent_each(value:string):void {
                const callback = function terminal_server_fileService_copySameAgent_each_copy([fileCount, fileSize]):void {
                        count = count + 1;
                        countFile = countFile + fileCount;
                        writtenSize = (vars.command.indexOf("test") === 0)
                            ? 0
                            : writtenSize + fileSize;
                        if (count === length) {
                            const status:completeStatus = {
                                countFile: countFile,
                                failures: 0,
                                percent: 100,
                                writtenSize: writtenSize
                            };
                            fileCallback(copyMessage(status));
                        }
                    },
                    copyConfig:nodeCopyParams = {
                        callback: callback,
                        destination:data.name,
                        exclusions:[""],
                        target:value
                    };
                copy(copyConfig);
            });
        };
    if (data.location[0] === "**root**" && localDevice === true) {
        data.location[0] = vars.sep;
    }
    if (localDevice === false && (data.action === "fs-base64" || data.action === "fs-destroy" || data.action === "fs-details" || data.action === "fs-hash" || data.action === "fs-new" || data.action === "fs-read" || data.action === "fs-rename" || data.action === "fs-search" || data.action === "fs-write")) {
        vars.testLogger("fileService", "not local agent", "Most of the primitive file system operations only need to occur on the target agent.");
        httpRequest(function terminal_server_fileService_genericHTTP(responseBody:string|Buffer):void {
            response(serverResponse, "application/json", responseBody);
        }, `Error requesting ${data.action} from remote.`, "body");
    } else if (data.action === "fs-directory" || data.action === "fs-details") {
        if (localDevice === true || (localDevice === false && typeof data.remoteWatch === "string" && data.remoteWatch.length > 0)) {
            const callback = function terminal_server_fileService_putCallback(result:directoryList):void {
                    count = count + 1;
                    if (result.length > 0) {
                        failures = failures.concat(result.failures);
                        output = output.concat(result);
                    }
                    if (count === pathLength) {
                        const responseData:fsRemote = {
                            dirs: "missing",
                            fail:[],
                            id: data.id
                        };
                        if (output.length < 1) {
                            response(serverResponse, "application/json", JSON.stringify(responseData));
                        } else {
                            responseData.dirs = output;
                            responseData.fail = failures;
                            response(serverResponse, "application/json", JSON.stringify(responseData));
                        }
                        
                        // please note
                        // watch is ignored on all operations other than fs-directory
                        // fs-directory will only read from the first value in data.location
                        if (result.length > 0 && data.watch !== "no" && data.watch !== vars.projectPath) {
                            const watchPath:string = result[0][0].replace(/\\/g, "\\\\");
                            if (data.watch !== "yes" && serverVars.watches[data.watch] !== undefined) {
                                serverVars.watches[data.watch].close();
                                delete serverVars.watches[data.watch];
                            }
                            if (serverVars.watches[watchPath] === undefined) {
                                serverVars.watches[watchPath] = vars.node.fs.watch(watchPath, {
                                    recursive: (process.platform === "win32" || process.platform === "darwin")
                                }, function terminal_server_fileService_putCallback_watch(eventType:string, fileName:string):void {
                                    // throttling is necessary in the case of recursive watches in areas the OS frequently stores user settings
                                    if (fileName !== null && fileName.split(vars.sep).length < 2) {
                                        watchHandler(watchPath);
                                    }
                                });
                            } else {
                                serverVars.watches[watchPath].time = Date.now();
                            }
                        }
                    }
                },
                windowsRoot = function terminal_server_fileService_windowsRoot():void {
                    //cspell:disable
                    vars.node.child("wmic logicaldisk get name", function terminal_server_fileService_windowsRoot(erw:Error, stdout:string, stderr:string):void {
                    //cspell:enable
                        if (erw !== null) {
                            error([erw.toString()]);
                        } else if (stderr !== "" && stderr.indexOf("The ESM module loader is experimental.") < 0) {
                            error([stderr]);
                        }
                        const drives:string[] = stdout.replace(/Name\s+/, "").replace(/\s+$/, "").replace(/\s+/g, " ").split(" "),
                            length:number = drives.length,
                            date:Date = new Date(),
                            driveList = function terminal_server_fileService_windowsRoot_driveList(result:directoryList):void {
                                let b:number = 1;
                                const resultLength:number = result.length,
                                    masterIndex:number = masterList.length;
                                if (resultLength > 0) {
                                    do {
                                        result[b][3] = masterIndex; 
                                        b = b + 1;
                                    } while (b < resultLength);
                                    masterList = masterList.concat(result);
                                }
                                a = a + 1;
                                if (a === length) {
                                    callback(masterList);
                                }
                            };
                        let masterList:directoryList = [["\\", "directory", "", 0, length, {
                                dev: 0,
                                ino: 0,
                                mode: 0,
                                nlink: 0,
                                uid: 0,
                                gid: 0,
                                rdev: 0,
                                size: 0,
                                blksize: 0,
                                blocks: 0,
                                atimeMs: 0,
                                mtimeMs: 0,
                                ctimeMs: 0,
                                birthtimeMs: 0,
                                atime: date,
                                mtime: date,
                                ctime: date,
                                birthtime: date,
                                isBlockDevice: function terminal_server_create_windowsRoot_isBlockDevice():boolean {
                                    return false;
                                },
                                isCharacterDevice: function terminal_server_create_windowsRoot_isCharacterDevice():boolean {
                                    return false;
                                },
                                isDirectory: function terminal_server_create_windowsRoot_isDirectory():boolean {
                                    return false;
                                },
                                isFIFO: function terminal_server_create_windowsRoot_isFIFO():boolean {
                                    return false;
                                },
                                isFile: function terminal_server_create_windowsRoot_isFile():boolean {
                                    return false;
                                },
                                isSocket: function terminal_server_create_windowsRoot_isSocket():boolean {
                                    return false;
                                },
                                isSymbolicLink: function terminal_server_create_windowsRoot_isSymbolicLink():boolean {
                                    return false;
                                }
                            }]],
                            a:number = 0;
                        drives.forEach(function terminal_server_fileService_windowsRoot_each(value:string) {
                            const dirConfig:readDirectory = {
                                callback: driveList,
                                depth: 1,
                                exclusions: [],
                                logRecursion: logRecursion,
                                mode: "read",
                                path: `${value}\\`,
                                symbolic: true
                            };
                            directory(dirConfig);
                            logRecursion = false;
                        });
                    });
                },
                pathList:string[] = data.location,
                pathLength:number = pathList.length;
            let count:number = 0,
                output:directoryList = [],
                failures:string[] = [];
            vars.testLogger("fileService", "fs-directory and watch", "Access local directory data and set watch or set watch for remote agent directory.");
            pathList.forEach(function terminal_server_fileService_pathEach(value:string):void {
                if (value === "\\" || value === "\\\\") {
                    windowsRoot();
                } else {
                    vars.node.fs.stat(value, function terminal_server_fileService_pathEach_putStat(erp:nodeError):void {
                        const dirConfig:readDirectory = {
                            callback: callback,
                            depth: data.depth,
                            exclusions: [],
                            logRecursion: logRecursion,
                            mode: "read",
                            path: value,
                            symbolic: true
                        };
                        if (erp !== null) {
                            error([erp.toString()]);
                            callback([]);
                            return;
                        }
                        if ((/^\w:$/).test(value) === true) {
                            value = value + "\\";
                        }
                        directory(dirConfig);
                        logRecursion = false;
                    });
                }
            });
        } else {
            vars.testLogger("fileService", "fs-details remote", "Get directory data from a remote agent without setting a file system watch.");
            // remote file server access
            httpRequest(function terminal_server_fileService_remoteFileAccess(responseBody:string|Buffer):void {
                if (responseBody.indexOf("{\"fs-update-remote\":") === 0) {
                    vars.ws.broadcast(responseBody);
                    response(serverResponse, "text/plain", "Terminal received file system response from remote.");
                } else {
                    response(serverResponse, "application/json", responseBody);
                }
            }, `Error on reading from remote file system at agent ${data.agent}`, "body");
        }
    } else if (data.action === "fs-close") {
        vars.testLogger("fileService", "fs-close", "Close a file system watch.");
        if (serverVars.watches[data.location[0]] !== undefined) {
            serverVars.watches[data.location[0]].close();
            delete serverVars.watches[data.location[0]];
        }
        fileCallback(`Watcher ${data.location[0]} closed.`);
    } else if (data.action === "fs-copy" || data.action === "fs-cut") {
        vars.testLogger("fileService", "fs-copy", "All branches of file system copy");
        if (localDevice === true) {
            if (data.copyAgent === serverVars.hashDevice && data.copyType === "device") {
                // * data.agent === local
                // * data.copyAgent === local
                vars.testLogger("fileService", "fs-copy copySameAgent", "Call copySameAgent if data.agent and data.copyAgent are the same agents.");
                copySameAgent();
            } else {
                // copy from local to remote
                // * data.agent === local
                // * data.copyAgent === remote
                // * response here is just for maintenance.  A list of files is pushed and the remote needs to request from that list, but otherwise a response isn't needed here.
                const listData:remoteCopyList = {
                    callback: function terminal_server_fileService_remoteListCallback(listData:remoteCopyListData):void {
                        data.action = <serviceType>`${data.action}-request`;
                        data.agent = data.copyAgent;
                        data.agentType = data.copyType;
                        data.remoteWatch = JSON.stringify(listData);
                        httpRequest(function terminal_server_fileService_remoteListCallback_http(responseBody:string|Buffer):void {
                            response(serverResponse, "application/json", responseBody);
                        }, "Error sending list of files to remote for copy from local device.", "body");
                    },
                    files: [],
                    id: data.id,
                    index: 0,
                    length: data.location.length
                };
                vars.testLogger("fileService", "fs-copy destination-not-local", "When the destination is not the local device call the remoteCopyList function to get a list of artifacts to request.");
                remoteCopyList(listData);
            }
        } else if (data.copyAgent === serverVars.hashDevice && data.copyType === "device") {
            // data.agent === remote
            // data.copyAgent === local
            vars.testLogger("fileService", "fs-copy origination-not-local", "When the files exist on the local device but are requested remotely then the remote agent must request the list of files to know what to request.");
            data.action = <serviceType>`${data.action}-list`;
            httpRequest(function terminal_server_fileService_httpCopy(responseBody:string|Buffer):void {
                requestFiles(JSON.parse(<string>responseBody));
            }, "Error copying from remote to local device", "body");
        } else if (data.agent === data.copyAgent && data.agentType === data.copyType) {
            // * data.agent === sameRemoteAgent
            // * data.agent === sameRemoteAgent
            vars.testLogger("fileService", "fs-copy destination-origination-same", "When the destination and origination are the same agent that remote agent must be told to perform a same agent copy.");
            data.action = <serviceType>`${data.action}-self`;
            httpRequest(function terminal_server_fileService_sameRemote(responseBody:string|Buffer):void {
                response(serverResponse, "application/json", responseBody);
            }, `Error copying files to and from agent ${data.agent}.`, "body");
        } else {
            const agent:string = data.agent;
            // * data.agent === remoteAgent
            // * data.copyAgent === differentRemoteAgent
            vars.testLogger("fileService", "fs-copy destination-origination-different", "When the origination and destination are different and neither is the local device the destination device must be told to start the destination-not-local operation and then respond back with status.");
            data.action = <serviceType>`${data.action}-list-remote`;
            data.agent = data.copyAgent;
            data.copyAgent = agent;
            data.remoteWatch = serverVars.hashDevice;
            data.watch = "third party action";
            httpRequest(function terminal_server_fileService_httpRemoteRemote(responseBody:string|Buffer):void {
                //console.log("");
                //console.log("responseBody");
                //console.log(responseBody);
                //requestFiles(JSON.parse(<string>responseBody));
                log([<string>responseBody]);
            }, "Error copying from remote to local device", "body");
        }
    } else if (data.action === "fs-copy-list-remote" || data.action === "fs-cut-list-remote") {
        // issue a fs-copy-list on an agent from a different agent
        const agent:string = data.agent;
        vars.testLogger("fileService", "fs-copy-list-remote", "Initiates the copy procedure from the destination agent when both the destination and origination are different and not the local device.");
        data.agent = data.copyAgent;
        data.copyAgent = agent;
        data.action = <serviceType>`${data.action.replace("-remote", "")}`;
        httpRequest(function terminal_server_fileService_httpCopyRemote(responseBody:string|Buffer):void {
            requestFiles(JSON.parse(<string>responseBody));
        }, "Error copying from remote to local device", "body");
    } else if (data.action === "fs-copy-file" || data.action === "fs-cut-file") {
        // respond with a single file
        // * generated internally from function requestFiles
        // * fs-copy-list and fs-cut-list (copy from remote to local device)
        // * fs-copy-request and fs-cut-request (copy from local device to remote)
        const hash:Hash = vars.node.crypto.createHash(serverVars.hashType),
            hashStream:fs.ReadStream = vars.node.fs.ReadStream(data.location[0]);
        vars.testLogger("fileService", "fs-copy-file", "Respond to a file request with the file and its hash value.");
        hashStream.pipe(hash);
        hashStream.on("close", function terminal_server_fileService_fileRequest():void {
            const readStream:fs.ReadStream = vars.node.fs.ReadStream(data.location[0]),
                compress:zlib.BrotliCompress = (serverVars.brotli > 0)
                    ? vars.node.zlib.createBrotliCompress({
                        params: {[vars.node.zlib.constants.BROTLI_PARAM_QUALITY]: serverVars.brotli}
                    })
                    : null;
            serverResponse.setHeader("hash", hash.digest("hex"));
            serverResponse.setHeader("file_name", data.remoteWatch);
            serverResponse.setHeader("file_size", data.depth);
            serverResponse.setHeader("cut_path", data.location[0]);
            if (serverVars.brotli > 0) {
                serverResponse.setHeader("compression", "true");
            } else {
                serverResponse.setHeader("compression", "false");
            }
            serverResponse.writeHead(200, {"Content-Type": "application/octet-stream; charset=binary"});
            if (serverVars.brotli > 0) {
                readStream.pipe(compress).pipe(serverResponse);
            } else {
                readStream.pipe(serverResponse);
            }
        });
        if (data.id.indexOf("|Copying ") > 0) {
            vars.ws.broadcast(JSON.stringify({
                "file-list-status": {
                    failures: [],
                    message: data.id.slice(data.id.indexOf("|") + 1),
                    target: data.id.slice(0, data.id.indexOf("|"))
                }
            }));
        }
    } else if (data.action === "fs-copy-list" || data.action === "fs-cut-list") {
        const listData:remoteCopyList = {
            callback: function terminal_server_fileService_remoteListCallback(listData:remoteCopyListData):void {
                response(serverResponse, "application/octet-stream", JSON.stringify(listData));
            },
            files: [],
            id: data.id,
            index: 0,
            length: data.location.length
        };
        vars.testLogger("fileService", "fs-copy-list", "Call the remoteCopyList function so that a remote agent knows what files to request.");
        remoteCopyList(listData);
    } else if (data.action === "fs-copy-request" || data.action === "fs-cut-request") {
        vars.testLogger("fileService", "fs-copy-request", "Calls the requestFiles function from a remote agent.");
        requestFiles(JSON.parse(data.remoteWatch));
    } else if (data.action === "fs-copy-self" || data.action === "fs-cut-self") {
        vars.testLogger("fileService", "fs-copy-self", "Copies files from one location to another on the same local device as requested by a remote agent.");
        copySameAgent();
    } else if (data.action === "fs-cut-remove") {
        let a:number = 0;
        const length:number = data.location.length,
            watchTest:boolean = (serverVars.watches[data.watch] !== undefined),
            types:string[] = JSON.parse(data.name),
            fsRemove = function terminal_server_fileService_cutRemove():void {
                // recursive function to remove artifacts one by one so that there aren't collisions
                if (a === length - 1 && watchTest === true) {
                    serverVars.watches[data.watch] = vars.node.fs.watch(data.watch, {
                        recursive: (process.platform === "win32" || process.platform === "darwin")
                    }, function terminal_server_fileService_cutRemote_watch():void {
                        watchHandler(data.watch);
                    });
                }
                if (a < length) {
                    if (types[a] === "file") {
                        remove(data.location[a], terminal_server_fileService_cutRemove);
                        a = a + 1;
                    } else {
                        vars.node.fs.readdir(data.location[a], function terminal_server_fileService_cutRemove_readdir(erd:nodeError, items:string[]):void {
                            if (erd === null && items.length < 1) {
                                remove(data.location[a], terminal_server_fileService_cutRemove);
                                a = a + 1;
                            }
                        });
                    }
                } else {
                    response(serverResponse, "text/plain", "File system items removed.");
                }
            };
        if (watchTest === true) {
            serverVars.watches[data.watch].close();
        }
        vars.testLogger("fileService", "fs-cut-remote", "Removes artifacts from the origination once all other operations are complete and integrity is verified.");
        fsRemove();
    } else if (data.action === "fs-destroy") {
        let count:number = 0;
        vars.testLogger("fileService", "fs-destroy", `Destroying: ${data.location}`);
        data.location.forEach(function terminal_server_fileService_destroyEach(value:string):void {
            if (serverVars.watches[value] !== undefined) {
                serverVars.watches[value].close();
                delete serverVars.watches[value];
            }
            remove(value, function terminal_server_fileService_destroyEach_remove():void {
                count = count + 1;
                if (count === data.location.length) {
                    if (data.name === "") {
                        const agent:string = (data.copyAgent === "")
                                ? serverVars.hashDevice
                                : data.copyAgent,
                            type:agentType = (data.copyAgent === "")
                                ? "device"
                                : data.copyType;
                        fileCallback(`Path(s) ${data.location.join(", ")} destroyed on ${type} ${agent}.`);
                    } else {
                        directory({
                            callback: function terminal_server_fileService_destroyEach_remove_callback(directoryList:directoryList):void {
                                const responseData:fsRemote = {
                                    dirs: directoryList,
                                    fail: directoryList.failures,
                                    id: data.id
                                };
                                response(serverResponse, "application/json", JSON.stringify(responseData));
                            },
                            depth: 2,
                            exclusions: [],
                            logRecursion: false,
                            mode: "read",
                            path: data.name,
                            symbolic: true
                        });
                    }
                }
            });
        });
    } else if (data.action === "fs-rename") {
        const newPath:string[] = data.location[0].split(vars.sep);
        vars.testLogger("fileService", "fs-rename", `Renames an existing file system artifact, ${data.name}`);
        newPath.pop();
        newPath.push(data.name);
        vars.node.fs.rename(data.location[0], newPath.join(vars.sep), function terminal_server_fileService_rename(erRename:Error):void {
            if (erRename === null) {
                const agent:string = (data.copyAgent === "")
                        ? serverVars.hashDevice
                        : data.copyAgent,
                    type:agentType = (data.copyAgent === "")
                        ? "device"
                        : data.copyType;
                vars.testLogger("fileService", "rs-rename response", `An error upon renaming artifact: ${erRename}`);
                fileCallback(`Path ${data.location[0]} on ${type} ${agent} renamed to ${newPath.join(vars.sep)}.`);
            } else {
                error([erRename.toString()]);
                log([erRename.toString()]);
                vars.testLogger("fileService", "fs-rename response", "All went well with renaming then write the HTTP response.");
                response(serverResponse, "text/plain", erRename.toString());
            }
        });
    } else if (data.action === "fs-base64" || data.action === "fs-hash" || data.action === "fs-read") {
        const length:number = data.location.length,
            storage:stringDataList = [],
            type:string = (data.action === "fs-read")
                ? "base64"
                : data.action.replace("fs-", ""),
            callback = function terminal_server_fileService_callback(output:base64Output):void {
                const stringData:stringData = {
                    content: output[type],
                    id: output.id,
                    path: output.filePath
                };
                b = b + 1;
                storage.push(stringData);
                if (b === length) {
                    vars.testLogger("fileService", "dataString callback", `Callback to action ${data.action} that writes an HTTP response.`);
                    response(serverResponse, "application/json", JSON.stringify(storage));
                }
            },
            fileReader = function terminal_server_fileService_fileReader(fileInput:base64Input):void {
                vars.node.fs.readFile(fileInput.source, "utf8", function terminal_server_fileService_fileReader_read(readError:nodeError, fileData:string) {
                    const inputConfig:base64Output = {
                        base64: fileData,
                        id: fileInput.id,
                        filePath: fileInput.source
                    };
                    vars.testLogger("fileService", "fileReader", `Reading a file for action fs-read, ${input.source}`);
                    if (readError !== null) {
                        error([readError.toString()]);
                        vars.ws.broadcast(JSON.stringify({
                            error: readError
                        }));
                        return;
                    }
                    input.callback(inputConfig);
                });
            },
            input:base64Input = {
                callback: callback,
                id: "",
                source: ""
            },
            hashInput:hashInput = {
                algorithm: serverVars.hashType,
                callback: callback,
                directInput: false,
                id: "",
                source: ""
            };
        let a:number = 0,
            b:number = 0,
            index:number;
        vars.testLogger("fileService", "dataString", `Action ${data.action}`);
        do {
            if (data.action === "fs-base64") {
                index = data.location[a].indexOf(":");
                input.id = data.location[a].slice(0, index);
                input.source = data.location[a].slice(index + 1);
                base64(input);
            } else if (data.action === "fs-hash") {
                index = data.location[a].indexOf(":");
                hashInput.id = data.location[a].slice(0, index);
                hashInput.source = data.location[a].slice(index + 1);
                hash(hashInput);
            } else if (data.action === "fs-read") {
                index = data.location[a].indexOf(":");
                input.id = data.location[a].slice(0, index);
                input.source = data.location[a].slice(index + 1);
                fileReader(input);
            }
            a = a + 1;
        } while (a < length);
    } else if (data.action === "fs-new") {
        const slash:string = (data.location[0].indexOf("/") < 0 || (data.location[0].indexOf("\\") < data.location[0].indexOf("/") && data.location[0].indexOf("\\") > -1 && data.location[0].indexOf("/") > -1))
                ? "\\"
                : "/",
            dirs = data.location[0].split(slash);
        vars.testLogger("fileService", "fs-new", `Create a new item of type ${data.name}`);
        dirs.pop();
        if (data.name === "directory") {
            mkdir(data.location[0], function terminal_server_fileService_newDirectory():void {
                fileCallback(`${data.location[0]} created.`);
                fsUpdateLocal(dirs.join(slash));
            }, false);
        } else if (data.name === "file") {
            vars.node.fs.writeFile(data.location[0], "", "utf8", function terminal_server_fileService_newFile(erNewFile:Error):void {
                if (erNewFile === null) {
                    fileCallback(`${data.location[0]} created.`);
                    fsUpdateLocal(dirs.join(slash));
                } else {
                    error([erNewFile.toString()]);
                    log([erNewFile.toString()]);
                    response(serverResponse, "text/plain", erNewFile.toString());
                }
            });
        }
    } else if (data.action === "fs-search") {
        const callback = function terminal_server_fileService_searchCallback(result:directoryList):void {
                const output:fsRemote = {
                    dirs: result,
                    fail: [],
                    id: data.id
                };
                delete result.failures;
                response(serverResponse, "application/json", JSON.stringify(output));
            },
            dirConfig:readDirectory = {
                callback: callback,
                depth: data.depth,
                exclusions: [],
                logRecursion: logRecursion,
                mode: "search",
                path: data.location[0],
                search: data.name,
                symbolic: true
            };
        vars.testLogger("fileService", "fs-search", `Performs a directory search operation on ${data.location[0]} of agent ${data.agent}`);
        directory(dirConfig);
        logRecursion = false;
    } else if (data.action === "fs-write") {
        vars.testLogger("fileService", "fs-write", "Writes or over-writes a file to disk.");
        vars.node.fs.writeFile(data.location[0], data.name, "utf8", function terminal_server_fileService_write(erw:nodeError):void {
            const agent:string = (data.copyAgent === "")
                    ? serverVars.hashDevice
                    : data.copyAgent,
                type:agentType = (data.copyAgent === "")
                    ? "device"
                    : data.copyType;
            let message:string = (type === "device" && agent === serverVars.hashDevice)
                ? `File ${data.location[0]} saved to disk on local device.`
                : `File ${data.location[0]} saved to disk on ${type} ${agent}.`;
            if (erw !== null) {
                error([erw.toString()]);
                vars.ws.broadcast(JSON.stringify({
                    error: erw
                }));
                message = `Error writing file: ${erw.toString()}`;
            }
            response(serverResponse, "text/plain", message);
        });
    }
};

export default fileService;