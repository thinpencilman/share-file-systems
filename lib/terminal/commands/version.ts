
/* lib/terminal/commands/version - A command utility for expressing the application's version. */
import log from "../utilities/log.js";
import vars from "../utilities/vars.js";

// runs apps.log
const version = function terminal_commands_version():void {
    vars.testLogger("version", "", "sets verbose and complete flags on the log utility");
    log.title("Version");
    log([""], true);
};

export default version;