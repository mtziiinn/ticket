import constantsJson from "../constants.json" with { type: "json" };
import emojisJson from "../emojis.json" with { type: "json" };
Object.assign(globalThis, Object.freeze({
    constants: constantsJson,
    emojis: emojisJson,
}));
