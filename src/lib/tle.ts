export interface TleRecord {
  name: string;
  norad: number;
  line1: string;
  line2: string;
}

/** Parses CelesTrak's three-line TLE format (name, line 1, line 2). */
export function parseTle(text: string): TleRecord[] {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  const records: TleRecord[] = [];
  for (let i = 1; i < lines.length - 1; i++) {
    if (lines[i].startsWith('1 ') && lines[i + 1].startsWith('2 ')) {
      records.push({
        name: lines[i - 1].trim(),
        norad: Number(lines[i].slice(2, 7)),
        line1: lines[i],
        line2: lines[i + 1],
      });
      i++;
    }
  }
  return records;
}
