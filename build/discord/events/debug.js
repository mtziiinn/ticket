import { createEvent } from "#base";
createEvent({
    name: "Debug Modal",
    event: "interactionCreate",
    async run(interaction) {
        if (!interaction || typeof interaction.isModalSubmit !== "function")
            return;
        if (!interaction.isModalSubmit())
            return;
        console.log("------------------------------------------");
        console.log("DEBUG: MODAL SUBMIT DETECTADO");
        console.log("CustomID:", interaction.customId);
        console.log("Is from message:", interaction.isFromMessage());
        console.log("------------------------------------------");
    },
});
