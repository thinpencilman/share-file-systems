
import lists from "./lists.js";
import log from "./log.js";
import wrapIt from "./wrapIt.js";
import vars from "./vars.js";

// CLI commands documentation generator
const library = {
        lists: lists,
        log: log,
        wrapIt: wrapIt
    },
    commands = function node_apps_commands():void {
        const output:string[] = [];
        vars.verbose = true;
        if (vars.commands[process.argv[0]] === undefined) {
            // all commands in a list
            library.lists({
                empty_line: false,
                heading: "Commands",
                obj: vars.commands,
                property: "description",
                total: true
            });
        } else {
            // specifically mentioned option
            const comm:any = vars.commands[process.argv[0]],
                len:number = comm.example.length,
                plural:string = (len > 1)
                    ? "s"
                    : "";
            let a:number = 0;
            output.push(`${vars.text.bold + vars.text.underline + vars.version.name} - Command: ${vars.text.green + process.argv[0] + vars.text.none}`);
            output.push("");
            output.push(comm.description);
            output.push("");
            output.push(`${vars.text.underline}Example${plural + vars.text.none}`);
            do {
                wrapIt(output, comm.example[a].defined);
                output.push(`   ${vars.text.cyan + vars.version.command + comm.example[a].code + vars.text.none}`);
                output.push("");
                a = a + 1;
            } while (a < len);
            library.log(output);
        }
    };

export default commands;