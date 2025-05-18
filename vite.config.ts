/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import postcss from './postcss.config.ts';
// Vitest 설정 import 추가
import { configDefaults } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // host: "192.168.35.75", // 특정 IP 주소 대신 모든 인터페이스에서 수신하도록 주석 처리 또는 삭제
    port: 8082, // capacitor.config.ts와 동일한 포트로 변경
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  css: { // CSS 설정 추가
    postcss, // PostCSS 설정 명시적 적용 (타입 단언 제거)
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Vitest 설정 추가
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts', // 설정 파일 경로 (필요시 생성)
    exclude: [...configDefaults.exclude, '**/node_modules/**', '**/dist/**'],
  },
}));
