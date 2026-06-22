-- ==========================================
-- LAGOS CRÉDITO - SUPABASE DATABASE SCHEMA
-- ==========================================
-- Execute o script abaixo no editor SQL (SQL Editor) do seu projeto no Supabase
-- para habilitar o armazenamento seguro e sincronizado de Clientes, Contratos e Pagamentos.

-- 1. Tabela de Clientes (clients)
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Contratos / Empréstimos (loans)
-- Cascade Delete garante que ao excluir um cliente, seu contrato é desfeito automaticamente sem deixar restos
CREATE TABLE IF NOT EXISTS public.loans (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    amount_invested NUMERIC NOT NULL,
    total_amount NUMERIC NOT NULL,
    daily_rate NUMERIC NOT NULL,
    total_days INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    exclude_sundays BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Parcelas / Pagamentos (payments)
-- Cascade Delete garante que ao excluir um contrato, todos os lançamentos de pagamento são limpos
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    payment_date TEXT NOT NULL,
    reference_date TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Otimização de Performance
-- Índices para buscas rápidas em joins frequentes
CREATE INDEX IF NOT EXISTS idx_loans_client_id ON public.loans(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON public.payments(loan_id);

-- 5. Segurança de Nível de Linha (RLS - Row Level Security)
-- Habilita políticas públicas simples para comunicação direta via Client SDK (anon key)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para 'clients'
CREATE POLICY "Permitir select para todos" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Permitir insert para todos" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update para todos" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Permitir delete para todos" ON public.clients FOR DELETE USING (true);

-- Políticas de acesso para 'loans'
CREATE POLICY "Permitir select para todos" ON public.loans FOR SELECT USING (true);
CREATE POLICY "Permitir insert para todos" ON public.loans FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update para todos" ON public.loans FOR UPDATE USING (true);
CREATE POLICY "Permitir delete para todos" ON public.loans FOR DELETE USING (true);

-- Políticas de acesso para 'payments'
CREATE POLICY "Permitir select para todos" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Permitir insert para todos" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update para todos" ON public.payments FOR UPDATE USING (true);
CREATE POLICY "Permitir delete para todos" ON public.payments FOR DELETE USING (true);
