import browser from "./browser.js";
import fs from "./fs.js";
import modal from "./modal.js";
import network from "./network.js";
import share from "./share.js";
import util from "./util.js";
import commas from "../common/commas.js";

const context:module_context = {};
let clipboard:string = "";

/* Handler for file system artifact copy */
context.copy = function local_context_copy(event:MouseEvent):void {
    let selected:[string, string][],
        addresses:string[] = [],
        box:HTMLElement,
        element:HTMLElement = context.element,
        contextElement:HTMLElement = <HTMLElement>event.srcElement || <HTMLElement>event.target,
        type:contextType = (context.type !== "")
            ? context.type
            : (contextElement.innerHTML.indexOf("Copy") === 0)
                ? "copy"
                : "cut";
    if (element.nodeName !== "li") {
        element = <HTMLElement>element.parentNode;
    }
    box = util.getAncestor(<HTMLElement>element.parentNode, "box", "class");
    selected = util.selectedAddresses(element, type);
    if (selected.length < 1) {
        addresses.push(element.getElementsByTagName("label")[0].innerHTML);
    } else {
        selected.forEach(function local_context_destroy_each(value:[string, string]):void {
            addresses.push(value[0]);
        });
    }
    if (clipboard !== "") {
        const clipData:clipboard = JSON.parse(clipboard);
        if (clipData.id !== box.getAttribute("id") || type !== "cut") {
            util.selectNone(document.getElementById(clipData.id));
        }
    }
    clipboard = JSON.stringify({
        agent: util.getAgent(box)[0],
        data: addresses,
        id: box.getAttribute("id"),
        type: type
    });
    context.element = null;
    context.type = "";
};

/* Handler for base64, edit, and hash operations from the context menu */
context.dataString = function local_context_dataString(event:MouseEvent):void {
    const element:HTMLElement = context.element,
        contextElement:HTMLElement = <HTMLElement>event.srcElement || <HTMLElement>event.target,
        type:contextType = (context.type !== "")
            ? context.type
            : (contextElement.innerHTML.indexOf("Base64") === 0)
                ? "Base64"
                : (contextElement.innerHTML.indexOf("Edit") === 0)
                    ? "Edit"
                    : "Hash",
        addresses:[string, string][] = util.selectedAddresses(element, "fileEdit"),
        box:HTMLElement = util.getAncestor(element, "box", "class"),
        length:number = addresses.length,
        agency:[string, boolean] = util.getAgent(box),
        locations:string[] = [];
    let a:number = 0,
        delay:HTMLElement,
        modalInstance:HTMLElement;
    do {
        if (addresses[a][1] === "file") {
            delay = util.delay();
            modalInstance = modal.create({
                agent: agency[0],
                content: delay,
                height: 500,
                inputs: (type === "Edit" && agency[1] === false)
                    ? ["close", "save"]
                    : ["close"],
                left: event.clientX + (a * 10),
                read_only: agency[1],
                single: false,
                title: `${type} - ${agency[0]} - ${addresses[a][0]}`,
                top: (event.clientY - 60) + (a * 10),
                type: "textPad",
                width: 500
            });
            locations.push(`${modalInstance.getAttribute("id")}:${addresses[a][0]}`);
        }
        a = a + 1;
    } while (a < length);
    network.fs({
        action: (type === "Edit")
            ? "fs-read"
            : `fs-${type.toLowerCase()}`,
        agent: agency[0],
        copyAgent: "",
        depth: 1,
        id: box.getAttribute("id"),
        location: locations,
        name: "",
        watch: "no"
    }, function local_context_dataString_callback(resultString:string):void {
        const data:stringDataList = JSON.parse(resultString),
            length:number = data.length;
        let a:number = 0,
            textArea:HTMLTextAreaElement,
            modalResult:HTMLElement,
            body:HTMLElement,
            heading:HTMLElement;
        do {
            textArea = document.createElement("textarea");
            modalResult = document.getElementById(data[a].id),
            body = <HTMLElement>modalResult.getElementsByClassName("body")[0];
            textArea.onblur = modal.textSave;
            heading = modalResult.getElementsByTagName("h2")[0].getElementsByTagName("button")[0];
            if (type === "Base64") {
                textArea.style.whiteSpace = "normal";
            }
            if (type === "Hash") {
                textArea.style.minHeight = "5em";
                body.style.height = "auto";
            }
            browser.data.modals[data[a].id].text_value = data[a].content;
            textArea.value = data[a].content;
            body.innerHTML = "";
            body.appendChild(textArea);
            body.style.overflow = "hidden";
            heading.style.width = `${(body.clientWidth - 50) / 18}em`;
            a = a + 1;
        } while (a < length);
        network.storage("settings");
    });
    context.element = null;
    context.type = "";
};

