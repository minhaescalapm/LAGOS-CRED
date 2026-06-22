import { createClient } from "@supabase/supabase-js";

// Safe loading and sanitizing of Supabase credentials
const env = (import.meta as any).env || {};

const rawUrl = env.VITE_SUPABASE_URL || "";
const rawKey = 
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
  
  // Strip any leading/trailing quotes (single or double) from copying
  cleanUrl = cleanUrl.replace(/^['"]|['"]$/g, "").trim();
  
  // If user pasted just the sub-domain/project reference (e.g. "clgvhxiwpcenvkjbooz")
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://") && cleanUrl.length > 0 && !cleanUrl.includes(".")) {
    cleanUrl = `https://${cleanUrl}.supabase.co`;
  }
  
  // If they pasted "https://clgvhxiwpcenvkjbooz" without ".supabase.co"
  if (cleanUrl.startsWith("https://") && !cleanUrl.slice(8).includes(".")) {
    cleanUrl = `${cleanUrl}.supabase.co`;
  }
  if (cleanUrl.startsWith("http://") && !cleanUrl.slice(7).includes(".")) {
    cleanUrl = `${cleanUrl}.supabase.co`;
  }
  
  // Remove /rest/v1 or /rest/v1/ suffix if entered by mistake
  cleanUrl = cleanUrl.replace(/\/rest\/v1\/?$/, "");
  
  // Remove all trailing slashes
  while (cleanUrl.endsWith("/")) {
    cleanUrl = cleanUrl.slice(0, -1);
  }
  
  return cleanUrl;
};

export const sanitizeSupabaseKey = (key: string): string => {
  if (!key) return "";
  return key.trim().replace(/^['"]|['"]$/g, "").trim();
};

const supabaseUrl = sanitizeSupabaseUrl(rawUrl);
const supabaseAnonKey = sanitizeSupabaseKey(rawKey);

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("http"));
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface DiagnosticResult {
  rawUrl: string;
  rawKey: string;
  maskedUrl: string;
  maskedKey: string;
  maskedCleanUrl: string;
  cleanUrl: string;
  isConfigured: boolean;
  pingResult: {
    success: boolean;
    message: string;
    code: string;
  };
}

export const getSupabaseDiagnostics = async (): Promise<DiagnosticResult> => {
  const envVar = (import.meta as any).env || {};
  const urlVar = envVar.VITE_SUPABASE_URL || "";
  const keyVar = 
    envVar.VITE_SUPABASE_ANON_KEY || 
    envVar.VITE_SUPABASE_ANON || 
    envVar.VITE_SUPABASE_ANO || 
    envVar.VITE_SUPABASE_ANC || 
    envVar.VITE_SUPABASE_AN || 
    "";

  const cleanUrl = sanitizeSupabaseUrl(urlVar);
  const cleanKey = sanitizeSupabaseKey(keyVar);

  const maskString = (str: string) => {
    if (!str) return "Vazio / Não configurado";
    if (str.length <= 10) return "****";
    return `${str.substring(0, 8)}...${str.substring(str.length - 6)}`;
  };

  const isConfigured = !!(cleanUrl && cleanKey && cleanUrl.startsWith("http"));

  let pingResult = { success: false, message: "Não testado", code: "" };
  if (isConfigured && supabase) {
    try {
      const { data, error } = await supabase.from("clients").select("id").limit(1);
      if (error) {
        pingResult = {
          success: false,
          message: error.message || JSON.stringify(error),
          code: error.code || ""
        };
      } else {
        pingResult = {
          success: true,
          message: "Conexão de leitura bem-sucedida! Canal de dados aberto com sucesso no Supabase.",
          code: "OK"
        };
      }
    } catch (err: any) {
      pingResult = {
        success: false,
        message: err.message || JSON.stringify(err),
        code: "CATCH_ERROR"
      };
    }
  } else {
    pingResult = {
      success: false,
      message: "Supabase não foi detectado nas variáveis de ambiente da aplicação. Veja o Passo 3 abaixo.",
      code: "NOT_CONFIGURED"
    };
  }

  return {
    rawUrl: urlVar,
    rawKey: keyVar,
    maskedUrl: maskString(urlVar),
    maskedKey: maskString(keyVar),
    maskedCleanUrl: maskString(cleanUrl),
    cleanUrl,
    isConfigured,
    pingResult
  };
};

