import React, { useState } from "react";
import { ClientWithLoanDetails, Loan, Payment } from "../types";
import { Trash2, ArrowLeft, Search, Calendar, User, TrendingUp, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface InvestmentsDetailsProps {
  clientsWithLoans: ClientWithLoanDetails[];
  allLoans: Loan[];
  onDeleteLoan: (loanId: string) => Promise<void>;
  onBack: () => void;
}

export function InvestmentsDetails({ clientsWithLoans, allLoans, onDeleteLoan, onBack }: InvestmentsDetailsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Formatar valores como BRL
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  const handleDelete = async (loanId: string) => {
    setIsDeleting(true);
    try {
      await onDeleteLoan(loanId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("Erro ao deletar contrato:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Group active/all loans by client
  const clientInvestments = clientsWithLoans.map(c => {
    const clientLoans = allLoans.filter(l => l.clientId === c.client.id);
    const totalInvested = clientLoans
      .filter(l => l.status !== "completed")
      .reduce((sum, l) => sum + l.amountInvested, 0);

    return {
      client: c.client,
      loans: clientLoans,
      totalActiveInvested: totalInvested
    };
  }).filter(ci => {
    // Only show clients who have at least one loan
    if (ci.loans.length === 0) return false;
    
    // Search filter
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      return (
        ci.client.name.toLowerCase().includes(term) ||
        ci.client.phone.includes(term)
      );
    }
    return true;
  });

  // Calculate overall stats of current display
  const overallActiveInvested = clientInvestments.reduce((sum, ci) => sum + ci.totalActiveInvested, 0);
  const overallTotalLoansCount = clientInvestments.reduce((sum, ci) => sum + ci.loans.length, 0);

  return (
    <div className="space-y-6 select-none animate-fade-in">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950/40 border border-zinc-800/80 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-xl transition-colors border border-zinc-800 cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-yellow-500" />
              Detalhamento de Valores Investidos
            </h2>
            <p className="text-xs text-zinc-500">Delete contratos de teste para ajustar a realidade do caixa</p>
          </div>
        </div>

        {/* SEARCH BOX */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 focus:outline-none rounded-xl py-2 pl-10 pr-4 text-xs text-zinc-100 placeholder-zinc-500 transition-colors"
          />
        </div>
      </div>

      {/* QUICK INFO WARNING */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex gap-3 text-xs text-yellow-500/90 leading-relaxed">
        <Info className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold uppercase block mb-0.5 tracking-wider text-[10px]">Aviso de Ajuste de Testes</span>
          Ao clicar em <strong className="font-black">Excluir</strong> em qualquer contrato nesta tela, o empréstimo correspondente e todo o seu histórico de pagamentos serão apagados permanentemente do banco de dados. Use esta tela para limpar contratos criados como simulação/teste.
        </div>
      </div>

      {/* INVESTMENT LIST BY CLIENT */}
      <div className="space-y-4">
        {clientInvestments.length === 0 ? (
          <div className="text-center py-12 bg-zinc-950/20 border border-zinc-900 rounded-2xl">
            <AlertTriangle className="w-8 h-8 text-zinc-650 mx-auto mb-3" />
            <p className="text-zinc-550 text-xs font-semibold">Nenhum contrato ativo ou finalizado encontrado para os termos pesquisados.</p>
          </div>
        ) : (
          clientInvestments.map(({ client, loans, totalActiveInvested }) => (
            <div 
              key={client.id}
              className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl overflow-hidden p-5 space-y-4 hover:border-zinc-700/60 transition-colors"
            >
              {/* Client Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-850/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 font-bold text-xs">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100">{client.name}</h3>
                    <p className="text-[10px] text-zinc-500">Tel: {client.phone}</p>
                  </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-wider">Ativo Investido:</span>
                  <span className="text-xs font-black text-yellow-500">{formatBRL(totalActiveInvested)}</span>
                </div>
              </div>

              {/* Loans List under Client */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {loans.map((loan) => {
                  const isCompleted = loan.status === "completed";
                  const totalExpected = loan.totalAmount || Math.round(loan.dailyRate * loan.totalDays);
                  
                  return (
                    <div 
                      key={loan.id}
                      className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                        isCompleted 
                          ? "bg-zinc-950/20 border-zinc-900 text-zinc-500" 
                          : "bg-zinc-900/30 border-zinc-800/80 text-zinc-350"
                      }`}
                    >
                      {/* Loan Meta */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            isCompleted 
                              ? "bg-zinc-850 text-zinc-500" 
                              : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          }`}>
                            {isCompleted ? "Finalizado" : "Ativo"}
                          </span>
                          <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3" />
                            {loan.startDate}
                          </span>
                        </div>

                        {/* EXCLUIR CONTRATO BUTTON (With Confirmation UI) */}
                        {confirmDeleteId === loan.id ? (
                          <div className="flex items-center gap-1 animate-fade-in">
                            <span className="text-[8px] text-red-500 font-extrabold uppercase mr-1">Confirmar?</span>
                            <button
                              disabled={isDeleting}
                              onClick={() => handleDelete(loan.id)}
                              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white font-black text-[9px] rounded transition-all cursor-pointer"
                            >
                              Sim
                            </button>
                            <button
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black text-[9px] rounded transition-all cursor-pointer"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(loan.id)}
                            className="p-1.5 hover:bg-red-950/30 text-zinc-550 hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-900/30 cursor-pointer"
                            title="Excluir este contrato de empréstimo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Loan Financials details */}
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-t border-zinc-900 pt-3 text-[11px]">
                        <div>
                          <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Valor Emprestado</span>
                          <span className="font-extrabold text-zinc-200">{formatBRL(loan.amountInvested)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Total Retorno</span>
                          <span className="font-extrabold text-zinc-200">{formatBRL(totalExpected)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Taxa Diária</span>
                          <span className="font-semibold">{formatBRL(loan.dailyRate)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider">Parcelas</span>
                          <span className="font-semibold">{loan.totalDays} dias {loan.excludeSundays !== false ? "(sem domingos)" : ""}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