/* Handler for removing file system artifacts via context menu */
context.destroy = function local_context_destroy():void {
    let element:HTMLElement = context.element,
        selected:[string, string][],
        addresses:string[] = [],
        box:HTMLElement = util.getAncestor(element, "box", "class"); 
    if (element.nodeName.toLowerCase() !== "li") {
        element = <HTMLElement>element.parentNode;
    }
    selected = util.selectedAddresses(element, "destroy");
    if (selected.length < 1) {
        addresses.push(element.getElementsByTagName("label")[0].innerHTML);
    } else {
        selected.forEach(function local_context_destroy_each(value:[string, string]):void {
            addresses.push(value[0]);
        });
    }
    network.fs({
        action: "fs-destroy",
        agent: util.getAgent(element)[0],
        copyAgent: "",
        depth: 1,
        id: box.getAttribute("id"),
        location: addresses,
        name: "",
        watch: "no"
    }, function local_context_destroy_callback():void {
        // todo: log to systems list
    });
    context.element = null;
};

/* Handler for details action of context menu */
context.details = function local_context_details(event:MouseEvent):void {
    const element:HTMLElement = context.element,
        div:HTMLElement = util.delay(),
        agency:[string, boolean] = util.getAgent(element),
        addresses:[string, string][] = util.selectedAddresses(element, "details"),
        modalInstance:HTMLElement = modal.create({
            agent: agency[0],
            content: div,
            height: 500,
            inputs: ["close"],
            left: event.clientX,
            read_only: agency[1],
            single: true,
            title: `Details - ${agency[0]} - ${addresses.length} items`,
            top: event.clientY - 60,
            type: "details",
            width: 500
        }),
        id:string = modalInstance.getAttribute("id"),
        addressList:string[] = (function local_context_details_addressList():string[] {
            const output:string[] = [],
                length:number = addresses.length;
            let a:number = 0;
            do {
                output.push(addresses[a][0]);
                a = a + 1;
            } while (a < length);
            return output;
        }());
    network.fs({
        action: "fs-details",
        agent: agency[0],
        copyAgent: "",
        depth: 0,
        id: id,
        location: addressList,
        name: "",
        watch: "no"
    }, function local_context_details_callback(response:string):void {
        const payload:fsRemote = JSON.parse(response),
            list:directoryList = (payload.dirs === "missing" || payload.dirs === "noShare" || payload.dirs === "readOnly")
                ? []
                : payload.dirs,
            body:HTMLElement = <HTMLElement>document.getElementById(payload.id).getElementsByClassName("body")[0],
            length:number = list.length,
            details:fsDetails = {
                size: 0,
                files: 0,
                directories: 0,
                links: 0
            },
            output:HTMLElement = document.createElement("div");
        let a:number = 0,
            tr:HTMLElement,
            td:HTMLElement,
            childLength:number,
            heading:HTMLElement = document.createElement("h3"),
            table:HTMLElement = document.createElement("table"),
            tbody:HTMLElement = document.createElement("tbody"),
            mTime:Date,
            aTime:Date,
            cTime:Date;
        list.sort(function local_network_fsDetails_callback_sort(a:directoryItem, b:directoryItem):number {
            // when types are the same
            if (a[1] === b[1]) {
                if (a[0] < b[0]) {
                    return -1;
                }
                return 1;
            }

            // when types are different
            if (a[1] === "directory") {
                return -1;
            }
            if (a[1] === "link" && b[1] === "file") {
                return -1;
            }
            return 1;
        });
        do {
            if (list[a][1] === "directory") {
                details.directories = details.directories + 1;
            } else if (list[a][1] === "link") {
                details.links = details.links + 1;
            } else {
                details.files = details.files + 1;
                details.size = details.size + list[a][5].size;
            }
            a = a + 1;
        } while (a < childLength);

        output.setAttribute("class", "fileDetailOutput");
        heading.innerHTML = `File System Details - ${list.length} items`;
        output.appendChild(heading);
        a = 0;
        childLength = addresses.length;
        do {
            tr = document.createElement("tr");
            td = document.createElement("th");
            td.innerHTML = list[a][1];
            td.setAttribute("class", list[a][1]);
            tr.appendChild(td);
            td = document.createElement("td");
            td.innerHTML = list[a][0];
            tr.appendChild(td);
            tbody.appendChild(tr);
            a = a + 1;
        } while (a < length);
        tr = document.createElement("tr");
        td = document.createElement("th");
        td.innerHTML = "Total Size";
        tr.appendChild(td);
        td = document.createElement("td");
        if (details.size > 1024) {
            td.innerHTML = `${commas(details.size)} bytes (${util.prettyBytes(details.size)})`;
        } else {
            td.innerHTML = `${commas(details.size)} bytes`;
        }
        tr.appendChild(td);
        tbody.appendChild(tr);
        table.appendChild(tbody);
        output.appendChild(table);

        heading = document.createElement("h3");
        heading.innerHTML = "Contains";
        output.appendChild(heading);
        td = document.createElement("p");
        td.innerHTML = "Does not count read protected assets.";
        output.appendChild(td);
        table = document.createElement("table");
        tbody = document.createElement("tbody");
        tr = document.createElement("tr");
        td = document.createElement("th");
        td.innerHTML = "Files";
        tr.appendChild(td);
        td = document.createElement("td");
        td.innerHTML = commas(details.files);
        tr.appendChild(td);
        tbody.appendChild(tr);
        tr = document.createElement("tr");
        td = document.createElement("th");
        td.innerHTML = "Directories";
        tr.appendChild(td);
        td = document.createElement("td");
        td.innerHTML = commas(details.directories);
        tr.appendChild(td);
        tbody.appendChild(tr);
        tr = document.createElement("tr");
        td = document.createElement("th");
        td.innerHTML = "Symbolic Links";
        tr.appendChild(td);
        td = document.createElement("td");
        td.innerHTML = commas(details.links);
        tr.appendChild(td);
        tbody.appendChild(tr);
        table.appendChild(tbody);
        output.appendChild(table);
        
        if (list.length === 1) {
            mTime = new Date(list[0][5].mtimeMs);
            aTime = new Date(list[0][5].atimeMs);
            cTime = new Date(list[0][5].ctimeMs);
            heading = document.createElement("h3");
            heading.innerHTML = "Modified, Accessed, Created";
            output.appendChild(heading);
            table = document.createElement("table");
            tbody = document.createElement("tbody");
            tr = document.createElement("tr");
            td = document.createElement("th");
            td.innerHTML = "Modified";
            tr.appendChild(td);
            td = document.createElement("td");
            td.innerHTML = util.dateFormat(mTime);
            tr.appendChild(td);
            tbody.appendChild(tr);
            tr = document.createElement("tr");
            td = document.createElement("th");
            td.innerHTML = "Accessed";
            tr.appendChild(td);
            td = document.createElement("td");
            td.innerHTML = util.dateFormat(aTime);
            tr.appendChild(td);
            tbody.appendChild(tr);
            tr = document.createElement("tr");
            td = document.createElement("th");
            td.innerHTML = "Created";
            tr.appendChild(td);
            td = document.createElement("td");
            td.innerHTML = util.dateFormat(cTime);
            tr.appendChild(td);
            tbody.appendChild(tr);
            table.appendChild(tbody);
            output.appendChild(table);
        }
        body.innerHTML = "";
        body.appendChild(output);
    });
    util.selectNone(element);
    context.element = null;
};

