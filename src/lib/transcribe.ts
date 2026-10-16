export async function transcribeAudio(input: {
  audioBase64: string;
  mimeType: string;
  fileName?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Voice answers need OPENAI_API_KEY on the server.');
  }

  const bytes = Buffer.from(input.audioBase64, 'base64');
  if (!bytes.length) {
    throw new Error('That recording was empty.');
  }

  const mimeType = input.mimeType || 'audio/m4a';
  const extension = mimeType.includes('wav')
    ? 'wav'
    : mimeType.includes('mpeg') || mimeType.includes('mp3')
      ? 'mp3'
      : mimeType.includes('webm')
        ? 'webm'
        : 'm4a';

  const form = new FormData();
  form.append('model', 'whisper-1');
  form.append(
    'file',
    new Blob([new Uint8Array(bytes)], { type: mimeType }),
    input.fileName ?? `answer.${extension}`,
  );

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    let detail = 'Could not hear that clearly.';
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) detail = body.error.message;
    } catch {
      // keep default
    }
    throw new Error(detail);
  }

  const body = (await response.json()) as { text?: string };
  return (body.text ?? '').trim();
}
