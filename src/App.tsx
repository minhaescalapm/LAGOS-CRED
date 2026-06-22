import React, { useState, useEffect } from "react";
import { dbService } from "./services/dbService";
import { ClientWithLoanDetails, FinancialStats, Loan, Payment } from "./types";
import { getTodayStr, formatFriendlyDate } from "./utils/dateUtils";
import { FinancialSummary } from "./components/FinancialSummary";
import { getSupabaseDiagnostics, DiagnosticResult } from "./services/supabaseClient";
import { StatsSection } from "./components/StatsSection";
import { AlertsSection } from "./components/AlertsSection";
import { ClientForm } from "./components/ClientForm";
import { ClientCard } from "./components/ClientCard";
import { ClientsDirectory } from "./components/ClientsDirectory";
import { FinancialControl } from "./components/FinancialControl";
import { QuickCollectModal } from "./components/QuickCollectModal";
import { SmartAgenda } from "./components/SmartAgenda";
import { 
  Plus, 
  Search, 
  Users, 
  DollarSign, 
  Copy, 
  Check, 
  Smartphone, 
  X, 
  Info,
  CalendarDays,
  Sparkles,
  Download,
  RotateCcw,
  Trash2,
  Loader2,
  Coins,
  Send,
  Home,
  ArrowLeft,
  Server
} from "lucide-react";

