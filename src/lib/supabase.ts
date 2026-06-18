/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

// Default fallback credentials provided by the user
const env = (import.meta as any).env || {};
const DEFAULT_URL = env.VITE_SUPABASE_URL || 'https://ojkmqivtyzyqkvpxqaok.supabase.co';
const DEFAULT_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_e2xJTVnppqlCFIQcSJ_0BA_GKM3TTFu';

// Attempt to load custom credentials from localStorage (if user overrides them)
export const getSupabaseConfig = () => {
  const customUrl = localStorage.getItem('supabase_custom_url');
  const customKey = localStorage.getItem('supabase_custom_anon_key');
  return {
    url: customUrl || DEFAULT_URL,
    anonKey: customKey || DEFAULT_ANON_KEY,
    isCustom: !!(customUrl || customKey),
  };
};

export const saveSupabaseConfig = (url: string, anonKey: string) => {
  if (url.trim()) {
    localStorage.setItem('supabase_custom_url', url.trim());
  } else {
    localStorage.removeItem('supabase_custom_url');
  }

  if (anonKey.trim()) {
    localStorage.setItem('supabase_custom_anon_key', anonKey.trim());
  } else {
    localStorage.removeItem('supabase_custom_anon_key');
  }
};

export const resetSupabaseConfig = () => {
  localStorage.removeItem('supabase_custom_url');
  localStorage.removeItem('supabase_custom_anon_key');
};

// Create and export the master client
const config = getSupabaseConfig();
export const supabase = createClient(config.url, config.anonKey);

// Helper function to recreate the client if credentials change dynamically
export const recreateSupabaseClient = (url: string, anonKey: string) => {
  return createClient(url, anonKey);
};
