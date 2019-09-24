import { fs } from "./fs.js";
import { network } from "./network.js";
import { systems } from "./systems.js";
import { util } from "./util.js";

const browser:browser = {
    characterKey: "",
    content: document.getElementById("content-area"),
    data: {
        modals: {},
        modalTypes: [],
        name: "",
        shares: {
            localhost: []
        },
        zIndex: 0
    },
    loadTest: true,
    localNetwork: (function local_network():localNetwork {
        let str:string = document.getElementsByTagName("body")[0].innerHTML,
            pattern:string = "<!--network:";
        str = str.slice(str.indexOf(pattern) + pattern.length);
        str = str.slice(0, str.indexOf("-->"));
        return JSON.parse(str);
    }()),
    messages: {
        status: [],
        users: [],
        errors: []
    },
    pageBody: document.getElementsByTagName("body")[0]
};

export { browser };