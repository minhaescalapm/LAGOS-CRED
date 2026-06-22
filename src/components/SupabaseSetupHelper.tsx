import React, { useState } from "react";
import { dbService } from "../services/dbService";
import { Database, Server, Copy, Check, Info, FileText } from "lucide-react";

export function SupabaseSetupHelper() {
  const [copied, setCopied] = useState(false);

  const isConfigured = dbService.isUsingSupabase();

  const sqlCode = `-- ==========================================
-- LAGOS CRÉDITO - SUPABASE DATABASE SCHEMA
-- ==========================================
-- Cole este script no SQL Editor do seu Supabase:

-- 1. Tabela de Clientes
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Contratos / Empréstimos (Loans)
CREATE TABLE IF NOT EXISTS public.loans (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    amount_invested NUMERIC NOT NULL,
    total_amount NUMERIC NOT NULL,
    daily_rate NUMERIC NOT NULL,
    total_days INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Parcelas / Pagamentos (Payments)
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    payment_date TEXT NOT NULL,
    reference_date TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Otimização (Índices para consultas ágeis)
CREATE INDEX IF NOT EXISTS idx_loans_client_id ON public.loans(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON public.payments(loan_id);

-- 5. Segurança do Supabase (RLS Policies)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso Livre Select" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Acesso Livre Insert" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso Livre Update" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Acesso Livre Delete" ON public.clients FOR DELETE USING (true);

CREATE POLICY "Acesso Livre Select" ON public.loans FOR SELECT USING (true);
CREATE POLICY "Acesso Livre Insert" ON public.loans FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso Livre Update" ON public.loans FOR UPDATE USING (true);
CREATE POLICY "Acesso Livre Delete" ON public.loans FOR DELETE USING (true);

CREATE POLICY "Acesso Livre Select" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Acesso Livre Insert" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso Livre Update" ON public.payments FOR UPDATE USING (true);
CREATE POLICY "Acesso Livre Delete" ON public.payments FOR DELETE USING (true);`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="supabase-setup" className="bg-zinc-950/40 border border-zinc-850 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-4 sm:p-5 border-b border-zinc-900 bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 select-none">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-xs sm:text-sm text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              Armazenamento em Nuvem (Supabase SQL)
            </h3>
            <p className="text-[10px] text-zinc-500">Sincronização persistente para evitar perda de dados.</p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Status Banco:</span>
          {isConfigured ? (
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-550/20 text-emerald-400 text-[10px] font-black rounded-lg uppercase tracking-wide flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              🟢 Conectado à Nuvem
            </span>
          ) : (
            <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-550/25 text-yellow-500 text-[10px] font-black rounded-lg uppercase tracking-wide flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              Local Storage (Offline)
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Helper guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs select-none">
          <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-850 space-y-2">
            <span className="text-[9px] font-extrabold text-yellow-500 uppercase tracking-widest block flex items-center gap-1">
              <Server className="w-3.5 h-3.5" />
              Como configurar as Chaves?
            </span>
            <p className="text-zinc-400 leading-relaxed text-[11px]">
              Insira as seguintes variáveis de ambiente no painel de configurações do seu projeto (arquivo <strong className="text-zinc-200">.env</strong>):
            </p>
            <div className="font-mono text-[10px] bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 text-zinc-400 space-y-1 block overflow-x-auto">
              <p><span className="text-yellow-500 font-bold">VITE_SUPABASE_URL</span>=https://seu-projeto.supabase.co</p>
              <p><span className="text-yellow-500 font-bold">VITE_SUPABASE_ANON_KEY</span>=sua-chave-anonima...</p>
            </div>
            <p className="text-[10px] text-zinc-500 leading-normal">
              💡 Quando as chaves forem detectadas nas configurações, o Lagos Crédito mudará automaticamente do armazenamento local no navegador para gravação online unificada!
            </p>
          </div>

          <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-850 space-y-2">
            <span className="text-[9px] font-extrabold text-yellow-500 uppercase tracking-widest block flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              Benefícios do Armazenamento SQL
            </span>
            <ul className="space-y-1.5 text-zinc-400 text-[11px] list-none">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong className="text-zinc-200">Acesso Multi-Dispositivo</strong>: veja e edite os clientes no telefone, computador e tablet simultaneamente.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong className="text-zinc-200">Zero perdas</strong>: mesmo limpando o cache do navegador ou trocando de aparelho celular, seus registros permanecem intocáveis.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span><strong className="text-zinc-200">Exclusões Cascata Seguras</strong>: ao excluir um cliente, as cobranças antigas e parcelas são limpas de forma síncrona.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* SQL Script Viewer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between select-none">
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-yellow-500" />
              Script SQL de Criação das Tabelas
            </span>
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                copied 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-555/20" 
                  : "bg-yellow-500 text-zinc-950 hover:bg-yellow-405 shadow-md shadow-yellow-500/5 hover:-translate-y-0.5"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Script SQL
                </>
              )}
            </button>
          </div>

          <div className="relative">
            <pre className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl text-[11px] font-mono text-zinc-300 leading-relaxed overflow-x-auto max-h-64 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {sqlCode}
            </pre>
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none rounded-b-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
