import { createClient } from "@supabase/supabase-js";

// Safe loading and sanitizing of Supabase credentials
const env = (import.meta as any).env || {};

const rawUrl = env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = 
  env.VITE_SUPABASE_ANON_KEY || 
  env.VITE_SUPABASE_ANON || 
  env.VITE_SUPABASE_ANO || 
  env.VITE_SUPABASE_ANC || 
  env.VITE_SUPABASE_AN || 
  "";

// Cleans the URL to prevent "PGRST125: Invalid path specified in request URL"
export const sanitizeSupabaseUrl = (url: string): string => {
  if (!url) return "";
  let cleanUrl = url.trim();
  
  // If user pasted just the sub-domain/project reference (e.g. "clgvhxiwpcenvkjbooz")
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://") && cleanUrl.length > 0 && !cleanUrl.includes(".")) {
    cleanUrl = `https://${cleanUrl}.supabase.co`;
  }
  
  // Remove /rest/v1 or /rest/v1/ suffix if entered by mistake
  cleanUrl = cleanUrl.replace(/\/rest\/v1\/?$/, "");
  
  // Remove all trailing slashes
  while (cleanUrl.endsWith("/")) {
    cleanUrl = cleanUrl.slice(0, -1);
  }
  
  return cleanUrl;
};

const supabaseUrl = sanitizeSupabaseUrl(rawUrl);

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("http"));
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

