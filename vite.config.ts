import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages는 하위 경로(/저장소이름/)에서 서비스되므로 상대 경로로 빌드한다.
  base: './',
  server: {
    port: 5173,
  },
  build: {
    // Phaser 엔진 자체가 약 1.2MB(gzip 약 320KB)라 기본 경고 기준(500KB)을 올린다.
    chunkSizeWarningLimit: 1500,
  },
});
