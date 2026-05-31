import { createResponder } from "#base";
import { ResponderType } from "@constatic/base";
import { createLabel, createModal, createTextInput } from "@magicyan/discord";
import { StringSelectMenuBuilder, TextInputStyle } from "discord.js";
createResponder({
    customId: "ticket/form/open",
    types: [ResponderType.Button],
    cache: "cached",
    async run(interaction) {
        try {
            const modal = createModal({
                customId: "ticket/form/submit",
                title: "Abertura de Ticket",
                components: [
                    createLabel({
                        label: "Selecione a categoria",
                        description: "Escolha o assunto que melhor descreve seu problema",
                        component: new StringSelectMenuBuilder({
                            customId: "category",
                            placeholder: "Selecione uma categoria...",
                            options: [
                                {
                                    label: "Suporte Geral",
                                    value: "suporte",
                                    emoji: "1502789959378145300",
                                },
                                {
                                    label: "Denúncia",
                                    value: "denuncia",
                                    emoji: "1502789938532450304",
                                },
                                {
                                    label: "Financeiro",
                                    value: "financeiro",
                                    emoji: "1502789953334280345",
                                },
                                { label: "Bugs", value: "bugs", emoji: "1502789951400444126" },
                            ],
                        }),
                    }),
                    createLabel({
                        label: "Descrição do Problema",
                        component: createTextInput({
                            customId: "description",
                            placeholder: "Descreva detalhadamente o motivo do seu contato...",
                            style: TextInputStyle.Paragraph,
                            required: true,
                        }),
                    }),
                ],
            });
            await interaction.showModal(modal);
        }
        catch (error) {
            console.error("Erro ao mostrar modal de ticket:", error);
        }
    },
});
