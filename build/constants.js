import constantsJson from "../constants.json" with { type: "json" };
import emojisJson from "../emojis.json" with { type: "json" };
import brandJson from "../brand.config.json" with { type: "json" };
const brand = brandJson;
// A cor primária da marca sobrescreve os aliases de "azul padrão" do constants.json,
// então todos os call sites que usam constants.colors.* herdam a identidade do cliente.
const brandedColors = {
    ...constantsJson.colors,
    primary: brand.primaryColor,
    success: brand.primaryColor,
    azoxo: brand.primaryColor,
    green: brand.primaryColor,
    developer: brand.primaryColor,
    balance: brand.primaryColor,
};
const constants = { ...constantsJson, colors: brandedColors };
Object.assign(globalThis, Object.freeze({
    constants,
    emojis: emojisJson,
    brand,
}));
