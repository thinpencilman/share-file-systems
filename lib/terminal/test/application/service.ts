
/* lib/terminal/test/application/service - A list of service test related utilities. */

import { ClientRequest, IncomingMessage, OutgoingHttpHeaders, RequestOptions } from "http";
import { request } from "https";

import common from "../../../common/common.js";
import remove from "../../commands/remove.js";
import readStorage from "../../utilities/readStorage.js";
import server from "../../commands/service.js";
import serverVars from "../../server/serverVars.js";
import vars from "../../utilities/vars.js";

import filePathDecode from "./file_path_decode.js";
import testComplete from "./complete.js";
import testEvaluation from "./evaluation.js";
import tests from "../samples/service.js";

// tests structure
// * artifact - the address of anything written to disk, so that it can be removed
// * command - the command to execute minus the `node js/services` part
// * file - a file system address to open
// * name - a short label to describe the test
// * qualifier - how to test, see simulationItem in index.d.ts for appropriate values
// * share - optional object containing share data to test against
// * test - the value to compare against

const projectPath:string = vars.projectPath,
    sep:string = vars.sep,
    loopback:string = (serverVars.ipFamily === "IPv6")
        ? "::1"
        : "127.0.0.1",

    // start test list
    service:testServiceApplication = {
        serverRemote: {
            device: {},
            user: {}
        }
    };

service.addServers = function terminal_test_application_services_addServers(callback:Function):void {
    const flags = {
            removal: false,
            storage: false
        },
        servers = function terminal_test_application_services_addServers_servers():void {
            const complete = function terminal_test_application_services_addServers_servers_complete(counts:agentCounts):void {
                counts.count = counts.count + 1;
                if (counts.count === counts.total) {
                    service.tests = tests();
                    callback();
                }
            };
            common.agents({
                complete: complete,
                countBy: "agent",
                perAgent: function terminal_test_application_services_addServers_servers_perAgent(agentNames:agentNames, counts:agentCounts):void {
                    const serverCallback = function terminal_test_application_services_addServers_servers_perAgent_serverCallback(output:serverOutput):void {
                        serverVars[output.agentType][output.agent].port = output.webPort;
                        serverVars[output.agentType][output.agent].ip = loopback;
                        service.serverRemote[agentNames.agentType][agentNames.agent] = output.server;
                        if (output.agentType === "device" && output.agent === serverVars.hashDevice) {
                            serverVars.wsPort = output.wsPort;
                        }
                        complete(counts);
                    };
                    server({
                        agent: agentNames.agent,
                        agentType: agentNames.agentType,
                        callback: serverCallback
                    });
                },
                source: serverVars
            });
        },
        storageComplete = function terminal_test_application_services_addServers_storageComplete(storageData:storageItems):void {
            serverVars.brotli = storageData.settings.brotli;
            serverVars.hashDevice = storageData.settings.hashDevice;
            serverVars.hashType = storageData.settings.hashType;
            serverVars.hashUser = storageData.settings.hashUser;
            serverVars.nameDevice = storageData.settings.nameDevice;
            serverVars.nameUser = storageData.settings.nameUser;
            serverVars.device = storageData.device;
            serverVars.user = storageData.user;

            flags.storage = true;
            if (flags.removal === true) {
                servers();
            }
        },
        // remove any trash left behind from a prior test
        removal = function terminal_test_application_services_addServers_removal():void {
            let count:number = 0;
            const list:string[] = [
                    `${projectPath}serviceTestLocal`,
                    `${projectPath}serviceLocal`,
                    `${projectPath}serviceTestLocal.json`,
                    `${projectPath}serviceLocal.json`,
                    `${projectPath}serviceTestRemote`,
                    `${projectPath}serviceRemote`,
                    `${projectPath}serviceTestRemote.json`,
                    `${projectPath}serviceRemote.json`,
                    `${projectPath}lib${sep}storage${sep}version.json`
                ],
                removeCallback = function terminal_test_application_services_addServers_removal_removeCallback():void {
                    count = count + 1;
                    if (count === list.length) {
                        flags.removal = true;
                        if (flags.storage === true) {
                            servers();
                        }
                    }
                };
            list.forEach(function terminal_test_application_services_addServers_removal_each(value:string):void {
                remove(value, removeCallback);
            });
        };
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
    serverVars.storage = `${projectPath}lib${sep}terminal${sep}test${sep}storageService${sep}`;
    readStorage(storageComplete);
    removal();
};

