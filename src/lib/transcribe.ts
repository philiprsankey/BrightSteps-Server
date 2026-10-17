import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static') as string | null;

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
    if (bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
      return { extension: 'm4a', mimeType: 'audio/mp4' };
    }
    if (head4.startsWith('ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
      return { extension: 'mp3', mimeType: 'audio/mpeg' };
    }
  }

  return { extension: 'm4a', mimeType: 'audio/mp4' };
}

/** Android AAC/M4A often fails Whisper's parser; remux to 16kHz mono WAV. */
async function convertToWav(bytes: Buffer, sourceExtension: string): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error('Voice conversion is unavailable on this server.');
  }

  const id = randomBytes(8).toString('hex');
  const inPath = join(tmpdir(), `bs-${id}.${sourceExtension}`);
  const outPath = join(tmpdir(), `bs-${id}.wav`);
  await writeFile(inPath, bytes);

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        ffmpegPath,
        ['-hide_banner', '-loglevel', 'error', '-y', '-i', inPath, '-ar', '16000', '-ac', '1', outPath],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
      let stderr = '';
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `ffmpeg failed (${code})`));
      });
    });
    return await readFile(outPath);
  } finally {
    await Promise.all([unlink(inPath).catch(() => undefined), unlink(outPath).catch(() => undefined)]);
  }
}

async function whisperTranscribe(
  apiKey: string,
  bytes: Buffer,
  fileName: string,
  mimeType: string,
  choices?: string[],
) {
  const form = new FormData();
  form.append('model', 'whisper-1');
  form.append('language', 'en');
  if (choices?.length) {
    form.append(
      'prompt',
      `Child quiz answer. Possible answers: ${choices.join(', ')}. Reply with one short answer.`,
    );
  }
  form.append('file', new File([new Uint8Array(bytes)], fileName, { type: mimeType }));

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
    const error = new Error(detail);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  const body = (await response.json()) as { text?: string };
  return (body.text ?? '').trim();
}

export async function transcribeAudio(input: {
  audioBase64: string;
  mimeType: string;
  fileName?: string;
  choices?: string[];
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Voice answers need OPENAI_API_KEY on the server.');
  }

  const bytes = Buffer.from(input.audioBase64, 'base64');
  if (bytes.length < 200) {
    throw new Error('That recording was empty.');
  }

  const detected = detectAudioFormat(bytes);
  console.log(
    '[transcribe] received',
    `bytes=${bytes.length}`,
    `ext=${detected.extension}`,
    `head=${bytes.subarray(0, 8).toString('hex')}`,
  );

  // Android M4A/MP4 regularly trips Whisper — convert first for those containers.
  let upload: Buffer = bytes;
  let fileName = `answer.${detected.extension}`;
  let mimeType = detected.mimeType;

  if (detected.extension === 'm4a' || detected.extension === 'mp4') {
    try {
      upload = Buffer.from(await convertToWav(bytes, detected.extension));
      fileName = 'answer.wav';
      mimeType = 'audio/wav';
      console.log('[transcribe] converted to wav', `bytes=${upload.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[transcribe] ffmpeg', message);
      // fall through and try the original bytes
    }
  }

  try {
    return await whisperTranscribe(apiKey, upload, fileName, mimeType, input.choices);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isFormat =
      /invalid file format/i.test(message) &&
      fileName !== 'answer.wav' &&
      detected.extension !== 'wav';

    if (isFormat) {
      console.error('[transcribe] retry via wav after', message);
      const wav = await convertToWav(bytes, detected.extension);
      return await whisperTranscribe(apiKey, wav, 'answer.wav', 'audio/wav', input.choices);
    }

    console.error(
      '[transcribe] openai',
      message,
      `bytes=${upload.length}`,
      `file=${fileName}`,
      `head=${upload.subarray(0, 8).toString('hex')}`,
    );
    throw error instanceof Error ? error : new Error(message);
  }
}
