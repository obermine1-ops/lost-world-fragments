// 환경 소리(시냇물·파도·바람) wav를 작은 모노 mp3로 바꿔 public/assets/audio/amb-*.mp3 로 넣는다.
// 원본: 에셋 팩 "Ninja Adventure - Asset Pack/Audio/Sounds/Ambient/*.wav" (zip에서 꺼낸 폴더를 넘긴다)
// 실행: node tools/convert-ambient.mjs <wav 폴더>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Mp3Encoder } from '@breezystack/lamejs';

const SRC = process.argv[2];
if (!SRC) throw new Error('wav 폴더를 넘겨 주세요');
const FILES = { river: 'River.wav', wave: 'Wave.wav', wind: 'Wind.wav', wind2: 'Wind2.wav' };
const KBPS = 64;

// 16비트 PCM wav → 채널별 Int16Array
function readWav(buf) {
  let p = 12;
  let fmt;
  while (p < buf.length) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { channels: buf.readUInt16LE(p + 10), rate: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    if (id === 'data') {
      if (!fmt || fmt.bits !== 16) throw new Error('16비트 PCM만 읽을 수 있음');
      const frames = size / 2 / fmt.channels;
      const out = Array.from({ length: fmt.channels }, () => new Int16Array(frames));
      for (let i = 0; i < frames; i++) for (let c = 0; c < fmt.channels; c++) out[c][i] = buf.readInt16LE(p + 8 + (i * fmt.channels + c) * 2);
      return { ...fmt, data: out };
    }
    p += 8 + size + (size % 2);
  }
  throw new Error('data 조각 없음');
}

for (const [key, file] of Object.entries(FILES)) {
  const wav = readWav(readFileSync(join(SRC, file)));
  const n = wav.data[0].length;
  const mono = new Int16Array(n);
  for (let i = 0; i < n; i++) mono[i] = Math.round(wav.data.reduce((s, ch) => s + ch[i], 0) / wav.data.length);
  const encoder = new Mp3Encoder(1, wav.rate, KBPS);
  const chunks = [];
  for (let i = 0; i < n; i += 1152) {
    const out = encoder.encodeBuffer(mono.slice(i, i + 1152)); // 1152샘플씩 복사본으로 (convert-music.mjs 참고)
    if (out.length) chunks.push(Buffer.from(out));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(Buffer.from(tail));
  const mp3 = Buffer.concat(chunks);
  writeFileSync(`public/assets/audio/amb-${key}.mp3`, mp3);
  console.log(`${file} → amb-${key}.mp3 (${(n / wav.rate).toFixed(0)}초, ${(mp3.length / 1024).toFixed(0)}KB)`);
}
