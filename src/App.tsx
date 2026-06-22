import React, { useState, useEffect } from "react";
import { dbService } from "./services/dbService";
import { ClientWithLoanDetails, FinancialStats, Loan, Payment } from "./types";
import { getTodayStr, formatFriendlyDate } from "./utils/dateUtils";
import { FinancialSummary } from "./components/FinancialSummary";
import { StatsSection } from "./components/StatsSection";
import { AlertsSection } from "./components/AlertsSection";
import { ClientForm } from "./components/ClientForm";
import { ClientCard } from "./components/ClientCard";
import { ClientsDirectory } from "./components/ClientsDirectory";
import { FinancialControl } from "./components/FinancialControl";
import { QuickCollectModal } from "./components/QuickCollectModal";
import { SupabaseSetupHelper } from "./components/SupabaseSetupHelper";
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
  Database,
  Server
} from "lucide-react";

export default function App() {
  const [simulationDate, setSimulationDate] = useState(() => getTodayStr());
  const [clientsWithLoans, setClientsWithLoans] = useState<ClientWithLoanDetails[]>([]);
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<"home" | "collections" | "add_client" | "financial_control">("home");
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
  const [showQuickCollectModal, setShowQuickCollectModal] = useState(false);

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
  }) => {
    setIsLoading(true);
    try {
      const newClient = await dbService.addClient(data.name, data.phone);
      await dbService.addLoan(
        newClient.id,
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
              onClick={() => setActiveTab("add_client")}
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
        
        {/* SMALL ALERT BANNER FOR IFRAME CONTEXT */}
        <div className="bg-zinc-950/40 border border-zinc-800/80 p-3 rounded-2xl flex items-center justify-between gap-3 text-[11px] text-zinc-400 select-none">
          <div className="flex items-center gap-2.5">
            <Info className="w-4.5 h-4.5 text-yellow-500 shrink-0" />
            <p className="leading-normal">
              Controle ativo operando em horário oficial dia do sistema: <strong className="text-zinc-200 font-mono">{formatFriendlyDate(simulationDate)}</strong>. Todas as movimentações salvam automaticamente.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-900/60 px-2.5 py-1 rounded-lg border border-zinc-850">
            <span className={`w-1.5 h-1.5 rounded-full ${dbService.isUsingSupabase() ? "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]" : "bg-zinc-650"} animate-pulse`} />
            <span className="text-[9px] uppercase font-bold text-zinc-450 tracking-wider font-sans">
              {dbService.isUsingSupabase() ? "Supabase Conectado" : "Local Database"}
            </span>
          </div>
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
            <span className="hidden xs:inline">Tela Inicial</span>
            <span className="xs:hidden">Início</span>
          </button>

          <button
            onClick={() => setActiveTab("collections")}
            className={`py-3 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "collections"
                ? "bg-gradient-to-b from-zinc-850 to-zinc-900/40 text-yellow-500 border border-zinc-800/60 shadow-inner"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Sessão rápida para cobrança de diárias no WhatsApp"
          >
            <Coins className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="hidden xs:inline">Cobranças Ativas</span>
            <span className="xs:hidden">Cobranças</span>
          </button>

          <button
            onClick={() => setActiveTab("add_client")}
            className={`py-3 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "add_client"
                ? "bg-gradient-to-b from-zinc-850 to-zinc-900/40 text-yellow-500 border border-zinc-800/60 shadow-inner"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Users className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="hidden xs:inline">Cadastrar Cliente</span>
            <span className="xs:hidden">Cadastrar</span>
          </button>

          <button
            onClick={() => setActiveTab("financial_control")}
            className={`py-3 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "financial_control"
                ? "bg-gradient-to-b from-zinc-850 to-zinc-900/40 text-yellow-500 border border-zinc-800/60 shadow-inner"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="hidden xs:inline">Controle Financeiro</span>
            <span className="xs:hidden">Financeiro</span>
          </button>
        </div>

        {/* TELA INICIAL (Dashboard & Supabase SQL Integration Helper) */}
        {activeTab === "home" && (
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
                  Painel unificado para monitoramento de parcelas diárias, cadastro ágil de clientes e controle estatístico detalhado de caixa. O sistema está preparado para armazenamento em nuvem no Supabase com redundância em tempo real.
                </p>
              </div>
            </div>

            {/* Atalhos Rápidos Premium */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-450 mb-3 block">Ações Principais da Carteira</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Atalho 1: Cobranças */}
                <button
                  type="button"
                  onClick={() => setActiveTab("collections")}
                  className="group block text-left bg-zinc-900/40 hover:bg-zinc-850/60 border border-zinc-850/80 hover:border-yellow-500/40 p-5 rounded-2xl transition-all shadow-md hover:shadow-yellow-500/5 cursor-pointer relative"
                >
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center text-yellow-500 mb-4 transition-all group-hover:scale-110">
                    <Coins className="w-5 h-5 text-yellow-500" />
                  </div>
                  <h4 className="font-extrabold text-white text-sm group-hover:text-yellow-500 transition-colors">
                    Balcão de Cobranças →
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Cobrar diárias ativas, agrupar faturas pendentes e registrar pagamentos rápidos via WhatsApp.
                  </p>
                </button>

                {/* Atalho 2: Cadastrar */}
                <button
                  type="button"
                  onClick={() => setActiveTab("add_client")}
                  className="group block text-left bg-zinc-900/40 hover:bg-zinc-850/60 border border-zinc-850/80 hover:border-yellow-500/40 p-5 rounded-2xl transition-all shadow-md hover:shadow-yellow-500/5 cursor-pointer relative"
                >
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center text-yellow-500 mb-4 transition-all group-hover:scale-110">
                    <Users className="w-5 h-5 text-yellow-500" />
                  </div>
                  <h4 className="font-extrabold text-white text-sm group-hover:text-yellow-500 transition-colors">
                    Ficha de Novo Cliente →
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Iniciar um microcrédito e criar um contrato parametrizado com diárias automáticas.
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
                    Controle de Caixa →
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Ver balanços, relatórios, ciclos fiscais de domingo a domingo e gráficos analíticos de lucros.
                  </p>
                </button>
              </div>
            </div>

            {/* SEÇÃO INTEGRATIVE SUPABASE PLATFORM INSTRUCTION */}
            <SupabaseSetupHelper />
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
                    placeholder="Pesquisar cobrança por nome ou WhatsApp..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-950/60 border border-zinc-800/80 focus:border-yellow-500 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-650 transition-colors"
                  />
                </div>
                <button
                  onClick={() => setShowQuickCollectModal(true)}
                  className="px-4 py-2.5 bg-yellow-500 hover:bg-yellow-405 text-zinc-950 font-black text-xs rounded-xl shadow-lg shadow-yellow-500/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4 text-zinc-950" />
                  Cobrança Rápida (Todos)
                </button>
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
                    key={clientDetail.client.id}
                    clientDetail={clientDetail}
                    onRegisterPayment={handleRegisterPayment}
                    onOpenPixModal={(clName) => setPixModal({ isOpen: true, clientName: clName })}
                    onDeleteClient={handleDeleteClient}
                    onEditClient={(clientDetail) => setEditingClient(clientDetail)}
                    onAdjustLoan={handleAdjustLoan}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CADASTRAR CLIENTE (Embedded Premium Tab Form) */}
        {activeTab === "add_client" && (
          <div className="max-w-xl mx-auto space-y-5 animate-fade-in">
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

            <div className="bg-zinc-950/20 border border-zinc-850/80 p-5 sm:p-6 rounded-2xl">
              <div className="flex items-center gap-2 pb-4 mb-4 border-b border-zinc-900 select-none">
                <Users className="w-5 h-5 text-yellow-500" />
                <div>
                  <h3 className="font-extrabold text-xs sm:text-sm text-zinc-100 uppercase tracking-wider">Ficha de Cadastro de Cliente</h3>
                  <p className="text-[10px] text-zinc-500">Configure os parâmetros do contrato de diárias de forma instantânea.</p>
                </div>
              </div>
              <ClientForm
                isEmbeddedInTab={true}
                onSubmit={async (data) => {
                  await handleAddNewClient(data);
                  setActiveTab("collections"); // Auto redirect to Active collection desk
                }}
              />
            </div>
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

      </main>

      {/* 5. FOOTER DETAILS AND COPYRIGHT LOGS */}
      <footer className="bg-zinc-950/40 border-t border-zinc-900 py-6 text-center text-xs text-zinc-600 font-mono mt-12 select-none">
        <p>© 2026 Lagos Crédito. Todos os direitos reservados.</p>
        <p className="text-[10px] text-zinc-750 mt-0.5">Dispositivo Independente PWA Fintech Core v2.10.4</p>
      </footer>

      {/* MODAL 1: ADD CLIENT FORM */}
      {showAddModal && (
        <ClientForm
          onClose={() => setShowAddModal(false)}
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

      {/* QUICK COLLECT LIST MODAL */}
      <QuickCollectModal
        isOpen={showQuickCollectModal}
        onClose={() => setShowQuickCollectModal(false)}
        clientsWithLoans={clientsWithLoans}
      />

    </div>
  );
}
