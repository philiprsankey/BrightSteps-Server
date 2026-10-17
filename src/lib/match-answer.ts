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

/** Whisper often invents these on silence / room noise. */
const JUNK_PHRASES = [
  'thank you',
  'thanks',
  'bye',
  'bye bye',
  'goodbye',
  'good bye',
  'take care',
  'see you',
  'you re welcome',
  'youre welcome',
  'please subscribe',
  'like and subscribe',
  'thanks for watching',
  'thank you for watching',
  'bye for now',
  'that s it',
  'thats it',
  'off',
  'type',
  'fika',
];

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

function isJunkTranscript(spoken: string) {
  if (!spoken) return true;
  if (JUNK_PHRASES.includes(spoken)) return true;
  // Repeated filler like "bye bye bye"
  const tokens = spoken.split(' ').filter(Boolean);
  if (tokens.length >= 2 && tokens.every((token) => token === 'bye' || token === 'thank' || token === 'you')) {
    return true;
  }
  return false;
}

/**
 * Map a spoken transcript onto one of the multiple-choice answers, if clear enough.
 * Short choices (letters/digits) only match as whole tokens — avoids "Thank you" → "T".
 */
export function matchSpokenAnswer(transcript: string, choices: string[]): string | null {
  const spoken = expandWords(normalize(transcript));
  if (!spoken || isJunkTranscript(spoken)) return null;

  const normalizedChoices = choices.map((choice) => ({
    raw: choice,
    norm: expandWords(normalize(choice)),
  }));

  const exact = normalizedChoices.find((choice) => choice.norm && choice.norm === spoken);
  if (exact) return exact.raw;

  const tokens = spoken.split(' ').filter(Boolean);

  // Prefer an unambiguous whole-token hit (handles "8, 9" → first clear choice).
  const tokenExactHits = normalizedChoices.filter(
    (choice) => choice.norm && tokens.some((token) => token === choice.norm),
  );
  if (tokenExactHits.length === 1) return tokenExactHits[0].raw;
  if (tokenExactHits.length > 1) {
    // If several choices appear, take the first spoken token that is a choice.
    for (const token of tokens) {
      const hit = tokenExactHits.find((choice) => choice.norm === token);
      if (hit) return hit.raw;
    }
  }

  // Longer phrases only: allow contains, but never for 1-character choices.
  const contained = normalizedChoices.filter((choice) => {
    if (!choice.norm || choice.norm.length <= 1) return false;
    return spoken.includes(choice.norm) || (spoken.length >= 2 && choice.norm.includes(spoken));
  });
  if (contained.length === 1) return contained[0].raw;

  return null;
}
