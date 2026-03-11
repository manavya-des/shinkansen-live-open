export const TRAIN_TYPES = [
  "Nozomi",
  "Hikari",
  "Hikari Rail Star",
  "Kodama",
  "Mizuho",
  "Sakura",
  "Tsubame",
  "Hayabusa",
  "Hayate",
  "Yamabiko",
  "Nasuno",
  "Komachi",
  "Tsubasa",
  "Toki",
  "Tanigawa",
  "Kagayaki",
  "Hakutaka",
  "Asama",
  "Tsurugi",
  "Kamome",
] as const;

export type TrainType = (typeof TRAIN_TYPES)[number];

export const TRAIN_SERVICE_GROUPS: Array<{
  id: string;
  label: string;
  services: readonly TrainType[];
}> = [
  {
    id: "tokaido-sanyo-kyushu",
    label: "Tokaido + Sanyo + Kyushu",
    services: ["Nozomi", "Hikari", "Hikari Rail Star", "Kodama", "Mizuho", "Sakura", "Tsubame"],
  },
  {
    id: "nishi-kyushu",
    label: "Nishi Kyushu",
    services: ["Kamome"],
  },
  {
    id: "tohoku-hokkaido-akita-yamagata",
    label: "Tohoku + Hokkaido + Akita + Yamagata",
    services: ["Hayabusa", "Hayate", "Yamabiko", "Nasuno", "Komachi", "Tsubasa"],
  },
  {
    id: "joetsu-gala-yuzawa",
    label: "Joetsu + Gala Yuzawa",
    services: ["Toki", "Tanigawa"],
  },
  {
    id: "hokuriku",
    label: "Hokuriku",
    services: ["Kagayaki", "Hakutaka", "Asama", "Tsurugi"],
  },
];

export const TRAIN_SERVICE_DESCRIPTORS: Record<TrainType, string> = {
  Nozomi: "express",
  Hikari: "limited-stop",
  "Hikari Rail Star": "limited-stop",
  Kodama: "local",
  Mizuho: "express",
  Sakura: "limited-stop",
  Tsubame: "local",
  Hayabusa: "express",
  Hayate: "local",
  Yamabiko: "limited-stop",
  Nasuno: "local",
  Komachi: "express",
  Tsubasa: "limited-stop",
  Toki: "limited-stop",
  Tanigawa: "local",
  Kagayaki: "express",
  Hakutaka: "limited-stop",
  Asama: "local",
  Tsurugi: "local",
  Kamome: "local",
};

/** Map each service name to its train image in /public/trains/ */
export const TRAIN_SERVICE_IMAGES: Record<TrainType, string> = {
  Nozomi: "/trains/Nozomi.png",
  Hikari: "/trains/Hikari.png",
  "Hikari Rail Star": "/trains/Hikari RailStar.png",
  Kodama: "/trains/Kodama.png",
  Mizuho: "/trains/Nozomi.png",
  Sakura: "/trains/Hikari.png",
  Tsubame: "/trains/Tsubame.png",
  Hayabusa: "/trains/E5.png",
  Hayate: "/trains/E5.png",
  Yamabiko: "/trains/E2.png",
  Nasuno: "/trains/E2.png",
  Komachi: "/trains/E6.png",
  Tsubasa: "/trains/E8.png",
  Toki: "/trains/E7.png",
  Tanigawa: "/trains/E7.png",
  Kagayaki: "/trains/E7.png",
  Hakutaka: "/trains/E7.png",
  Asama: "/trains/E7.png",
  Tsurugi: "/trains/E7.png",
  Kamome: "/trains/Kamome.png",
};

export function normalizeTrainServiceName(name: string, number: string) {
  const normalizedNumber = String(number || "").replace(/号$/u, "").trim();

  if (name === "Hikari" && normalizedNumber === "590") {
    return "Hikari Rail Star";
  }

  return name;
}
