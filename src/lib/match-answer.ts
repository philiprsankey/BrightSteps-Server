const WORD_NUMBERS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandWords(value: string) {
  return value
    .split(' ')
    .map((part) => WORD_NUMBERS[part] ?? part)
    .join(' ');
}

/** Map a spoken transcript onto one of the multiple-choice answers, if clear enough. */
export function matchSpokenAnswer(transcript: string, choices: string[]): string | null {
  const spoken = expandWords(normalize(transcript));
  if (!spoken) return null;

  const normalizedChoices = choices.map((choice) => ({
    raw: choice,
    norm: expandWords(normalize(choice)),
  }));

  const exact = normalizedChoices.find((choice) => choice.norm && choice.norm === spoken);
  if (exact) return exact.raw;

  const contained = normalizedChoices.filter(
    (choice) => choice.norm && (spoken.includes(choice.norm) || choice.norm.includes(spoken)),
  );
  if (contained.length === 1) return contained[0].raw;

  const tokens = spoken.split(' ').filter(Boolean);
  const tokenHits = normalizedChoices.filter((choice) =>
    tokens.some((token) => token === choice.norm || (choice.norm.length > 1 && token.includes(choice.norm))),
  );
  if (tokenHits.length === 1) return tokenHits[0].raw;

  return null;
}
