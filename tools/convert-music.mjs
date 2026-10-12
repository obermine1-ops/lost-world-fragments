// 배경 음악(ogg)마다 mp3 사본을 만든다. 아이폰 사파리는 ogg를 못 틀 수 있어서,
// 게임은 기기가 ogg를 지원하면 ogg, 아니면 mp3를 고른다. (src/scenes/AudioScene.ts)
// 실행: node tools/convert-music.mjs  — 이미 있는 mp3는 건너뛴다(--force면 다시 만듦).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OggVorbisDecoder } from '@wasm-audio-decoders/ogg-vorbis';
import { Mp3Encoder } from '@breezystack/lamejs';

const DIR = 'public/assets/audio';
const KBPS = 96;
const force = process.argv.includes('--force');

const decoder = new OggVorbisDecoder();
await decoder.ready;

for (const file of readdirSync(DIR).filter((f) => f.startsWith('music-') && f.endsWith('.ogg'))) {
  const out = join(DIR, file.replace(/\.ogg$/, '.mp3'));
  if (existsSync(out) && !force) continue;
  await decoder.reset();
  const { channelData, sampleRate } = await decoder.decodeFile(readFileSync(join(DIR, file)));
  const channels = Math.min(2, channelData.length);
  const encoder = new Mp3Encoder(channels, sampleRate, KBPS);
  const toInt16 = (f) => {
    const out = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(f[i] * 32767)));
    return out;
  };
  const left = toInt16(channelData[0]);
  const right = channels === 2 ? toInt16(channelData[1]) : undefined;
  const chunks = [];
  const BLOCK = 1152; // lamejs는 한 번에 1152샘플씩 (크게 넣으면 뒤가 무음이 됨)
  for (let i = 0; i < left.length; i += BLOCK) {
    const l = left.slice(i, i + BLOCK); // subarray를 넘기면 lamejs가 앞부분만 읽는다 — 복사본으로
    const r = right?.slice(i, i + BLOCK);
    const buf = r ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (buf.length) chunks.push(Buffer.from(buf));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(Buffer.from(tail));
  const mp3 = Buffer.concat(chunks);
  writeFileSync(out, mp3);
  console.log(`${file} → ${out} (${(left.length / sampleRate).toFixed(0)}초, ${(mp3.length / 1024).toFixed(0)}KB)`);
}
decoder.free();