export default function App() {
  const [simulationDate, setSimulationDate] = useState(() => getTodayStr());
  const [clientsWithLoans, setClientsWithLoans] = useState<ClientWithLoanDetails[]>([]);
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<"home" | "collections" | "financial_control" | "agenda">("home");
  const [agendaPreSelectedDate, setAgendaPreSelectedDate] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "DELAYED" | "UP_TO_DATE" | "NO_LOAN">("ALL");
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientWithLoanDetails | null>(null);
  const [pixModal, setPixModal] = useState<{ isOpen: boolean; clientName: string }>({
    isOpen: false,
    clientName: ""
  });
  const [pixCopied, setPixCopied] = useState(false);
  const [showPwaGuide, setShowPwaGuide] = useState(false);
  const [showDbGuide, setShowDbGuide] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [showQuickCollectModal, setShowQuickCollectModal] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [isTestingDiag, setIsTestingDiag] = useState(false);

  const runDiagnostics = async () => {
    setIsTestingDiag(true);
    try {
      const res = await getSupabaseDiagnostics();
      setDiagnostics(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTestingDiag(false);
    }
  };

  useEffect(() => {
    if (showDbGuide) {
      runDiagnostics();
    }
  }, [showDbGuide]);

  // Sync state from LocalStorage or Supabase on mount and state changes
  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [list, financialStats, fetchedLoans, fetchedPayments] = await Promise.all([
        dbService.getClientDetailsList(simulationDate),
        dbService.getFinancialStats(simulationDate),
        dbService.getLoans ? dbService.getLoans() : Promise.resolve([]),
        dbService.getPayments ? dbService.getPayments() : Promise.resolve([])
      ]);
      setClientsWithLoans(list);
      setStats(financialStats);
      setAllLoans(fetchedLoans as Loan[]);
      setAllPayments(fetchedPayments as Payment[]);
    } catch (err) {
      console.error("Erro ao carregar dados financeiros:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [simulationDate]);

  // Handle new client creation
  const handleAddNewClient = async (data: {
    name: string;
    phone: string;
    amountInvested: number;
    totalDays: number;
    dailyRate: number;
    startDate: string;
    clientId?: string;
  }) => {
    setIsLoading(true);
    try {
      let targetClientId: string;
      if (data.clientId) {
        // Se selecionamos um cliente existente no autocomplete, atualizamos os dados dele para sincronia e usamos seu ID
        await dbService.editClient(data.clientId, data.name, data.phone);
        targetClientId = data.clientId;
      } else {
        const newClient = await dbService.addClient(data.name, data.phone);
        targetClientId = newClient.id;
      }

      await dbService.addLoan(
        targetClientId,
        data.amountInvested,
        data.totalDays,
        data.dailyRate,
        data.startDate
      );
      setShowAddModal(false);
      await refreshData();
    } catch (err) {
      console.error("Erro ao cadastrar novo cliente:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle client edit and update
  const handleEditClientSubmit = async (data: {
    name: string;
    phone: string;
    amountInvested: number;
    totalDays: number;
    dailyRate: number;
    startDate: string;
  }) => {
    if (!editingClient) return;
    setIsLoading(true);
    try {
      await dbService.editClient(editingClient.client.id, data.name, data.phone);

      if (editingClient.activeLoan) {
        await dbService.editActiveLoan(
          editingClient.activeLoan.id,
          data.amountInvested,
          data.totalDays,
          data.dailyRate,
          data.startDate
        );
      } else {
        await dbService.addLoan(
          editingClient.client.id,
          data.amountInvested,
          data.totalDays,
          data.dailyRate,
          data.startDate
        );
      }
      setEditingClient(null);
      await refreshData();
    } catch (err) {
      console.error("Erro ao salvar alterações do cliente:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle clearing database for testing fresh
  const handleClearAllData = async () => {
    if (window.confirm("ATENÇÃO: Tem certeza de que deseja APAGAR TODOS os dados? Clientes, contratos e repasses serão removidos para testes do zero.")) {
      setIsLoading(true);
      try {
        await dbService.clearAllData();
        await refreshData();
      } catch (err) {
        console.error("Erro ao limpar dados:", err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle generating mock values if desired
  const handleRestoreDemoData = async () => {
    if (window.confirm("Gerar uma carteira completa de clientes fictícios para testes estruturais de homologação?")) {
      setIsLoading(true);
      try {
        await dbService.resetToMockSync();
        await refreshData();
      } catch (err) {
        console.error("Erro ao preencher mock data:", err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle register payment (+1 logic)
  const handleRegisterPayment = async (loanId: string, count: number, dateStr: string) => {
    setIsLoading(true);
    try {
      await dbService.registerPayment(loanId, count, dateStr);
      await refreshData();
    } catch (err: any) {
      alert(err.message || "Erro ao registrar o pagamento.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Adjusting Loan start date and paid count directly
  const handleAdjustLoan = async (loanId: string, targetPaidCount: number, targetStartDate: string) => {
    setIsLoading(true);
    try {
      await dbService.adjustLoanPaymentsAndStartDate(loanId, targetPaidCount, targetStartDate);
      await refreshData();
    } catch (err: any) {
      console.error("Erro ao reajustar contrato:", err);
      alert("Erro ao reajustar contrato: " + (err.message || "Tente novamente."));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle toggling excludeSundays setting for customer loan
  const handleToggleSunday = async (loanId: string) => {
    setIsLoading(true);
    try {
      await dbService.toggleExcludeSundays(loanId);
      await refreshData();
    } catch (err: any) {
      console.error("Erro ao alterar isenção de domingos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle client delete with confirmation cascade
  const handleDeleteClient = async (clientId: string) => {
    setIsLoading(true);
    try {
      await dbService.deleteClient(clientId);
      await refreshData();
    } catch (err: any) {
      console.error("Erro ao deletar cliente:", err);
      alert("Erro ao deletar cliente: " + (err.message || "Por favor, tente novamente."));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Pix clipboard copying
  const handleCopyPix = () => {
    const pixKey = "lagoscelular5@gmail.com";
    navigator.clipboard.writeText(pixKey)
      .then(() => {
        setPixCopied(true);
        setTimeout(() => setPixCopied(false), 3000);
      })
      .catch(() => {
        // Fallback for isolated IFrames
        const textArea = document.createElement("textarea");
        textArea.value = pixKey;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
          setPixCopied(true);
          setTimeout(() => setPixCopied(false), 3000);
        } catch (e) {
          console.error("Não foi possível copiar chave PIX.");
        }
        document.body.removeChild(textArea);
      });
  };

  // Filter logic for client listing
  const filteredClients = clientsWithLoans.filter(c => {
    const matchesSearch = c.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.client.phone.includes(searchTerm);
    
    if (!matchesSearch) return false;

    if (filterType === "DELAYED") {
      return c.isDelayed && c.activeLoan;
    }
    if (filterType === "UP_TO_DATE") {
      return !c.isDelayed && c.activeLoan && c.paidCount < c.totalDays;
    }
    if (filterType === "NO_LOAN") {
      return !c.activeLoan;
    }

    return true; // "ALL"
  });

  return (
    <div id="pwa-root" className="min-h-screen bg-[#0d0d0f] text-zinc-100 font-sans flex flex-col antialiased">
      
      {/* 1. TOP HEADER BRANDBAR */}
      <header className="sticky top-0 z-40 bg-[#0d0d0f]/95 border-b border-zinc-800/80 backdrop-blur-md px-4 py-3.5 select-none">
        <div id="brand-header" className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Accent Symbol */}
            <div className="p-2 bg-gradient-to-tr from-yellow-500 to-amber-400 text-black font-extrabold text-xs tracking-tight rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.25)]">
              LC
            </div>
            <div>
              <h1 className="font-extrabold text-md md:text-lg tracking-tight bg-gradient-to-r from-zinc-100 via-zinc-200 to-yellow-500 bg-clip-text text-transparent">
                LAGOS CREDIT
              </h1>
              <p className="text-[10px] text-zinc-500 font-medium">Gestão de Empréstimos Diários</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* System Clock Information Container */}
            <div className="hidden lg:flex items-center gap-2 bg-zinc-900 border border-zinc-800/80 px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-400">
              <CalendarDays className="w-3.5 h-3.5 text-yellow-500" />
              <span>Simulação: {formatFriendlyDate(simulationDate)}</span>
            </div>

            {/* Spinner loading feedback */}
            {isLoading && (
              <div className="p-1.5 text-yellow-500 flex items-center justify-center animate-spin" title="Sincronizando banco de dados">
                <Loader2 className="w-4 h-4 shrink-0" />
              </div>
            )}

            {/* Limpar Base / Modo Teste Limpo */}
            <button
              onClick={handleClearAllData}
              disabled={isLoading}
              className="p-1.5 sm:px-3 sm:py-1.5 bg-red-950/20 hover:bg-red-900/30 text-red-400 text-xs font-bold rounded-lg border border-red-900/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Limpar todos os dados para testes do zero"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar Banco</span>
            </button>

            {/* Gerar Demo */}
            <button
              onClick={handleRestoreDemoData}
              disabled={isLoading}
              className="p-1.5 sm:px-3 sm:py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-lg border border-zinc-800 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Carregar dados de demonstração fictícios"
            >
              <RotateCcw className="w-3.5 h-3.5 text-yellow-500" />
              <span className="hidden sm:inline">Gerar Demo</span>
            </button>

            {/* PWA Guide button */}
            <button
              onClick={() => setShowPwaGuide(true)}
              className="p-1.5 sm:px-3 sm:py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-lg border border-zinc-800 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Instalar Aplicativo (PWA)"
            >
              <Download className="w-3.5 h-3.5 text-yellow-500" />
              <span className="hidden md:inline">Instalar App</span>
            </button>

            {/* Iniciar Operação / Novo cliente */}
            <button
              onClick={() => setShowAddModal(true)}
              disabled={isLoading}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-405 hover:to-amber-405 text-zinc-950 font-black text-xs rounded-xl shadow-lg shadow-yellow-500/10 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Novo Contrato</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE SCROLLSTAGE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* DYNAMIC CLOUD DATABASE SYNC WARNING / HEALTH STATUS */}
        <div className="bg-zinc-950/45 border border-zinc-850 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-zinc-400 select-none shadow-md">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="leading-snug text-zinc-300">
                {dbService.isUsingSupabase() ? (
                  <>
                    🚀 <strong className="text-yellow-500">Banco de Dados Online Ativo:</strong> Seus clientes, contratos e repasses estão sincronizados de forma 100% segura na nuvem. Você pode acessar, cadastrar e receber de qualquer celular em tempo real!
                  </>
                ) : (
                  <>
                    ⚠️ <strong className="text-red-400">Modo de Testes Local (Offline):</strong> Os dados cadastrados ficam salvos <strong>apenas no navegador deste celular</strong>. Se você acessar por outro celular ou limpar o histórico, os dados não estarão lá.
                  </>
                )}
              </p>
              {!dbService.isUsingSupabase() && (
                <p className="text-[11px] text-zinc-400 font-medium">
                  <button 
                    type="button"
                    onClick={() => setShowDbGuide(true)} 
                    className="text-yellow-500 font-extrabold hover:text-yellow-405 underline cursor-pointer inline-flex items-center gap-1 transition-all"
                  >
                    <span>Clique aqui para ver como conectar no Supabase Grátis (Qualquer celular acessa) →</span>
                  </button>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDbGuide(true)}
            className="flex items-center gap-2 bg-zinc-950/80 hover:bg-zinc-900 px-3.5 py-2 rounded-xl border border-zinc-850 shrink-0 transition-all cursor-pointer active:scale-98 font-bold text-center self-start md:self-auto"
            title="Sincronização de Dispositivos e Banco"
          >
            <span className={`w-2 h-2 rounded-full ${dbService.isUsingSupabase() ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"}`} />
            <span className="text-[10px] uppercase font-black text-zinc-300 tracking-wider font-mono">
              {dbService.isUsingSupabase() ? "NUVEM CONECTADA" : "MODO LOCAL (OFFLINE)"}
            </span>
          </button>
        </div>

        {/* 3. CORE BALANCES (FINANCIAL SUMMARY) */}
        {stats && <FinancialSummary stats={stats} />}

        {/* 4. TAB NAVIGATION TOGGLES ON SINGLE PAGE (Meets Single-View Guidelines) */}
        <div id="navigation-tabs" className="grid grid-cols-4 gap-1 border-b border-zinc-850/85 select-none bg-zinc-950/20 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("home")}
            className={`py-3 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "home"
                ? "bg-gradient-to-b from-zinc-850 to-zinc-900/40 text-yellow-500 border border-zinc-800/60 shadow-inner"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Home className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="hidden sm:inline">Tela Inicial</span>
            <span className="sm:hidden">Início</span>
          </button>

          <button
            onClick={() => setActiveTab("collections")}
            className={`py-3 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "collections"
                ? "bg-gradient-to-b from-zinc-850 to-zinc-900/40 text-yellow-500 border border-zinc-800/60 shadow-inner"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Diretório de Clientes e Fichas de Cobrança"
          >
            <Users className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="hidden sm:inline">Clientes</span>
            <span className="sm:hidden font-sans">Clientes</span>
          </button>

          <button
            onClick={() => setActiveTab("agenda")}
            className={`py-3 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "agenda"
                ? "bg-gradient-to-b from-zinc-850 to-zinc-900/40 text-yellow-500 border border-zinc-800/60 shadow-inner"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Agenda Inteligente 📅"
          >
            <CalendarDays className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="hidden sm:inline">Agenda Inteligente</span>
            <span className="sm:hidden">Agenda</span>
          </button>

          <button
            onClick={() => setActiveTab("financial_control")}
            className={`py-3 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "financial_control"
                ? "bg-gradient-to-b from-zinc-850 to-zinc-900/40 text-yellow-500 border border-zinc-850/30 shadow-inner"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="hidden sm:inline">Controle Financeiro</span>
            <span className="sm:hidden">Financeiro</span>
          </button>
        </div>

        {/* TELA INICIAL (Dashboard) */}
        {activeTab === "home" && stats && (
          <div className="space-y-6 animate-fade-in">
            {/* Boas-vindas Banner */}
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden select-none">
              <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                <Coins className="w-64 h-64 text-yellow-500 translate-x-12 translate-y-12" />
              </div>
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-black uppercase tracking-wider rounded-lg mb-3">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  Gerenciamento Lagos Crédito Active v2
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                  Bem-vindo ao Lagos Crédito, Lagos Celular5
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-2 font-medium leading-relaxed">
                  Painel administrativo para controle e monitoramento de cobranças em tempo real. Acompanhe o caixa, gerencie sua carteira de clientes ativos e controle as diárias de microcrédito com backup seguro na nuvem.
                </p>
              </div>
            </div>

            {/* SEÇÃO PRINCIPAL DE TODOS OS VALORES DO EMPRÉSTIMO */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-450 mb-3 block">Dados Financeiros dos Empréstimos</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Capital Investido */}
                <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-2xl select-none relative group hover:border-yellow-500/30 transition-all">
                  <dt className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Capital Emprestado</dt>
                  <dd className="text-xl sm:text-2xl font-black text-white mt-1 group-hover:text-yellow-500 transition-colors">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.moneyInvested)}
                  </dd>
                  <p className="text-[9px] text-zinc-550 mt-1">Capital líquido ativo na rua</p>
                </div>

                {/* 2. Juros Projetados */}
                <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-2xl select-none relative group hover:border-yellow-500/30 transition-all">
                  <dt className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans">Lucro Esperado (Juros)</dt>
                  <dd className="text-xl sm:text-2xl font-black text-yellow-500 mt-1">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.totalProfit)}
                  </dd>
                  <p className="text-[9px] text-zinc-550 mt-1">Rendimento futuro projetado</p>
                </div>

                {/* 3. Retorno Bruto Total */}
                <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-2xl select-none relative group hover:border-yellow-500/30 transition-all">
                  <dt className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Retorno Bruto Total</dt>
                  <dd className="text-xl sm:text-2xl font-black text-white mt-1">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.moneyInvested + stats.totalProfit)}
                  </dd>
                  <p className="text-[9px] text-zinc-550 mt-1">Soma de capital + lucro esperado</p>
                </div>

                {/* 4. Restante a Receber */}
                <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-2xl select-none relative group hover:border-yellow-500/30 transition-all">
                  <dt className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Saldos a Receber</dt>
                  <dd className="text-xl sm:text-2xl font-black text-emerald-500 mt-1">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.futureProjections)}
                  </dd>
                  <p className="text-[9px] text-zinc-550 mt-1">Valor pendente de cobranças</p>
                </div>

                {/* 5. Recebido no Ciclo Corrente */}
                <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-2xl select-none relative group hover:border-yellow-500/30 transition-all">
                  <dt className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Recebido (Mês)</dt>
                  <dd className="text-lg sm:text-xl font-extrabold text-yellow-500 mt-1">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.receivedThisMonth)}
                  </dd>
                  <p className="text-[9px] text-zinc-550 mt-1">Soma recebida no ciclo mensal</p>
                </div>

                {/* 6. Recebido na Semana */}
                <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-2xl select-none relative group hover:border-yellow-500/30 transition-all">
                  <dt className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Recebido (Semana)</dt>
                  <dd className="text-lg sm:text-xl font-extrabold text-white mt-1">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.receivedThisWeek)}
                  </dd>
                  <p className="text-[9px] text-zinc-550 mt-1">Soma móvel dos últimos 7 dias</p>
                </div>

                {/* 7. Total de Clientes Cadastrados */}
                <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-2xl select-none relative group hover:border-yellow-500/30 transition-all">
                  <dt className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total de Clientes</dt>
                  <dd className="text-xl font-black text-white mt-1">
                    {clientsWithLoans.length}
                  </dd>
                  <p className="text-[9px] text-zinc-550 mt-1">Cadastros totais na carteira</p>
                </div>

                {/* 8. Contratos em Atraso */}
                <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-2xl select-none relative group hover:border-yellow-500/30 transition-all">
                  <dt className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Clientes Com Atraso</dt>
                  <dd className={`text-xl font-black mt-1 ${clientsWithLoans.filter(c => c.isDelayed).length > 0 ? "text-red-500" : "text-zinc-400"}`}>
                    {clientsWithLoans.filter(c => c.isDelayed).length}
                  </dd>
                  <p className="text-[9px] text-zinc-550 mt-1">Parceiros com diária vencida</p>
                </div>
              </div>
            </div>

            {/* Atalhos Rápidos Premium */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-450 mb-3 block">Ações Rápidas</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Atalho 1: Clientes */}
                <button
                  type="button"
                  onClick={() => setActiveTab("collections")}
                  className="group block text-left bg-zinc-900/40 hover:bg-zinc-850/60 border border-zinc-850/80 hover:border-yellow-500/40 p-5 rounded-2xl transition-all shadow-md hover:shadow-yellow-500/5 cursor-pointer relative"
                >
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center text-yellow-500 mb-4 transition-all group-hover:scale-110">
                    <Users className="w-5 h-5 text-yellow-500" />
                  </div>
                  <h4 className="font-extrabold text-white text-sm group-hover:text-yellow-500 transition-colors">
                    Gerenciar Clientes e Cobranças →
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Pesquise clientes, envie mensagens de cobrança no WhatsApp e mude prazos contratuais.
                  </p>
                </button>

                {/* Atalho 2: Cadastrar */}
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="group block text-left bg-zinc-900/40 hover:bg-zinc-850/60 border border-zinc-850/80 hover:border-yellow-500/40 p-5 rounded-2xl transition-all shadow-md hover:shadow-yellow-500/5 cursor-pointer relative"
                >
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center text-yellow-500 mb-4 transition-all group-hover:scale-110">
                    <Plus className="w-5 h-5 text-yellow-500" />
                  </div>
                  <h4 className="font-extrabold text-white text-sm group-hover:text-yellow-500 transition-colors">
                    Cadastrar Novo Cliente →
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Adicione um novo cliente e defina os parâmetros do contrato de diárias de forma instantânea.
                  </p>
                </button>

                {/* Atalho 3: Controle Financeiro */}
                <button
                  type="button"
                  onClick={() => setActiveTab("financial_control")}
                  className="group block text-left bg-zinc-900/40 hover:bg-zinc-850/60 border border-zinc-850/80 hover:border-yellow-500/40 p-5 rounded-2xl transition-all shadow-md hover:shadow-yellow-500/5 cursor-pointer relative"
                >
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center text-yellow-500 mb-4 transition-all group-hover:scale-110">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                  </div>
                  <h4 className="font-extrabold text-white text-sm group-hover:text-yellow-500 transition-colors">
                    Relatório Financeiro Inteligente →
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Consulte projeções semanais, faturamento por meses de referência e gráficos analíticos.
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: CLIENTES & COBRANÇA DIRECTORY FILTER GRID (COLLS) */}
        {activeTab === "collections" && (
          <div className="space-y-5 animate-fade-in">
            {/* VOLTAR BUTTON */}
            <div className="flex items-center justify-start pb-1">
              <button
                type="button"
                onClick={() => setActiveTab("home")}
                className="py-2 px-4 bg-zinc-900 hover:bg-zinc-800 text-yellow-500 font-bold text-xs rounded-xl border border-zinc-850 flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-black/40"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para Tela Inicial</span>
              </button>
            </div>
            {/* 2A. FILTER CONTROLS BAR */}
            <div className="flex flex-col lg:flex-row gap-3 items-center justify-between select-none">
              
              {/* Search & Bulk Trigger Field */}
              <div className="flex flex-col sm:flex-row gap-2.5 w-full lg:max-w-xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Pesquisar cliente por nome ou celular..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-950/60 border border-zinc-800/80 focus:border-yellow-500 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-650 transition-colors"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-yellow-500 hover:bg-yellow-405 text-zinc-950 font-black text-xs rounded-xl shadow-lg shadow-yellow-500/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                    title="Adicionar Novo Cliente e Contrato"
                  >
                    <Plus className="w-4 h-4 text-zinc-950" />
                    <span>Cadastrar Cliente</span>
                  </button>
                  <button
                    onClick={() => setShowQuickCollectModal(true)}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-850 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                    title="Enviar cobrança para todos os atrasados"
                  >
                    <Send className="w-4 h-4 text-yellow-500" />
                    <span>Cobrança Rápida</span>
                  </button>
                </div>
              </div>

              {/* Status Categorizer Badges */}
              <div className="flex flex-wrap gap-1.5 w-full lg:w-auto justify-start lg:justify-end">
                {[
                  { value: "ALL", label: "Todos" },
                  { value: "DELAYED", label: "Atrasados" },
                  { value: "UP_TO_DATE", label: "Em dia" },
                  { value: "NO_LOAN", label: "Sem Contrato" }
                ].map(badge => (
                  <button
                    key={badge.value}
                    onClick={() => setFilterType(badge.value as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      filterType === badge.value
                        ? "bg-yellow-500 text-zinc-950 border-yellow-500 shadow-[0_2px_8px_rgba(234,179,8,0.2)]"
                        : "bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {badge.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2B. CLIENT LIST RENDER */}
            {filteredClients.length === 0 ? (
              <div className="text-center py-16 bg-zinc-950/30 border border-zinc-850 rounded-2xl p-6">
                <div className="p-4 bg-zinc-900 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3 text-zinc-600">
                  <Search className="w-5 h-5 text-yellow-500" />
                </div>
                <h3 className="font-semibold text-zinc-300 text-sm">Nenhuma cobrança encontrada</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-[280px] mx-auto">
                  Ajuste o termo de pesquisa ou filtros selecionados para localizar registros correspondentes.
                </p>
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-xs font-semibold rounded-lg text-zinc-350 transition-colors cursor-pointer"
                  >
                    Limpar Pesquisa
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredClients.map(clientDetail => (
                  <ClientCard
                    key={clientDetail.activeLoan ? `loan-${clientDetail.activeLoan.id}` : `client-${clientDetail.client.id}`}
                    clientDetail={clientDetail}
                    onRegisterPayment={handleRegisterPayment}
                    onOpenPixModal={(clName) => setPixModal({ isOpen: true, clientName: clName })}
                    onDeleteClient={handleDeleteClient}
                    onEditClient={(clientDetail) => setEditingClient(clientDetail)}
                    onAdjustLoan={handleAdjustLoan}
                    onToggleSunday={handleToggleSunday}
                  />
                ))}
              </div>
            )}
          </div>
        )}


        {/* TAB 3: CONTROLE FINANCEIRO & DEEXPANSÃO PROJECTIONS */}
        {activeTab === "financial_control" && stats && (
          <div className="animate-fade-in space-y-5">
            {/* VOLTAR BUTTON */}
            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setActiveTab("home")}
                className="py-2 px-4 bg-zinc-900 hover:bg-zinc-800 text-yellow-500 font-bold text-xs rounded-xl border border-zinc-850 flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-black/40"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para Tela Inicial</span>
              </button>
            </div>

            <FinancialControl
              clientsWithLoans={clientsWithLoans}
              stats={stats}
              allLoans={allLoans}
              allPayments={allPayments}
            />
          </div>
        )}

        {/* TAB 4: AGENDA INTELIGENTE */}
        {activeTab === "agenda" && (
          <div className="animate-fade-in space-y-5">
            {/* VOLTAR BUTTON */}
            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => setActiveTab("home")}
                className="py-2 px-4 bg-zinc-900 hover:bg-zinc-800 text-yellow-500 font-bold text-xs rounded-xl border border-zinc-850 flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-black/40"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para Tela Inicial</span>
              </button>
            </div>

            <SmartAgenda
              clientsWithLoans={clientsWithLoans}
              allLoans={allLoans}
              allPayments={allPayments}
              simulationDate={simulationDate}
              onAddNewContractForDate={(dateStr) => {
                setAgendaPreSelectedDate(dateStr);
                setShowAddModal(true);
              }}
            />
          </div>
        )}

      </main>

      {/* 5. FOOTER DETAILS AND COPYRIGHT LOGS */}
      <footer className="bg-zinc-950/40 border-t border-zinc-900 py-6 text-center text-xs text-zinc-600 font-mono mt-12 select-none">
        <p>© 2026 Lagos Crédito. Todos os direitos reservados.</p>
        <p className="text-[10px] text-zinc-750 mt-0.5">Dispositivo Independente PWA Fintech Core v2.10.4</p>
      </footer>

      {/* MODAL 1: ADD CLIENT FORM */}
      {showAddModal && (
        <ClientForm
          initialStartDate={agendaPreSelectedDate}
          onClose={() => {
            setShowAddModal(false);
            setAgendaPreSelectedDate(undefined);
          }}
          onSubmit={handleAddNewClient}
        />
      )}

      {/* MODAL 1B: EDIT CLIENT FORM */}
      {editingClient && (
        <ClientForm
          clientToEdit={editingClient}
          onClose={() => setEditingClient(null)}
          onSubmit={handleEditClientSubmit}
        />
      )}

      {/* MODAL 2: PIX BILLING COPYSHEET (Step 4 UI Specifics) */}
      {pixModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/84 backdrop-blur-sm animate-fade-in select-none">
          <div 
            id="pix-drawer-modal"
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-bounce-in"
          >
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-yellow-500/10 text-yellow-500 rounded-lg">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-100 text-xs sm:text-sm">Chave Pix de Cobrança</h4>
                  <p className="text-[10px] text-yellow-500">Enviar para: {pixModal.clientName || "Cliente"}</p>
                </div>
              </div>
              <button
                onClick={() => setPixModal({ isOpen: false, clientName: "" })}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 md:p-6 text-center space-y-4">
              {/* Simulated QR Code Canvas Block */}
              <div className="w-36 h-36 mx-auto bg-zinc-950 border-2 border-yellow-500/20 rounded-xl p-2.5 flex flex-col items-center justify-center relative group">
                <div className="w-full h-full bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col items-center justify-center gap-1.5 text-[10px] text-zinc-650 font-mono">
                  <div className="grid grid-cols-4 gap-1.5 opacity-60">
                    <div className="w-5 h-5 bg-yellow-500 rounded-sm" />
                    <div className="w-5 h-5 bg-zinc-700 rounded-sm" />
                    <div className="w-5 h-5 bg-zinc-700 rounded-sm" />
                    <div className="w-5 h-5 bg-yellow-500 rounded-sm" />
                    <div className="w-5 h-5 bg-zinc-700 rounded-sm" />
                    <div className="w-5 h-5 bg-yellow-500 rounded-sm" />
                    <div className="w-5 h-5 bg-zinc-700 rounded-sm" />
                    <div className="w-5 h-5 bg-zinc-700 rounded-sm" />
                    <div className="w-5 h-5 bg-yellow-500 rounded-sm" />
                    <div className="w-5 h-5 bg-zinc-700 rounded-sm" />
                    <div className="w-5 h-5 bg-yellow-500 rounded-sm" />
                    <div className="w-5 h-5 bg-zinc-700 rounded-sm" />
                  </div>
                  <span className="text-[8px] uppercase tracking-wider text-yellow-500 font-bold mt-1">PIX E-MAIL</span>
                </div>
              </div>

              {/* PIX KEY VALUE HIGHLIGHT */}
              <div className="space-y-1 bg-zinc-950/80 p-3 rounded-xl border border-zinc-800">
                <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-widest">EMAIL CHAVE PIX:</span>
                <span className="font-mono text-zinc-200 text-xs sm:text-sm font-bold block select-all">
                  lagoscelular5@gmail.com
                </span>
              </div>

              {/* ACTION: COPY BUTTON */}
              <button
                onClick={handleCopyPix}
                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  pixCopied 
                    ? "bg-yellow-500 text-zinc-950 shadow-md shadow-yellow-500/10" 
                    : "bg-yellow-550 text-zinc-950 hover:bg-yellow-500 shadow-md shadow-yellow-500/5 hover:-translate-y-0.5"
                }`}
              >
                {pixCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copiado com Sucesso!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar Email Chave Pix
                  </>
                )}
              </button>

              {/* INSTRUCTIONAL SUBSTEPS - Step 4 Exact layout */}
              <div className="text-[11px] text-zinc-500 text-left space-y-2 pt-3 border-t border-zinc-800/60 leading-relaxed">
                <p className="font-bold text-yellow-500 text-center mb-1 bg-yellow-500/5 py-1 rounded">
                  💡 Instruções de Pagamento
                </p>
                <div className="space-y-1">
                  <p>1. Copie o email no botão amarelo.</p>
                  <p>2. Vá no seu banco na aba Pix E-mail.</p>
                  <p>3. Cole a chave.</p>
                  <p>4. Confirme o valor.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DISPOSITIVO PWA INSTALLATION USER GUIDE */}
      {showPwaGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/84 backdrop-blur-sm animate-fade-in select-none">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-bounce-in">
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 flex justify-between items-center">
              <div className="flex items-center gap-2 text-yellow-500">
                <Smartphone className="w-4 h-4 text-yellow-500" />
                <h4 className="font-bold text-zinc-100 text-sm">Como instalar no Celular?</h4>
              </div>
              <button
                onClick={() => setShowPwaGuide(false)}
                className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 md:p-6 space-y-4">
              <p className="text-xs text-zinc-400 leading-relaxed text-center">
                Este sistema foi modelado como um <strong className="text-zinc-200">Progressive Web App (PWA)</strong>, podendo ser instalado diretamente no seu smartphone.
              </p>

              {/* iOS Safari instructions */}
              <div className="p-3 bg-zinc-950/40 border border-zinc-800 rounded-xl space-y-1.5">
                <span className="text-[10px] font-extrabold text-yellow-500 uppercase tracking-widest block">No iPhone (Safari):</span>
                <p className="text-xs text-zinc-300">
                  1. Abra a página do app no seu navegador Safari.<br />
                  2. Toque no botão de <strong className="text-zinc-200">Compartilhar</strong> (ícone de caixinha com seta para cima).<br />
                  3. Role as opções e clique em <strong className="text-zinc-100">Adicionar à Tela de Início</strong>.<br />
                  4. Confirme para criar o ícone no seu celular!
                </p>
              </div>

              {/* Android Chrome instructions */}
              <div className="p-3 bg-zinc-950/40 border border-zinc-800 rounded-xl space-y-1.5">
                <span className="text-[10px] font-extrabold text-yellow-500 uppercase tracking-widest block">No Android (Chrome):</span>
                <p className="text-xs text-zinc-300">
                  1. Abra a página do app no Chrome do celular.<br />
                  2. Toque no menu de <strong className="text-zinc-200">três pontinhos</strong> no canto superior direito.<br />
                  3. Toque em <strong className="text-zinc-100">Instalar aplicativo</strong> ou <strong className="text-zinc-100">Adicionar à tela inicial</strong>.<br />
                  4. Confirme clicando em instalar.
                </p>
              </div>

              <button
                onClick={() => setShowPwaGuide(false)}
                className="w-full py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-zinc-950 rounded-xl font-black text-xs transition-colors cursor-pointer"
              >
                Entendi, fechar tutorial
              </button>
            </div>
          </div>
        </div>
       )}

      {/* MODAL 4: SUPABASE CLOUD DATABASE SYNC USER GUIDE */}
      {showDbGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/84 backdrop-blur-sm animate-fade-in select-none">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-bounce-in">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 text-yellow-500">
                <Server className="w-4 h-4 text-yellow-500" />
                <h4 className="font-extrabold text-zinc-100 text-sm">Acessar de Qualquer Celular (Sincronização Nuvem)</h4>
              </div>
              <button
                onClick={() => {
                  setShowDbGuide(false);
                  setSqlCopied(false);
                }}
                className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

             {/* Scrollable Content */}
            <div className="p-5 md:p-6 space-y-4 overflow-y-auto scrollbar-thin text-xs text-zinc-350 leading-relaxed font-sans">
              <p className="text-center text-zinc-400 text-[11px] font-sans">
                Atualmente seus dados ficam gravados apenas na memória de dados temporária <strong>deste aparelho</strong>. Para sincronizar em tempo real e acessar de qualquer telefone, você precisa conectar o banco gratuito <strong className="text-yellow-500">Supabase</strong>.
              </p>

              {/* REAL-TIME SUPABASE CONNECTION DIAGNOSTICS */}
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3 font-sans">
                <div className="flex items-center justify-between border-b border-zinc-850 pb-2 font-sans">
                  <div className="flex items-center gap-1.5 font-sans">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse shrink-0" />
                    <span className="font-extrabold text-[11px] uppercase tracking-wider text-zinc-100 font-sans">Painel de Diagnóstico em Tempo Real</span>
                  </div>
                  <button
                    type="button"
                    onClick={runDiagnostics}
                    disabled={isTestingDiag}
                    className="text-[10px] text-yellow-500 font-extrabold uppercase hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {isTestingDiag ? "Testando..." : "Testar Conexão"}
                  </button>
                </div>

                {diagnostics ? (
                  <div className="space-y-2 text-[11px] font-sans">
                    <div className="grid grid-cols-3 gap-2 border-b border-zinc-900/60 pb-2">
                      <span className="text-zinc-500 font-medium">Detector URL:</span>
                      <span className="col-span-2 font-mono text-zinc-300 select-all font-bold">
                        {diagnostics.maskedUrl}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-b border-zinc-900/60 pb-2">
                      <span className="text-zinc-500 font-medium">Detector Chave:</span>
                      <span className="col-span-2 font-mono text-zinc-300 select-all">
                        {diagnostics.maskedKey}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-b border-zinc-900/60 pb-2">
                      <span className="text-zinc-500 font-medium">Status Config:</span>
                      <span className={`col-span-2 font-bold ${diagnostics.isConfigured ? "text-emerald-400" : "text-amber-400"}`}>
                        {diagnostics.isConfigured ? "🟢 Válido (Vite detectou as chaves)" : "⚠️ Inválido / Vazio (Não detectado)"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg border text-[10px] mt-2 leading-relaxed space-y-1 bg-zinc-900/40 border-zinc-850">
                      <span className="font-extrabold text-zinc-300 block uppercase tracking-wider text-[9px]">Resultado do Teste de Comunicação:</span>
                      <p className={`font-medium ${diagnostics.pingResult.success ? "text-emerald-400" : "text-yellow-400"}`}>
                        {diagnostics.pingResult.success ? "🟢 SUCESSO:" : "⚠️ FALHOU:"} {diagnostics.pingResult.message}
                      </p>
                      
                      {!diagnostics.pingResult.success && diagnostics.isConfigured && (
                        <div className="text-zinc-400 font-sans mt-2 pt-1 border-t border-zinc-800 text-[10px] space-y-1">
                          <strong className="text-red-400 text-[9px] block uppercase">Como corrigir este erro:</strong>
                          {diagnostics.pingResult.code === "PGRST125" ? (
                            <span>
                              <strong>Erro de Caminho Desconhecido (PGRST125):</strong> Isto ocorre porque a URL do Supabase está mal configurada nas suas credenciais (ex: tem caminhos extras ou falta o ".supabase.co") ou porque suas tabelas não foram criadas ou estão incorretas. Verifique sua chave <strong>VITE_SUPABASE_URL</strong>.
                            </span>
                          ) : diagnostics.pingResult.message.includes("relation") || diagnostics.pingResult.message.includes("does not exist") ? (
                            <span>
                              <strong>Tabelas não encontradas no banco:</strong> Suas credenciais estão corretas, mas você esqueceu de criar as tabelas! Copie o script SQL do <strong>Passo 2</strong> abaixo, vá no <strong className="text-zinc-200">SQL Editor</strong> do seu Supabase, cole e clique em <strong>Run</strong>.
                            </span>
                          ) : diagnostics.pingResult.message.includes("API key") || diagnostics.pingResult.code === "PGRST111" || diagnostics.pingResult.message.includes("Invalid API key") ? (
                            <span>
                              <strong>Autenticação Falhou (Chave Inválida):</strong> Sua chave anônima (anon key) está com caracteres incorretos, espaços ou aspas sobrando. Substitua-a no Passo 3.
                            </span>
                          ) : (
                            <span>
                              Se você acabou de configurar as variáveis de ambiente na barra superior, por favor **reinicie a página ou limpe o cache**, pois o Vite precisa de um pequeno momento para recarregar as novas variáveis na memória local.
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-zinc-500 italic text-[11px] text-center">Carregando diagnóstico do banco de dados...</p>
                )}
              </div>

              {/* Step 1 */}
              <div className="p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-xl space-y-1.5">
                <span className="text-[10px] font-extrabold text-yellow-500 uppercase tracking-widest block font-sans">Passo 1: Criar conta grátis no Supabase</span>
                <p className="text-zinc-350 font-sans">
                  1. Acesse o site <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-yellow-550 underline font-bold">supabase.com</a> e faça login (pode usar sua conta do GitHub).<br />
                  2. Clique em <strong className="text-zinc-200">New Project</strong>, dê um nome para o seu projeto (ex: <code className="bg-zinc-900 text-zinc-200 px-1 py-0.5 rounded text-[10px] font-mono">LagosCredit</code>) e defina uma senha do banco.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-xl space-y-2">
                <span className="text-[10px] font-extrabold text-yellow-500 uppercase tracking-widest block font-mono">Passo 2: Criar as tabelas (SQL Editor)</span>
                <p className="text-zinc-300 font-sans">
                  No painel esquerdo do Supabase, clique em <strong className="text-zinc-100 font-sans">SQL Editor</strong>, clique em <strong className="text-zinc-100 font-sans">New Query</strong>, cole o texto abaixo e clique no botão verde <strong className="text-emerald-400 font-sans">Run</strong>:
                </p>

                {/* SQL scripts copying */}
                <div className="relative font-mono bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 text-[9px] text-zinc-200 max-h-32 overflow-y-auto select-text scrollbar-thin">
                  <pre className="whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    payment_date TEXT NOT NULL,
    reference_date TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir select para todos" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Permitir insert para todos" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update para todos" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Permitir delete para todos" ON public.clients FOR DELETE USING (true);

CREATE POLICY "Permitir select para todos" ON public.loans FOR SELECT USING (true);
CREATE POLICY "Permitir insert para todos" ON public.loans FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update para todos" ON public.loans FOR UPDATE USING (true);
CREATE POLICY "Permitir delete para todos" ON public.loans FOR DELETE USING (true);

CREATE POLICY "Permitir select para todos" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Permitir insert para todos" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update para todos" ON public.payments FOR UPDATE USING (true);
CREATE POLICY "Permitir delete para todos" ON public.payments FOR DELETE USING (true);`}</pre>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const sqlCode = `CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    payment_date TEXT NOT NULL,
    reference_date TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir select para todos" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Permitir insert para todos" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update para todos" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Permitir delete para todos" ON public.clients FOR DELETE USING (true);

CREATE POLICY "Permitir select para todos" ON public.loans FOR SELECT USING (true);
CREATE POLICY "Permitir insert para todos" ON public.loans FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update para todos" ON public.loans FOR UPDATE USING (true);
CREATE POLICY "Permitir delete para todos" ON public.loans FOR DELETE USING (true);

CREATE POLICY "Permitir select para todos" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Permitir insert para todos" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update para todos" ON public.payments FOR UPDATE USING (true);
CREATE POLICY "Permitir delete para todos" ON public.payments FOR DELETE USING (true);`;
                    navigator.clipboard.writeText(sqlCode);
                    setSqlCopied(true);
                    setTimeout(() => setSqlCopied(false), 2000);
                  }}
                  className="w-full py-2 bg-zinc-950 border border-zinc-800 hover:bg-zinc-90 w text-yellow-500 font-extrabold text-[10px] uppercase rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sans"
                >
                  {sqlCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{sqlCopied ? "Copiado com Sucesso!" : "Copiar Script SQL do Banco"}</span>
                </button>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-xl space-y-1.5">
                <span className="text-[10px] font-extrabold text-yellow-500 uppercase tracking-widest block font-sans">Passo 3: Configurar na Barra Superior do AI Studio</span>
                <p className="text-zinc-300 font-sans">
                  1. No menu esquerdo do Supabase, vá na engrenagem (<strong className="text-zinc-100">Project Settings</strong>) &gt; <strong className="text-zinc-100">API</strong>.<br />
                  2. Copie a <strong className="text-yellow-500">Project URL</strong> e a chave <strong className="text-yellow-500">anon public key</strong>.<br />
                  3. Clique no ícone de engrenagem (<strong className="text-zinc-100 font-sans">Settings</strong>) na barra superior ou configurações desta página do AI Studio (Secrets/Environment Variables).<br />
                  4. Cadastre os seguintes nomes com seus respectivos valores e salve:<br />
                  <code className="bg-black/40 text-zinc-100 px-1 py-0.5 rounded text-[10px] font-mono block mt-1.5 p-1 text-center border border-zinc-900 select-all">
                    VITE_SUPABASE_URL = (sua URL)<br />
                    VITE_SUPABASE_ANON_KEY = (sua chave anon)
                  </code>
                </p>
              </div>

              <div className="p-2.5 bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 rounded-xl flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                <p className="text-[10px] font-serif italic text-zinc-300">
                  Assim que as chaves forem registradas nas configurações, o sistema fará a conexão instantânea de forma 100% segura. Você e sua equipe poderão acessar, sincronizar e atualizar dados de qualquer celular ao mesmo tempo!
                </p>
              </div>

              <button
                onClick={() => {
                  setShowDbGuide(false);
                  setSqlCopied(false);
                }}
                className="w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:scale-[1.01] text-zinc-950 rounded-xl font-black text-xs transition-transform cursor-pointer shadow-lg shadow-yellow-500/10 font-sans"
              >
                Entendi, fechar tutorial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK COLLECT LIST MODAL */}
      <QuickCollectModal
        isOpen={showQuickCollectModal}
        onClose={() => setShowQuickCollectModal(false)}
        clientsWithLoans={clientsWithLoans}
      />

    </div>
  );
}
