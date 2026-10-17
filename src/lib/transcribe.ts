function detectAudioFormat(bytes: Buffer): { extension: string; mimeType: string } {
  if (bytes.length >= 12) {
    const head4 = bytes.subarray(0, 4).toString('ascii');
    if (head4 === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WAVE') {
      return { extension: 'wav', mimeType: 'audio/wav' };
    }
    if (head4 === 'OggS') {
      return { extension: 'ogg', mimeType: 'audio/ogg' };
    }
    if (head4 === 'fLaC') {
      return { extension: 'flac', mimeType: 'audio/flac' };
    }
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return { extension: 'webm', mimeType: 'audio/webm' };
    }
    // MPEG-4 / M4A container (ftyp at offset 4)
    if (bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
      return { extension: 'm4a', mimeType: 'audio/mp4' };
    }
    // MP3 with ID3 tag or frame sync
    if (head4.startsWith('ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
      return { extension: 'mp3', mimeType: 'audio/mpeg' };
    }
  }

  return { extension: 'm4a', mimeType: 'audio/mp4' };
}

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

  const detected = detectAudioFormat(bytes);
  const extension = detected.extension;
  const mimeType = detected.mimeType;
  const fileName = input.fileName?.replace(/\.[^.]+$/, `.${extension}`) ?? `answer.${extension}`;

  const form = new FormData();
  form.append('model', 'whisper-1');
  form.append('file', new File([bytes], fileName, { type: mimeType }));

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
    console.error(
      '[transcribe] openai',
      detail,
      `bytes=${bytes.length}`,
      `ext=${extension}`,
      `head=${bytes.subarray(0, 8).toString('hex')}`,
    );
    throw new Error(detail);
  }

  const body = (await response.json()) as { text?: string };
  return (body.text ?? '').trim();
}
