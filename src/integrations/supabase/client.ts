
import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from './types';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const SUPABASE_URL = "https://jazoifeaaiwouzvxaoad.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphem9pZmVhYWl3b3V6dnhhb2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4ODgyMDYsImV4cCI6MjA2MTQ2NDIwNn0.vnI43pmJT9QZ1AGds2BTg8D__6dblEGfH-fJfaEBt0I";

// Capacitor Preferences를 사용하는 커스텀 스토리지 어댑터
const capacitorLocalStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string): Promise<void> => {
    await Preferences.remove({ key });
  },
};

const options: SupabaseClientOptions<"public"> = {
  auth: {
    // 웹 환경에서는 localStorage, 네이티브 환경에서는 capacitorLocalStorage 사용
    storage: Capacitor.isNativePlatform() ? capacitorLocalStorage : localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, options);
