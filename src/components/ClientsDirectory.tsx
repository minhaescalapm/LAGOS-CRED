import React, { useState, useEffect } from "react";
import { Client, Loan, Payment, ClientWithLoanDetails } from "../types";
import { dbService } from "../services/dbService";
import { formatFriendlyDate, getTodayStr, addDays } from "../utils/dateUtils";
import { 
  Users, 
  Search, 
  DollarSign, 
  CalendarDays, 
  Eye, 
  Phone, 
  MessageSquare,
  FileText, 
  ChevronRight, 
  ArrowLeft, 
  User, 
  Percent, 
  Coins, 
  HelpCircle,
  Clock,
  CheckCircle2,
  Trash2,
  Pencil,
  Sparkles,
  RefreshCw,
  FolderOpen
} from "lucide-react";

interface ClientsDirectoryProps {
  clientsWithLoans: ClientWithLoanDetails[];
  simulationDate: string;
  onRefresh: () => void;
  onEditClient: (clientDetail: ClientWithLoanDetails) => void;
  onDeleteClient: (clientId: string) => void;
}

export const ClientsDirectory: React.FC<ClientsDirectoryProps> = ({
  clientsWithLoans,
  simulationDate,
  onRefresh,
  onEditClient,
  onDeleteClient
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset confirm state when active client changes
  useEffect(() => {
    setShowDeleteConfirm(false);
  }, [selectedClientId]);

  // Expanded client state triggers
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);

  // Fetch complete dataset on load/refresh to compile absolute histories
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const [loans, payments] = await Promise.all([
          dbService.getLoans(),
          dbService.getPayments()
        ]);
        setAllLoans(loans);
        setAllPayments(payments);
      } catch (err) {
        console.error("Erro ao carregar histórico absoluto para aba de clientes:", err);
      }
    };
    fetchHistory();
  }, [clientsWithLoans, simulationDate]);

  // Formatter helpers
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  const formatPhone = (ph: string) => {
    const raw = ph.replace(/\D/g, "");
    if (raw.length === 11) {
      return `(${raw.substring(0, 2)}) ${raw.substring(2, 7)}-${raw.substring(7)}`;
    }
    if (raw.length === 10) {
      return `(${raw.substring(0, 2)}) ${raw.substring(2, 6)}-${raw.substring(6)}`;
    }
    return ph;
  };

  const sendWhatsAppDirect = (client: Client, message: string) => {
    const sanitizedPhone = `55${client.phone.replace(/\D/g, "")}`;
    const url = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  // Compile full profile statistics for any client
  const getClientAbsoluteStats = (clientId: string) => {
    const clientLoans = allLoans.filter(l => l.clientId === clientId);
    const loanIds = clientLoans.map(l => l.id);
    const clientPayments = allPayments.filter(p => loanIds.includes(p.loanId));

    const totalBorrowed = clientLoans.reduce((sum, l) => sum + l.amountInvested, 0);
    const totalExpected = clientLoans.reduce((sum, l) => sum + l.totalAmount, 0);
    const totalPaid = clientPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // Check if there's an active contract
    const currentDetail = clientsWithLoans.find(c => c.client.id === clientId);
    const activeLoan = currentDetail?.activeLoan || null;

    return {
      loansCount: clientLoans.length,
      totalBorrowed,
      totalExpected,
      totalPaid,
      activeLoan,
      allClientLoans: clientLoans.sort((a, b) => b.startDate.localeCompare(a.startDate)),
      allClientPayments: clientPayments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
    };
  };

  // Search filter
  const filteredClients = clientsWithLoans.filter(item => {
    const match = item.client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  item.client.phone.includes(searchTerm);
    return match;
  });

  const selectedClientDetail = clientsWithLoans.find(c => c.client.id === selectedClientId);
  const selectedStats = selectedClientId ? getClientAbsoluteStats(selectedClientId) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 select-none">
      
      {/* LEFT COLUMN: CLIENT LIST WITH ACCORDION SELECTION ACTION */}
      <div className={`lg:col-span- ${selectedClientId ? "lg:col-span-5" : "lg:col-span-12"} space-y-4`}>
        <div className="bg-zinc-950/40 border border-zinc-850 rounded-2xl p-4 md:p-5 space-y-4">
          <div className="flex justify-between items-center bg-zinc-950/20 py-1.5 px-3 rounded-xl border border-zinc-900">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-sm text-zinc-100">Fichas de Clientes Cadastrados</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">Total: {filteredClients.length} cadastrados</span>
          </div>

          {/* Search bar specifically for clients directory layout */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar cliente por nome ou celular..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800/80 focus:border-amber-400 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-xs text-zinc-100 placeholder-zinc-650 transition-colors"
            />
          </div>

          <div className="divide-y divide-zinc-900 max-h-[580px] overflow-y-auto pr-1">
            {filteredClients.length === 0 ? (
              <div className="text-center py-10">
                <FolderOpen className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-500 font-mono">Nenhum cliente registrado encontrado.</p>
              </div>
            ) : (
              filteredClients.map(item => {
                const isSelected = selectedClientId === item.client.id;
                const stats = getClientAbsoluteStats(item.client.id);
                const hasActive = !!stats.activeLoan;

                // status badge helper
                let statusLabel = "Sem Contrato";
                let statusColor = "bg-zinc-900 border-zinc-800 text-zinc-400";
                if (hasActive) {
                  if (item.isDelayed) {
                    statusLabel = `Atrasado: ${item.daysBehind}x`;
                    statusColor = "bg-amber-950/40 border-amber-900/30 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.05)]";
                  } else if (item.paidCount >= item.totalDays) {
                    statusLabel = "Quitado";
                    statusColor = "bg-green-950/40 border-green-900/30 text-green-400";
                  } else {
                    statusLabel = "Em Dia";
                    statusColor = "bg-yellow-500/10 border-yellow-500/20 text-amber-400";
                  }
                }

                return (
                  <div
                    key={item.activeLoan ? `directory-loan-${item.activeLoan.id}` : `directory-client-${item.client.id}`}
                    onClick={() => setSelectedClientId(item.client.id === selectedClientId ? null : item.client.id)}
                    className={`p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      isSelected 
                        ? "bg-zinc-900/80 border-l-4 border-amber-400 text-zinc-100" 
                        : "hover:bg-zinc-900/40 text-zinc-300"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <span className="font-bold text-xs sm:text-sm truncate block">{item.client.name}</span>
                        <span className={`text-[9px] uppercase px-2 py-0.5 rounded border ${statusColor} font-mono font-bold shrink-0`}>
                          {statusLabel}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-550">
                        <span>Tel: {formatPhone(item.client.phone)}</span>
                        <span className="text-zinc-700">•</span>
                        <span>Contratos: <strong className="text-zinc-300 font-bold">{stats.loansCount}</strong></span>
                        <span className="text-zinc-700">•</span>
                        <span className="text-amber-400/80">Histórico: <strong>{formatBRL(stats.totalBorrowed)}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const message = `Olá ${item.client.name}, tudo bem? Lagos Crédito entrando em contato para saber se gostaria de solicitar um empréstimo ou renovar seu limite conosco.`;
                          sendWhatsAppDirect(item.client, message);
                        }}
                        className="p-1.5 bg-zinc-900 hover:bg-zinc-850 hover:text-green-400 text-zinc-400 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
                        title="Desejar bom dia ou enviar oferta de renegociação"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      
                      <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${isSelected ? "rotate-90 text-amber-400" : ""}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: DETAILED PROFILE VIEW (LOANS HISTORY & TIMELINE RECOV) */}
      {selectedClientId && selectedClientDetail && selectedStats && (
        <div className="lg:col-span-7 space-y-4 animate-fade-in">
          
          <div className="bg-zinc-950/40 border border-zinc-850 rounded-2xl p-5 sm:p-6 space-y-6">
            
            {/* Header profile label with quick action edits */}
            <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-400 text-zinc-900 rounded-xl flex items-center justify-center font-black text-lg shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                  <User className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-md md:text-lg text-zinc-100 tracking-tight">{selectedClientDetail.client.name}</h3>
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-amber-400/80" />
                    <span>WhatsApp: {formatPhone(selectedClientDetail.client.phone)}</span>
                  </p>
                </div>
              </div>

              {/* Direct editing actions cascade */}
              <div className="flex items-center gap-2">
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-500/30 rounded-xl p-1 px-2.5 select-none shrink-0">
                    <span className="text-[10px] text-red-400 font-extrabold uppercase mr-1.5">Apagar permanentemente?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteClient(selectedClientDetail.client.id);
                        setSelectedClientId(null);
                        setShowDeleteConfirm(false);
                      }}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-550 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer shadow-md shadow-red-900/20"
                    >
                      Sim, Apagar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-350 font-extrabold text-[10px] rounded-lg transition-all cursor-pointer"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onEditClient(selectedClientDetail)}
                      className="p-2 bg-zinc-900 hover:bg-zinc-800 text-yellow-500 rounded-xl border border-zinc-800 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                      title="Editar dados gerais do cliente ou contrato"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Editar Perfil</span>
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="p-2 bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-950 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                      title="Remover cliente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Excluir</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* MATRIX OF STATISTICS FOR HISTORIC BORROWING ANALYSIS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              
              {/* Box 1: Total empréstimos */}
              <div className="bg-zinc-900/40 border border-zinc-850 p-3 rounded-xl space-y-1">
                <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider font-mono">Contratos Cadastrados</span>
                <span className="text-base sm:text-lg font-black text-zinc-200 font-mono flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-400" />
                  {selectedStats.loansCount}
                </span>
              </div>

              {/* Box 2: Total borrowed (Value pegou emprestado) */}
              <div className="bg-zinc-900/40 border border-zinc-850 p-3 rounded-xl space-y-1">
                <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider font-mono">Total Capital Emprestado</span>
                <span className="text-base sm:text-lg font-black text-zinc-100 font-mono block tracking-tight">
                  {formatBRL(selectedStats.totalBorrowed)}
                </span>
              </div>

              {/* Box 3: Total Retorno Esperado */}
              <div className="bg-zinc-900/40 border border-zinc-850 p-3 rounded-xl space-y-1">
                <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider font-mono">Total Retorno Contratado</span>
                <span className="text-base sm:text-lg font-bold text-emerald-400/90 font-mono block tracking-tight">
                  {formatBRL(selectedStats.totalExpected)}
                </span>
              </div>

              {/* Box 4: Total Recompensado */}
              <div className="bg-zinc-900/40 border border-zinc-850 p-3 rounded-xl space-y-1">
                <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-wider font-mono">Total Pago / Amortizado</span>
                <span className="text-base sm:text-lg font-bold text-amber-400 font-mono block tracking-tight">
                  {formatBRL(selectedStats.totalPaid)}
                </span>
              </div>

            </div>

            {/* DADOS ADICIONAIS DE COBRANÇA ATUAL SE EXISTENTE */}
            {selectedStats.activeLoan ? (
              <div className="bg-zinc-950/70 border border-zinc-850 p-4 rounded-xl space-y-3.5 shadow-md">
                <div className="flex justify-between items-center select-none border-b border-zinc-900 pb-2">
                  <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider block font-sans">Contrato Ativo em Andamento</span>
                  <span className="text-[10px] font-mono text-zinc-500">Início: {formatFriendlyDate(selectedStats.activeLoan.startDate)}</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase font-bold">Investido neste:</span>
                    <strong className="text-zinc-300 text-sm">{formatBRL(selectedStats.activeLoan.amountInvested)}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase font-bold">Valor Diária:</span>
                    <strong className="text-amber-400 text-sm">{formatBRL(selectedStats.activeLoan.dailyRate)}/dia</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase font-bold">Prazo Contrato:</span>
                    <strong className="text-zinc-300 text-sm">{selectedStats.activeLoan.totalDays} dias diários</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[9px] uppercase font-bold">Valor de Quitação:</span>
                    <strong className="text-emerald-400 text-sm">{formatBRL(selectedStats.activeLoan.totalAmount)}</strong>
                  </div>
                </div>

                {/* Progress ratio indicators */}
                <div className="space-y-1.5 select-none pt-2">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-zinc-500">Parcelas pagas: <strong className="text-zinc-350">{selectedClientDetail.paidCount} de {selectedClientDetail.totalDays} dias</strong></span>
                    <span className="text-amber-400 font-bold">{Math.round((selectedClientDetail.paidCount / selectedClientDetail.totalDays) * 100)}% concluído</span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-amber-400 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${(selectedClientDetail.paidCount / selectedClientDetail.totalDays) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950/20 border border-zinc-850 border-dashed rounded-xl p-4 text-center select-none font-mono">
                <Clock className="w-5 h-5 text-zinc-650 mx-auto mb-1" />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Nenhum Contrato Ativo Registrado</span>
                <p className="text-[10px] text-zinc-600 mt-1">Este cliente não possui nenhuma fatura ou empréstimo pendente em aberto.</p>
              </div>
            )}

            {/* COLLAPSIBLE TAB OF ALL CONTRACTS REGISTERED IN THEIR HISTORY - Meets values borrowed requirement */}
            <div className="space-y-2 select-none">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block font-sans">Histórico Geral de Empréstimos Solicitados (Valores Borrowed)</span>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-400 font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[9px] text-zinc-500 font-bold uppercase">
                      <th className="py-2">Data Inicial</th>
                      <th className="py-2">Capital Emprestado</th>
                      <th className="py-2">Valor Total</th>
                      <th className="py-2 font-center">Diária/Prazo</th>
                      <th className="py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {selectedStats.allClientLoans.map((loan, idx) => {
                      const loanPaymentsCount = allPayments.filter(p => p.loanId === loan.id).length;
                      const isQuit = loanPaymentsCount >= loan.totalDays;

                      return (
                        <tr key={loan.id} className="hover:bg-zinc-900/30 transition-colors">
                          <td className="py-2">{formatFriendlyDate(loan.startDate)}</td>
                          <td className="py-2 text-zinc-250 font-bold">{formatBRL(loan.amountInvested)}</td>
                          <td className="py-2 text-emerald-400/90">{formatBRL(loan.totalAmount)}</td>
                          <td className="py-2">{formatBRL(loan.dailyRate)}/{loan.totalDays}d</td>
                          <td className="py-2 text-right">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${isQuit ? "bg-green-950/40 text-green-400" : "bg-amber-400/10 text-amber-400"}`}>
                              {isQuit ? "Quitado" : "Pendente"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DETAILED REPAYMENT LISTING HISTORY FOR ACCOUNTABILITY */}
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block font-sans select-none">Linha do Tempo de Repasses / Diárias Pagas ({selectedStats.allClientPayments.length})</span>
              
              {selectedStats.allClientPayments.length === 0 ? (
                <div className="text-center py-6 bg-zinc-900/20 rounded-xl border border-dashed border-zinc-850">
                  <span className="text-[10px] text-zinc-650 font-mono uppercase block font-bold">Nenhuma parcela paga registrada</span>
                </div>
              ) : (
                <div className="max-h-[180px] overflow-y-auto space-y-1.5 pr-1 font-mono">
                  {selectedStats.allClientPayments.map((pay, pIdx) => (
                    <div 
                      key={pay.id} 
                      className="p-2.5 bg-zinc-900/30 hover:bg-zinc-900/50 rounded-xl border border-zinc-850/40 flex items-center justify-between text-[11px] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <div>
                          <span>Parcela paga de <strong className="text-zinc-200">{formatBRL(pay.amount)}</strong></span>
                          <span className="text-[10px] text-zinc-500 block">Cobriu data operacional de diária: {formatFriendlyDate(pay.referenceDate)}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-bold shrink-0">{formatFriendlyDate(pay.paymentDate)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
