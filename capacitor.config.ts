import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fitfluent.connect',
  appName: 'FitFluent',
  webDir: 'dist',
  server: {
    url: 'http://192.168.35.75:8082', // 확인된 PC의 IPv4 주소와 Vite 포트로 수정
    cleartext: true 
  }
};

export default config;
