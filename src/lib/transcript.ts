export type Turn = { speaker: "interviewer" | "candidate"; text: string };

/** Splits pasted text on blank lines into alternating interviewer/candidate turns. */
export function splitTranscript(text: string, first: Turn["speaker"] = "interviewer"): Turn[] {
  const other = first === "interviewer" ? "candidate" : "interviewer";
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((t) => t.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((t, i) => ({ speaker: i % 2 === 0 ? first : other, text: t }));
}
