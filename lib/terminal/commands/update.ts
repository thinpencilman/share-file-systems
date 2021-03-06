
/* lib/terminal/commands/update - A command to update the application from git and then run the build. */
import humanTime from "../utilities/humanTime.js";
import log from "../utilities/log.js";
import vars from "../utilities/vars.js";

// run the test suite using the build application
const update = function terminal_commands_update():void {
    const childError = function terminal_commands_update_childError(err:nodeError, task:string):boolean {
            if (err !== null) {
                const error:string = err.toString(),
                    output:string[] = [
                        error,
                        "",
                        (task === "build")
                            ? `${vars.text.angry}Build failed.${vars.text.none}`
                            : `${vars.text.angry}git failed.${vars.text.none}`
                    ];
                if (error.indexOf("Please make sure you have the correct access rights") > -1) {
                    output.push("Try checking your internet connection.");
                }
                log(output, true);
                return true;
            }
            return false;
        },
        branch = function terminal_commands_update_branch(err:nodeError, stderr:string):void {
            if (childError(err, "branch") === false) {
                let branch:string;
                if (process.argv[0] === undefined) {
                    branch = stderr.slice(stderr.indexOf("* ") + 2);
                    branch = branch.slice(0, branch.indexOf("\n"));
                    log([`${humanTime(false)}Determining current git branch as ${vars.text.green + branch + vars.text.none}.`]);
                } else {
                    log([`${humanTime(false)}Specified git branch is ${vars.text.green + process.argv[0] + vars.text.none}.`]);
                    branch = process.argv[0];
                }
                vars.node.child(`git pull origin ${branch}`, {
                    cwd: vars.projectPath
                }, git);
            }
        },
        build = function terminal_commands_update_build(err:nodeError):void {
            vars.verbose = true;
            if (childError(err, "build") === false) {
                log([
                    `${humanTime(false)}Build complete.\u0007`
                ], true);
            }
        },
        git = function terminal_commands_update_git(err:nodeError, stderr:string):void {
            if (childError(err, "git") === false) {
                const status:string = (stderr.indexOf("Already up to date.") > -1)
                        ? `${humanTime(false)}Code already up to date.`
                        : ((/Fast-forward\s/).test(stderr) === true && stderr.indexOf("Updating ") > -1)
                            ? `${humanTime(false)}Code ${vars.text.green + vars.text.bold}updated${vars.text.none} from git.`
                            : "unknown";
                if (status === "unknown") {
                    log([
                        "git pull resulted in a status other than successfully pulled or already up to date.",
                        `${vars.text.angry}Terminating without build.${vars.text.none}`
                    ], true);
                } else {
                    log([
                        status,
                        `${humanTime(false)}Rebuilding code...`
                    ]);
                    vars.verbose = false;
                    vars.node.child(`node ${vars.js}application build`, {
                        cwd: vars.projectPath
                    }, build);
                }
            }
        };
    log.title("Update the application");
    vars.verbose = true;
    vars.node.child("git branch", {
        cwd: vars.projectPath
    }, branch);
};

export default update;