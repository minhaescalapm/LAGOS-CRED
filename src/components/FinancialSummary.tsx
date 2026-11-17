import React, { useMemo, useState } from "react";
import { ClientWithLoanDetails, FinancialStats } from "../types";
import { TrendingUp, Award, Coins, CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { formatFriendlyDate, getTodayStr } from "../utils/dateUtils";
import {
  getLoanFinalPaymentProjection,
  getLoanFrequency,
  getLoanFrequencyBadge
} from "../utils/loanSchedule";

interface FinancialSummaryProps {
  stats: FinancialStats;
  clientsWithLoans?: ClientWithLoanDetails[];
  targetDate?: string;
  onTotalInvestedClick?: () => void;
}

export function FinancialSummary({
  stats,
  clientsWithLoans = [],
  targetDate,
  onTotalInvestedClick
}: FinancialSummaryProps) {
  const [showEndDates, setShowEndDates] = useState(false);

  const roundBRL = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

  const capitalInvestido = roundBRL(stats.moneyInvested);
  const lucroJuros = roundBRL(stats.totalProfit);
  const totalAReceberComCapital = roundBRL(capitalInvestido + lucroJuros);
  const avgInterestPct =
    capitalInvestido > 0 ? ((lucroJuros / capitalInvestido) * 100).toFixed(1).replace(".", ",") : "0,0";

  const effectiveToday = targetDate || getTodayStr();

  const endProjections = useMemo(() => {
    const rows = clientsWithLoans
      .filter(
        d =>
          d.activeLoan &&
          d.activeLoan.status !== "completed" &&
          !d.client.archived &&
          d.activeLoan.totalDays > 0 &&
          d.paidCount < d.activeLoan.totalDays
      )
      .map(d => {
        const loan = d.activeLoan!;
        const projection = getLoanFinalPaymentProjection(loan, d.paidCount, d.payments, effectiveToday);
        const freq = getLoanFrequency(loan);
        return {
          detail: d,
          loan,
          freq,
          excludesSundays: freq === "daily" && loan.excludeSundays !== false,
          projection
        };
      });

    rows.sort((a, b) => b.projection.projectedEndDate.localeCompare(a.projection.projectedEndDate));
    return rows;
  }, [clientsWithLoans, effectiveToday]);

  const farthestEnd = endProjections.length > 0 ? endProjections[0] : null;

  // Formatar valores como Real Brasileiro (BRL)
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  return (
    <div className="space-y-3 select-none">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD 1: SÓ O CAPITAL INVESTIDO */}
        <div
          id="card-money-invested"
          onClick={onTotalInvestedClick}
          className={`relative overflow-hidden bg-zinc-950/40 border border-zinc-800/80 p-5 rounded-2xl flex flex-col justify-between group hover:border-yellow-500/30 transition-all duration-300 ${onTotalInvestedClick ? "cursor-pointer" : ""}`}
        >
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp className="w-16 h-16 text-yellow-500" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
              Capital Investido
            </span>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-white group-hover:text-yellow-500 transition-colors tracking-tight font-mono">
              {formatBRL(capitalInvestido)}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1.5">
              Só o capital principal ativo emprestado
            </p>
          </div>
        </div>

        {/* CARD 2: SOMA DO TOTAL A RECEBER COM O CAPITAL INVESTIDO */}
        <div
          id="card-to-receive-all"
          className="relative overflow-hidden bg-zinc-950/40 border border-yellow-500/25 p-5 rounded-2xl flex flex-col justify-between group hover:border-yellow-500/45 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <Coins className="w-16 h-16 text-yellow-500" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg">
              <Coins className="w-4 h-4" />
            </div>
            <span className="text-yellow-500 font-bold uppercase tracking-wider text-[10px]">
              Total a Receber (Capital + Juros)
            </span>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-yellow-500 tracking-tight font-mono">
              {formatBRL(totalAReceberComCapital)}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1.5">
              Soma do capital investido + juros ({formatBRL(stats.futureProjections)} em aberto)
            </p>
          </div>
        </div>

        {/* CARD 3: LUCRO PELOS JUROS COLOCADOS + ATÉ QUANDO VAI O ÚLTIMO PAGAMENTO */}
        <div
          id="card-expected-profit"
          className="relative overflow-hidden bg-zinc-950/40 border border-emerald-500/25 p-5 rounded-2xl flex flex-col justify-between group hover:border-emerald-500/45 transition-all duration-300"
        >
          <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
            <Award className="w-16 h-16 text-emerald-400" />
          </div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Award className="w-4 h-4" />
              </div>
              <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                Lucro (Juros)
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              +{avgInterestPct}%
            </span>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight font-mono">
              {formatBRL(lucroJuros)}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">
              Calculado pelos juros colocados nos contratos ativos
            </p>

            {/* ÚLTIMO PAGAMENTO DOS CLIENTES (SEM CONTAR DOMINGOS) */}
            <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <CalendarDays className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-zinc-400">
                    Último pagamento até:
                  </span>
                </div>
                {farthestEnd ? (
                  <div className="mt-0.5 flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xs font-black font-mono text-white">
                      {formatFriendlyDate(farthestEnd.projection.projectedEndDate)}
                    </span>
                    <span className="text-[10px] text-zinc-400 truncate">
                      {farthestEnd.detail.client.name} ({farthestEnd.loan.totalDays}x
                      {farthestEnd.excludesSundays ? " s/ dom." : ""})
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">
                    Nenhum contrato ativo em aberto
                  </span>
                )}
              </div>

              {endProjections.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowEndDates(prev => !prev)}
                  className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-lg text-[9px] font-bold text-emerald-300 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                  title="Ver até quando vai o último pagamento de cada cliente (sem contar domingos)"
                >
                  <span>{showEndDates ? "Ocultar" : `Ver (${endProjections.length})`}</span>
                  {showEndDates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LISTA EXPANSÍVEL: QUANDO TERMINA O EMPRÉSTIMO DE CADA CLIENTE (SEM CONTAR DOMINGOS) */}
      {showEndDates && endProjections.length > 0 && (
        <div className="bg-zinc-950/60 border border-emerald-500/20 rounded-2xl p-4 space-y-3 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-emerald-400" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-100">
                  Previsão do Último Pagamento dos Clientes
                </h4>
                <p className="text-[10px] text-zinc-500">
                  Data exata de término de cada contrato ativo (sem contar domingos isentos)
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              {endProjections.length} {endProjections.length === 1 ? "contrato ativo" : "contratos ativos"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {endProjections.map(({ detail, loan, excludesSundays, projection }) => (
              <div
                key={loan.id}
                className="p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-xl flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-zinc-100 truncate">
                      {detail.client.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded font-mono font-bold shrink-0">
                      {getLoanFrequencyBadge(loan)}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 mt-1">
                    {detail.paidCount}/{loan.totalDays} pagas • faltam{" "}
                    <strong className="text-zinc-200">{projection.remainingInstallments}x</strong>
                    {excludesSundays ? " • s/ domingos" : ""}
                  </div>
                  <div className="text-[9px] font-mono text-zinc-500 mt-0.5">
                    Início: {formatFriendlyDate(loan.startDate)}
                    {projection.isExtendedByDelay && (
                      <span className="text-amber-400/90">
                        {" "}• Prev. orig.: {formatFriendlyDate(projection.scheduledEndDate)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500 block">
                    Termina em
                  </span>
                  <span className="text-xs font-black font-mono text-emerald-400">
                    {formatFriendlyDate(projection.projectedEndDate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

