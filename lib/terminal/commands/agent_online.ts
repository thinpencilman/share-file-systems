
/* lib/terminal/commands/agent_online - A connectivity tester to shared remote agents. */

import {ClientRequest, IncomingMessage, RequestOptions} from "http";

import common from "../../common/common.js";
import error from "../utilities/error.js";
import log from "../utilities/log.js";
import readStorage from "../utilities/readStorage.js";
import serverVars from "../server/serverVars.js";
import vars from "../utilities/vars.js";

const agentOnline = function terminal_commands_agentOnline():void {
    vars.verbose = true;
    if (process.argv[0] === undefined) {
        error([
            `${vars.text.angry}Missing parameter for agent hash.${vars.text.none}  Example:`,
            `${vars.text.green + vars.version.command} test_agent a5908e8446995926ab2dd037851146a2b3e6416dcdd68856e7350c937d6e92356030c2ee702a39a8a2c6c58dac9adc3d666c28b96ee06ddfcf6fead94f81054e${vars.text.none}`
        ]);
        return;
    }

    readStorage(function terminal_commands_agentOnline_readStorage(storage:storageItems) {
        const arg:string = process.argv[0],
            type:agentType = (storage.device[arg] === undefined)
                ? "user"
                : "device",
            hash:string = storage.settings.hashDevice;
        if (Object.keys(storage.device).length < 1) {
            error([
                `${vars.text.angry}Device data is not present in storage.${vars.text.angry}`,
                `Run the ${vars.text.cyan}server${vars.text.none} command and go to address ${vars.text.cyan}localhost${vars.text.none} in the web browser to initiate device data.`
            ]);
            return;
        }
        if (arg === "list") {
            const store:string[] = [];
            log.title("Agent List");
            common.agents({
                countBy: "agent",
                perAgent: function terminal_commands_agentOnline_readStorage_perAgent(agentNames:agentNames):void {
                    const text:string = `${vars.text.angry}*${vars.text.none} ${vars.text.green + agentNames.agent + vars.text.none} - ${storage[agentNames.agentType][agentNames.agent].name}, ${storage[agentNames.agentType][agentNames.agent].ip}`;
                    if (agentNames.agent === hash) {
                        store.push(text.replace(" - ", ` - ${vars.text.angry}(local device)${vars.text.none} - `));
                    } else {
                        store.push(text);
                    }
                },
                perAgentType: function terminal_commands_agentOnline_readStorage_perAgentType(agentNames:agentNames):void {
                    store.push("");
                    store.push(`${vars.text.cyan + vars.text.bold + common.capitalize(agentNames.agentType)}:${vars.text.none}`);
                    if (agentNames.agentType === "user" && Object.keys(storage.user).length < 1) {
                        store.push("no shared users");
                    }
                },
                source: storage
            });
            log(store, true);
        } else {
            let count:number = 0,
                total:number = 0;
            const requestWrapper = function terminal_commands_agentOnline_readStorage_request(agentType:agentType, agentHash:string):void {
                const agent:agent = storage[agentType][agentHash],
                    name:string = agent.name,
                    requestBody:string = `${vars.version.name} agent test for ${name} from ${storage.settings.nameDevice}.`,
                    payload:RequestOptions = {
                        headers: {
                            "content-type": "application/x-www-form-urlencoded",
                            "content-length": Buffer.byteLength(requestBody),
                            "agent-hash": (agentType === "device")
                                ? storage.settings.hashDevice
                                : storage.settings.hashUser,
                            "agent-name": (agentType === "device")
                                ? storage.settings.nameDevice
                                : storage.settings.nameUser,
                            "agent-type": agentType,
                            "remote-user": agentHash,
                            "request-type": "test_agent"
                        },
                        host: storage[agentType][agentHash].ip,
                        method: "GET",
                        path: "/",
                        port: storage[agentType][agentHash].port,
                        timeout: 1000
                    },
                    outputString = function terminal_commands_agentOnline_readStorage_request_errorString(output:agentOutput):string {
                        const status = (output.status === "bad")
                            ? `${vars.text.angry}Bad${vars.text.none}`
                            : `${vars.text.green + vars.text.bold}Good${vars.text.none}`;
                        return `${status} ${output.type} from ${output.agentType} ${storage[output.agentType][output.agent].name} (${vars.text.cyan + output.agent + vars.text.none}).`;
                    },
                    callback = function terminal_commands_agentOnline_readStorage_request_callback(response:IncomingMessage):void {
                        const chunks:Buffer[] = [];
                        response.setEncoding("utf8");
                        response.on("data", function terminal_commands_agentOnline_readStorage_request_callback_data(chunk:Buffer):void {
                            chunks.push(chunk);
                        });
                        response.on("end", function terminal_commands_agentOnline_readStorage_request_callback_end():void {
                            const body:string = (Buffer.isBuffer(chunks[0]) === true)
                                    ? Buffer.concat(chunks).toString()
                                    : chunks.join("");
                            count = count + 1;
                            if (body === `response from ${<string>response.headers["agent-hash"]}`) {
                                log([outputString({
                                    agent: <string>response.headers["agent-hash"],
                                    agentType: <agentType>response.headers["agent-type"],
                                    status: "good",
                                    type: "response"
                                })], (count === total));
                            } else {
                                log([
                                    outputString({
                                        agent: <string>response.headers["agent-hash"],
                                        agentType: <agentType>response.headers["agent-type"],
                                        status: "bad",
                                        type: "response"
                                    }),
                                    "Response is malformed."
                                ], (count === total));
                            }
                        });
                        response.on("error", function terminal_commands_agentOnline_readStorage_request_callback_error(httpError:nodeError):void {
                            count = count + 1;
                            log([
                                outputString({
                                    agent: <string>response.headers["agent-hash"],
                                    agentType: <agentType>response.headers["agent-type"],
                                    status: "bad",
                                    type: "response"
                                }),
                                httpError.toString()
                            ], (count === total));
                        });
                    },
                    requestError = function terminal_commands_agentOnline_readStorage_request_requestError(httpError:nodeError):void {
                        log([
                            outputString({
                                agent: agentHash,
                                agentType: agentType,
                                status: "bad",
                                type: "request"
                            }),
                            httpError.toString()
                        ], (count === total - 1));
                    },
                    scheme:string = (serverVars.secure === true)
                        ? "https"
                        : "http",
                    request:ClientRequest = vars.node[scheme].request(payload, callback);
                request.on("error", requestError);
                request.write(requestBody);
                request.end();
            }
            if (arg === "all" || arg === "device" || arg === "user") {
                if (arg === "all") {
                    log.title("Test All Agent Connectivity");
                } else {
                    log.title(`Test Each ${common.capitalize(arg)} Agent`);
                }
                common.agents({
                    countBy: "agent",
                    perAgent: function terminal_commands_agentOnline_readStorage_perAgent(agentNames:agentNames):void {
                        if (agentNames.agent !== storage.settings.hashDevice && (arg === "all" || agentNames.agentType === arg)) {
                            total = total + 1;
                            requestWrapper(agentNames.agentType, agentNames.agent);
                        }
                    },
                    perAgentType: function terminal_commands_commands_agentOnline_readStorage_perAgentType(agentNames:agentNames):void {
                        if (agentNames.agentType === "user" && Object.keys(storage.user).length < 1) {
                            log([`${vars.text.cyan + vars.text.bold}No users to test.${vars.text.none}`]);
                        } else if (agentNames.agentType === "device" && Object.keys(storage.device).length < 2) {
                            log([`${vars.text.cyan + vars.text.bold}No other devices to test.${vars.text.none}`]);
                        }
                    },
                    source: storage
                });
                return;
            }
            if (storage[type][arg] === undefined) {
                error([`${vars.text.angry}Parameter ${arg} is either not an accepted agent identifier or is not present in storage files device.json or user.json.${vars.text.none}`]);
                return;
            }
            if (arg === hash) {
                log([`The requested agent is this local device.  ${vars.text.angry}No connectivity test performed.${vars.text.none}`], true);
                return;
            }
            log.title("Agent test for Single Agent");
            total = 1;
            requestWrapper(type, arg);
        }
    });
};

export default agentOnline;