context.element = null;

/* Handler for creating new directories */
context.fsNew = function local_context_fsNew(event:MouseEvent):void {
    let item:HTMLElement,
        box:HTMLElement,
        path:string,
        slash:"\\" | "/",
        element:HTMLElement = context.element;
    const contextElement:HTMLElement = <HTMLElement>event.srcElement || <HTMLElement>event.target,
        type:contextType = (context.type !== "")
            ? context.type
            : (contextElement.innerHTML.indexOf("New File") === 0)
                ? "file"
                : "directory",
        field:HTMLInputElement = document.createElement("input"),
        text:HTMLElement = document.createElement("label"),
        actionKeyboard = function local_context_fsNew_actionKeyboard(actionEvent:KeyboardEvent):void {
            // 13 is enter
            if (actionEvent.keyCode === 13) {
                const value:string = field.value.replace(/(\s+|\.)$/, "");
                if (value.replace(/\s+/, "") !== "") {
                    field.value = value;
                    text.innerHTML = path + value;
                    network.fs({
                        action: "fs-new",
                        agent: util.getAgent(element)[0],
                        copyAgent: "",
                        depth: 1,
                        id: box.getAttribute("id"),
                        location: [path + value],
                        name: type,
                        watch: "no"
                    }, function local_context_fsNew_actionKeyboard_callback():void {
                        // todo: log in systems log
                    });
                }
            } else {
                // 27 is escape
                if (actionEvent.keyCode === 27) {
                    const input:HTMLElement = <HTMLElement>element.getElementsByTagName("input")[0];
                    element.removeChild(item);
                    input.focus();
                    return;
                }
                field.value = field.value.replace(/\?|<|>|"|\||\*|:|\\|\/|\u0000/g, "");
            }
        },
        actionBlur = function local_context_fsNew_actionBlur(actionEvent:FocusEvent):void {
            if (actionEvent.type === "blur" && field.value.replace(/\s+/, "") !== "") {
                const value:string = field.value.replace(/(\s+|\.)$/, "");
                if (value.replace(/\s+/, "") !== "") {
                    field.value = value;
                    text.innerHTML = path + value;
                    network.fs({
                        action: "fs-new",
                        agent: util.getAgent(element)[0],
                        copyAgent: "",
                        depth: 1,
                        id: box.getAttribute("id"),
                        location: [path + value],
                        name: type,
                        watch: "no"
                    }, function local_context_fsNew_actionBlur_callback():void {
                        // todo: log in systems log
                    });
                }
            }
        },
        build = function local_context_fsNew_build():HTMLElement {
            const li:HTMLElement = document.createElement("li"),
                label:HTMLLabelElement = document.createElement("label"),
                input:HTMLInputElement = document.createElement("input");
            let span:HTMLElement;
            li.setAttribute("class", type);
            if (type === "directory") {
                li.ondblclick = fs.directory;
            }
            input.type = "checkbox";
            input.checked = false;
            label.innerHTML = "Selected";
            label.appendChild(input);
            label.setAttribute("class", "selection");
            text.oncontextmenu = context.menu;
            text.onclick = fs.select;
            text.innerHTML = path;
            field.onkeyup = actionKeyboard;
            field.onblur = actionBlur;
            field.setAttribute("id", "newFileItem");
            text.appendChild(field);
            li.appendChild(text);
            span = document.createElement("span");
            span.onclick = fs.select;
            span.oncontextmenu = context.menu;
            li.appendChild(span);
            li.oncontextmenu = context.menu;
            li.appendChild(label);
            li.onclick = fs.select;
            return li;
        };
    if (document.getElementById("newFileItem") !== null) {
        return;
    }
    element = util.getAncestor(element, "fileList", "class");
    box = util.getAncestor(<HTMLElement>element.parentNode, "box", "class");
    path = box.getElementsByTagName("input")[0].value;
    if (path.indexOf("/") < 0 || (path.indexOf("\\") < path.indexOf("/") && path.indexOf("\\") > -1 && path.indexOf("/") > -1)) {
        slash = "\\";
    }
    if (path.charAt(path.length - 1) !== slash) {
        path = path + slash;
    }
    item = build();
    element.appendChild(item);
    field.focus();
    context.element = null;
    context.type = "";
};

/* Creates context menu */
context.menu = function local_context_menu(event:MouseEvent):void {
    const itemList:HTMLElement[] = [],
        menu:HTMLElement = document.createElement("ul"),
        command:string = (navigator.userAgent.indexOf("Mac OS X") > 0)
            ? "Command"
            : "CTRL";
    let element:HTMLElement = <HTMLElement>event.srcElement || <HTMLElement>event.target,
        nodeName:string = element.nodeName.toLowerCase(),
        parent:HTMLElement = <HTMLElement>element.parentNode,
        item:HTMLElement,
        button:HTMLButtonElement,
        box:HTMLElement = util.getAncestor(element, "box", "class"),
        readOnly:boolean = browser.data.modals[box.getAttribute("id")].read_only,
        functions:contextFunctions = {
            base64: function local_context_menu_base64():void {
                item = document.createElement("li");
                button = document.createElement("button");
                button.innerHTML = `Base64 <em>${command} + ALT + B</em>`;
                button.onclick = context.dataString;
                item.appendChild(button);
                itemList.push(item);
            },
            copy: function local_context_menu_copy():void {
                item = document.createElement("li");
                button = document.createElement("button");
                button.innerHTML = `Copy <em>${command} + C</em>`;
                button.onclick = context.copy;
                item.appendChild(button);
                itemList.push(item);
            },
            cut: function local_context_menu_cut():void {
                item = document.createElement("li");
                button = document.createElement("button");
                button.innerHTML = `Cut <em>${command} + X</em>`;
                button.onclick = context.copy;
                item.appendChild(button);
                itemList.push(item);
            },
            destroy: function local_context_menu_destroy():void {
                let input:HTMLInputElement = <HTMLInputElement>util.getAncestor(parent, "border", "class");
                input = input.getElementsByTagName("input")[0];
                item = document.createElement("li");
                button = document.createElement("button");
                button.innerHTML = `Destroy <em>DEL</em>`;
                button.setAttribute("class", "destroy");
                if (input.value === "/" || input.value === "\\") {
                    button.disabled = true;
                } else {
                    button.onclick = context.destroy;
                }
                item.appendChild(button);
                itemList.push(item);
            },
            details: function local_context_menu_details():void {
                item = document.createElement("li");
                button = document.createElement("button");
                button.innerHTML = `Details <em>${command} + ALT + T</em>`;
                button.onclick = context.details;
                item.appendChild(button);
                itemList.push(item);
            },
            edit: function local_context_menu_edit():void {
                item = document.createElement("li");
                button = document.createElement("button");
                if (readOnly === true) {
                    button.innerHTML = `Read File as Text <em>${command} + ALT + E</em>`;
                } else {
                    button.innerHTML = `Edit File as Text <em>${command} + ALT + E</em>`;
                }
                button.onclick = context.dataString;
                item.appendChild(button);
                itemList.push(item);
            },
            hash: function local_context_menu_hash():void {
                item = document.createElement("li");
                button = document.createElement("button");
                button.innerHTML = `Hash <em>${command} + ALT + H</em>`;
                button.onclick = context.dataString;
                item.appendChild(button);
                itemList.push(item);
            },
            newDirectory: function local_context_menu_newDirectory():void {
                item = document.createElement("li");
                button = document.createElement("button");
                button.innerHTML = `New Directory <em>${command} + ALT + D</em>`;
                button.onclick = context.fsNew;
                item.appendChild(button);
                itemList.push(item);
            },
            newFile: function local_context_menu_newFile():void {
                item = document.createElement("li");
                button = document.createElement("button");
                button.innerHTML = `New File <em>${command} + ALT + F</em>`;
                button.onclick = context.fsNew;
                item.appendChild(button);
                itemList.push(item);
            },
            paste: function local_context_menu_paste():void {
                item = document.createElement("li");
                button = document.createElement("button");
                button.innerHTML = `Paste <em>${command} + V</em>`;
                button.onclick = context.paste;
                if (clipboard === "" || (
                    (element.getAttribute("class") === "fileList" || parent.getAttribute("class") === "fileList") &&
                    (clipboard.indexOf("\"type\":") < 0 || clipboard.indexOf("\"data\":") < 0)
                )) {
                    button.disabled = true;
                }
                item.appendChild(button);
                itemList.push(item);
            },
            rename: function local_context_menu_rename():void {
                let input:HTMLInputElement = <HTMLInputElement>util.getAncestor(parent, "border", "class");
                input = input.getElementsByTagName("input")[0];
                item = document.createElement("li");
                button = document.createElement("button");
                button.innerHTML = `Rename <em>${command} + ALT + R</em>`;
                if (input.value === "/" || input.value === "\\") {
                    button.disabled = true;
                } else {
                    button.onclick = fs.rename;
                }
                item.appendChild(button);
                itemList.push(item);
            },
            share: function local_context_menu_share():void {
                item = document.createElement("li");
                button = document.createElement("button");
                button.innerHTML = `Share <em>${command} + ALT + S</em>`;
                button.onclick = share.context;
                item.appendChild(button);
                itemList.push(item);
            }
        },
        reverse:boolean = false,
        a:number = 0;
    event.stopPropagation();
    if (nodeName === "input") {
        return;
    }
    if (nodeName === "span" || nodeName === "label" || element.getAttribute("class") === "expansion") {
        element = <HTMLElement>element.parentNode;
        parent = <HTMLElement>parent.parentNode;
        nodeName = element.nodeName.toLowerCase();
    }
    context.element = element;
    context.menuRemove();
    event.preventDefault();
    event.stopPropagation();
    menu.setAttribute("id", "contextMenu");
    if (element.getAttribute("class") === "fileList") {
        if (readOnly === true) {
            return;
        }
        functions.newDirectory();
        functions.newFile();
        functions.paste();
    } else if (parent.getAttribute("class") === "fileList") {
        functions.details();
        if (box.getAttribute("data-agent") === "localhost") {
            functions.share();
        }
        if (element.getAttribute("class").indexOf("file") === 0) {
            functions.edit();
            functions.hash();
            functions.base64();
        }

        if (readOnly === false) {
            functions.newDirectory();
            functions.newFile();
        }
        functions.copy();
        if (readOnly === false) {
            functions.cut();
            functions.paste();
            functions.rename();
            functions.destroy();
        }
    }

    // menu display position
    menu.style.zIndex = `${browser.data.zIndex + 10}`;
    // vertical
    if (browser.content.clientHeight < ((itemList.length * 45) + 1) + event.clientY) {
        reverse = true;
        menu.style.top = `${(event.clientY - ((itemList.length * 57) + 1)) / 10}em`;
    } else {
        menu.style.top = `${(event.clientY - 50) / 10}em`;
    }
    // horizontal
    if (browser.content.clientWidth < (200 + event.clientX)) {
        reverse = true;
        menu.style.left = `${(event.clientX - 200) / 10}em`;
    } else {
        menu.style.left = `${event.clientX / 10}em`;
    }

    // button order
    if (reverse === true) {
        a = itemList.length;
        do {
            a = a - 1;
            menu.appendChild(itemList[a]);
        } while (a > 0);
    } else {
        do {
            menu.appendChild(itemList[a]);
            a = a + 1;
        } while (a < itemList.length);
    }
    browser.content.appendChild(menu);
};

/* Destroys a context menu */
context.menuRemove = function local_context_menuRemove():void {
    if (document.getElementById("contextMenu") !== null) {
        browser.content.removeChild(document.getElementById("contextMenu"));
    }
};

/* Prepare the network action to write files */
context.paste = function local_context_paste():void {
    let element:HTMLElement = util.getAncestor(context.element, "box", "class"),
        destination:string,
        clipData:clipboard = JSON.parse(clipboard);
    destination = element.getElementsByTagName("input")[0].value;
    network.fs({
        action   : `fs-${clipData.type}`,
        agent    : clipData.agent,
        copyAgent: util.getAgent(element)[0],
        depth    : 1,
        id       : element.getAttribute("id"),
        location : clipData.data,
        name     : destination,
        watch    : "no"
    }, function local_context_paste_callback():void {
        clipboard = "";
        util.selectNone(document.getElementById(clipData.id));
    });
    context.element = null;
};

context.type = "";

export default context;