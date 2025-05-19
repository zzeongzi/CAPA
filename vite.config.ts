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
    host: "0.0.0.0",
    port: 5000,
    strictPort: true,
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
