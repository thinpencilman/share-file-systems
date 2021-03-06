
/* lib/terminal/server/httpClient - A library for handling all child HTTP requests. */
import {ClientRequest, IncomingMessage, OutgoingHttpHeaders, RequestOptions} from "http";

import forbiddenUser from "./forbiddenUser.js";
import serverVars from "./serverVars.js";
import error from "../utilities/error.js";
import vars from "../utilities/vars.js";

const httpClient:httpClient = function terminal_server_httpClient(config:httpConfiguration):void {
    const invite:string = (config.payload.indexOf("{\"invite\":{\"action\":\"invite-request\"") === 0)
            ? "invite-request"
            : (config.payload.indexOf("{\"invite\":{\"action\":\"invite-complete\"") === 0)
                ? "invite-complete"
                : (serverVars.testBrowser !== null)
                    ? "test-browser"
                    : "",
        headers:OutgoingHttpHeaders = {
            "content-type": "application/x-www-form-urlencoded",
            "content-length": Buffer.byteLength(config.payload),
            "agent-hash": serverVars.hashUser,
            "agent-name": serverVars.nameUser,
            "agent-type": config.agentType,
            "remote-user": config.remoteName,
            "request-type": config.requestType,
            "invite": invite
        },
        payload:RequestOptions = {
            headers: headers,
            host: config.ip,
            method: "POST",
            path: "/",
            port: config.port,
            timeout: 1000
        },
        scheme:string = (serverVars.secure === true)
            ? "https"
            : "http",
        fsRequest:ClientRequest = vars.node[scheme].request(payload, function terminal_server_httpClient_streamRequest(message:IncomingMessage):void {
            config.responseStream(message, config);
        });
    vars.testLogger("httpClient", "", "An abstraction over node.https.request in support of this application's data requirements.");
    if (fsRequest.writableEnded === true) {
        error([
            "Attempt to write to HTTP request after end:",
            config.payload.toString()
        ]);
    } else {
        fsRequest.on("error", config.requestError);
        fsRequest.write(config.payload);
        fsRequest.end();
    }
};

// a generic stream handler for the response
// * custom stream handlers are only necessary for stream processing operations
httpClient.stream = function terminal_server_httpClient_callback(fsResponse:IncomingMessage, config:httpConfiguration):void {
    const chunks:Buffer[] = [];
    fsResponse.setEncoding("utf8");
    fsResponse.on("data", function terminal_server_httpClient_data(chunk:Buffer):void {
        chunks.push(chunk);
    });
    fsResponse.on("end", function terminal_server_httpClient_end():void {
        const body:Buffer|string = (Buffer.isBuffer(chunks[0]) === true)
            ? Buffer.concat(chunks)
            : chunks.join("");
        if (chunks.length > 0 && chunks[0].toString().indexOf("ForbiddenAccess:") === 0) {
            forbiddenUser(body.toString().replace("ForbiddenAccess:", ""), "user");
        } else {
            config.callback(body, fsResponse.headers);
        }
    });
    fsResponse.on("error", config.responseError);
};

export default httpClient;