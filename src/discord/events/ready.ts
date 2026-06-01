import { createEvent } from "#base";
import { ActivityType } from "discord.js";

createEvent({
  name: "ready",
  event: "ready",
  once: true,
  async run(client) {
    const statuses = [
      "💻 Desenvolvido por One Network",
      "💫 Transformando comunidades",
      "🚨 Desenvolvendo soluções profissionais",
    ];

    let i = 0;
    client.user?.setPresence({
      status: "dnd",
      activities: [{ name: statuses[0], type: ActivityType.Custom }],
    });

    setInterval(() => {
      i = (i + 1) % statuses.length;
      client.user?.setPresence({
        status: "dnd",
        activities: [{ name: statuses[i], type: ActivityType.Custom }],
      });
    }, 10000);
  },
});
