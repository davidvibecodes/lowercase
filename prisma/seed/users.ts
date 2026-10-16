export type UserSeed = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  isLeagueBot?: boolean;
  /** XP earned per day, keyed by days-ago (0 = seed day). */
  activity: Record<number, number>;
};

export const OWNER_USERNAME = "davidsathyandevice";

export const ownerSeed: UserSeed = {
  username: OWNER_USERNAME,
  firstName: "David",
  lastName: "Sathyan",
  email: "davidsathyandevice@gmail.com",
  activity: { 0: 80, 1: 70, 2: 70 },
};

export const friendSeeds: UserSeed[] = [
  { username: "roy", firstName: "Roy", lastName: "C", email: "roy.c@lowercase.test", activity: { 0: 60, 1: 45 } },
  { username: "mihaela", firstName: "Mihaela", lastName: "D", email: "mihaela.d@lowercase.test", activity: { 0: 120, 2: 90, 3: 60 } },
  { username: "ankit", firstName: "Ankit", lastName: "S", email: "ankit.s@lowercase.test", activity: { 0: 35 } },
];

export const STUDY_GROUP_NAME = "Case Club Squad";

const botNames: Array<[string, string, number]> = [
  ["Aarav", "M", 480], ["Sofia", "R", 455], ["Kenji", "T", 430], ["Priya", "N", 410], ["Lucas", "B", 395],
  ["Zara", "K", 380], ["Omar", "H", 360], ["Meera", "J", 345], ["Ethan", "W", 330], ["Ishita", "G", 310],
  ["Noah", "P", 295], ["Ananya", "V", 280], ["Diego", "D", 235], ["Ayelet", "A", 190], ["Rohan", "L", 165],
  ["Chloe", "F", 140], ["Vikram", "S", 115], ["Hana", "Y", 90], ["Leo", "Q", 60], ["Tara", "E", 30],
];

/** League members that fill the Lithium League table. Their XP lands on the seed day so it counts this week. */
export const leagueBotSeeds: UserSeed[] = botNames.map(([first, last, xp]) => ({
  username: `${first.toLowerCase()}.${last.toLowerCase()}`,
  firstName: first,
  lastName: last,
  email: `${first.toLowerCase()}.${last.toLowerCase()}@league.lowercase.test`,
  isLeagueBot: true,
  activity: { 0: xp },
}));