service.execute = function terminal_test_application_services_execute(config:testExecute):void {
    const index:number = (config.list.length < 1)
            ? config.index
            : config.list[config.index],
        testItem:testServiceInstance = service.tests[index],
        keyword:string = (function terminal_test_application_services_execute_keyword():string {
            const words:string[] = Object.keys(testItem.command);
            if (words[0] === "fs") {
                let a:number = testItem.command.fs.location.length;
                if (a > 0) {
                    do {
                        a = a - 1;
                        testItem.command.fs.location[a] = filePathDecode(null, testItem.command.fs.location[a]);
                    } while (a > 0);
                }
            }
            return words[0];
        }()),
        agent:string = testItem.command[keyword].agent,
        command:string = (function terminal_test_application_services_execute_command():string {
            if (keyword === "invite") {
                if (testItem.command.invite.action === "invite" || testItem.command.invite.action === "invite-response") {
                    if (testItem.command.invite.type === "device") {
                        testItem.command.invite.port = service.serverRemote.device["a5908e8446995926ab2dd037851146a2b3e6416dcdd68856e7350c937d6e92356030c2ee702a39a8a2c6c58dac9adc3d666c28b96ee06ddfcf6fead94f81054e"].port;
                    } else {
                        // add user hash here once created
                        testItem.command.invite.port = service.serverRemote.user[""].port;
                    }
                } else {
                    testItem.command.invite.port = serverVars.device[serverVars.hashDevice].port;
                }
            }
            return <string>filePathDecode(null, JSON.stringify(testItem.command));
        }()),
        name:string = (testItem.name === undefined)
            ? command
            : testItem.name,
        header:OutgoingHttpHeaders = (agent === serverVars.hashDevice || agent === undefined)
            ? {
                "content-type": "application/x-www-form-urlencoded",
                "content-length": Buffer.byteLength(command),
                "agent-name": "localUser",
                "agent-type": "device",
                "remote-user": (testItem.command[keyword].copyAgent !== undefined && testItem.command[keyword].copyAgent !== "" && testItem.command[keyword].copyAgent !== serverVars.hashDevice)
                    ? testItem.command[keyword].copyAgent
                    : "localUser"
            }
            : {
                "content-type": "application/x-www-form-urlencoded",
                "content-length": Buffer.byteLength(command),
                "agent-name": testItem.command[keyword].agent,
                "agent-type": "user",
                "remote-user": "localUser"
            },
        payload:RequestOptions = {
            headers: header,
            host: loopback,
            method: "POST",
            path: "/",
            port: (keyword === "invite")
                ? testItem.command.invite.port
                : (keyword === "heartbeat" || testItem.command[keyword].agent === undefined)
                    ? serverVars.device[serverVars.hashDevice].port
                    : serverVars[testItem.command[keyword].agentType][testItem.command[keyword].agent].port,
            timeout: 1000
        },
        evaluator = function terminal_test_application_service_execute_evaluator(message:string):void {
            const test:object|string = service.tests[index].test;
            if (typeof test === "string") {
                service.tests[index].test = filePathDecode(null, <string>test);
            } else if (Array.isArray(test) === true && typeof test[0].path === "string") {
                const arr:stringData[] = <Array<stringData>>test;
                let a:number = arr.length;
                if (a > 0) {
                    do {
                        a = a - 1;
                        test[a].path = filePathDecode(null, test[a].path);
                    } while (a > 0);
                }
            } else if (test["dirs"] !== undefined) {
                let a:number = test["dirs"].length;
                if (a > 0) {
                    do {
                        a = a -1;
                        test["dirs"][a][0] = filePathDecode(null, test["dirs"][a][0]);
                    } while (a > 0);
                }
            }
            testEvaluation({
                callback: config.complete,
                fail: config.fail,
                index: config.index,
                list: config.list,
                test: <testItem>service.tests[index],
                testType: "service",
                values: [message, "", ""]
            });
        },
        requestCallback = function terminal_test_application_service_execute_callback(response:IncomingMessage):void {
            const chunks:string[] = [];
            response.on("data", function terminal_test_application_service_execute_callback_data(chunk:string):void {
                chunks.push(chunk);
            });
            response.on("end", function terminal_test_application_service_execute_callback_end():void {
                // A delay is built into the server to eliminate a race condition between service execution and data writing.
                // * That service delay requires a delay between service test intervals to prevent tests from bleeding into each other.
                // * The delay here is the HTTP round trip plus 10ms.
                setTimeout(function terminal_test_application_service_execute_callback_end_delay():void {
                    httpRequest.end();
                    evaluator(chunks.join(""));
                }, 25);
            });
        },
        httpRequest:ClientRequest = request(payload, requestCallback);
    service.tests[index].command = command;
    if (typeof service.tests[index].artifact === "string") {
        service.tests[index].artifact = <string>filePathDecode(null, service.tests[index].artifact);
    }
    if (typeof service.tests[index].file === "string") {
        service.tests[index].file = <string>filePathDecode(null, service.tests[index].file);
    }
    httpRequest.on("error", function terminal_test_application_service_execute_error(reqError:nodeError):void {
        evaluator(`fail - Failed to execute on service test: ${name}: ${reqError.toString()}`);
    });
    httpRequest.write(command);
};

service.killServers = function terminal_test_application_services_killServers(complete:testComplete):void {
    const agentComplete = function terminal_test_application_services_killServers_agentComplete(counts:agentCounts):void {
        counts.count = counts.count + 1;
        if (counts.count === counts.total) {
            serverVars.device = {};
            serverVars.user = {};
            serverVars.watches = {};
            testComplete(complete);
        }
    };
    common.agents({
        complete: agentComplete,
        countBy: "agent",
        perAgent: function terminal_test_application_services_killServers_perAgent(agentNames:agentNames, counts:agentCounts):void {
            service.serverRemote[agentNames.agentType][agentNames.agent].close(function terminal_test_application_services_killServers_perAgent_close():void {
                agentComplete(counts);
            });
        },
        source: serverVars
    });
};

export default service;