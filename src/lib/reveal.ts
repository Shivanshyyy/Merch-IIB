// Helpers for the slide-up headline reveal.

// The words of a headline, punctuation attached ("campus." stays one word).
export const splitWords = (text: string): string[] => text.split(/\s+/).filter(Boolean);

// Which visual line each word landed on, from the words' offsetTop values (words on one line share a number).
export function lineIndexes(tops: number[], tolerance = 2): number[] {
  const out: number[] = [];
  let line = -1;
  let last = -Infinity;
  for (const t of tops) {
    if (t - last > tolerance) {
      line += 1;
      last = t;
    }
    out.push(line);
  }
  return out;
}

// Seconds before a word starts: lines cascade, words within a line follow quickly.
export const revealDelay = (line: number, indexInLine: number) => line * 0.12 + indexInLine * 0.04;
