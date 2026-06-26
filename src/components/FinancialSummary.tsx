import React from "react";
import { FinancialStats } from "../types";
import { TrendingUp, ArrowDownCircle, Award, Calendar, DollarSign, Zap } from "lucide-react";
import { getFinancialCycle, formatFriendlyDate, getTodayStr } from "../utils/dateUtils";

interface FinancialSummaryProps {
  stats: FinancialStats;
  onTotalInvestedClick?: () => void;
}

export function FinancialSummary({ stats, onTotalInvestedClick }: FinancialSummaryProps) {
  const currentCycle = getFinancialCycle(getTodayStr());

  // Formatar valores como Real Brasileiro (BRL)
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 select-none">
      {/* CARD 1: DINHEIRO INVESTIDO */}
      <div 
        id="card-money-invested"
        onClick={onTotalInvestedClick}
        className={`relative overflow-hidden bg-zinc-950/40 border border-zinc-800/80 p-5 rounded-2xl flex flex-col justify-between group hover:border-yellow-500/30 transition-all duration-300 ${onTotalInvestedClick ? 'cursor-pointer' : ''}`}
      >
        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
          <TrendingUp className="w-16 h-16 text-yellow-500" />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
          <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Total Investido</span>
        </div>
        <div>
          <h3 className="text-2xl font-black text-white group-hover:text-yellow-500 transition-colors tracking-tight">
            {formatBRL(stats.moneyInvested)}
          </h3>
          <p className="text-[10px] text-zinc-500 mt-1.5">Capital ativo emprestado</p>
        </div>
      </div>

      {/* CARD 2: RECEBIDOS NO MÊS (CICLO FINANCEIRO DIA 02) */}
      <div 
        id="card-received-month"
        className="relative overflow-hidden bg-zinc-950/40 border border-zinc-800/80 p-5 rounded-2xl flex flex-col justify-between group hover:border-yellow-500/30 transition-all duration-300"
      >
        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
          <ArrowDownCircle className="w-16 h-16 text-yellow-500" />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg">
            <ArrowDownCircle className="w-4 h-4" />
          </div>
          <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Recebido (Mês)</span>
        </div>
        <div>
          <h3 className="text-2xl font-black text-yellow-500 tracking-tight">
            {formatBRL(stats.receivedThisMonth)}
          </h3>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-500 mt-1.5">
            <Calendar className="w-3 h-3 text-yellow-500/60" />
            Vira dia 02 ({formatFriendlyDate(currentCycle.start).slice(0, 5)} a {formatFriendlyDate(currentCycle.end).slice(0, 5)})
          </span>
        </div>
      </div>

      {/* CARD 3: LUCRO ESPERADO */}
      <div 
        id="card-expected-profit"
        className="relative overflow-hidden bg-zinc-950/40 border border-zinc-800/80 p-5 rounded-2xl flex flex-col justify-between group hover:border-yellow-500/30 transition-all duration-300"
      >
        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
          <Award className="w-16 h-16 text-yellow-500" />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg">
            <Award className="w-4 h-4" />
          </div>
          <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Lucro Esperado</span>
        </div>
        <div>
          <h3 className="text-2xl font-black text-white group-hover:text-yellow-500 transition-colors tracking-tight">
            {formatBRL(stats.totalProfit)}
          </h3>
          <p className="text-[10px] text-zinc-500 mt-1.5">Juros projetados nos ativos</p>
        </div>
      </div>

      {/* CARD 4: RECEBIDOS NA SEMANA */}
      <div 
        id="card-received-week"
        className="relative overflow-hidden bg-zinc-950/40 border border-zinc-800/80 p-5 rounded-2xl flex flex-col justify-between group hover:border-yellow-500/30 transition-all duration-300"
      >
        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
          <Zap className="w-16 h-16 text-yellow-500" />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg">
            <Zap className="w-4 h-4" />
          </div>
          <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Semana (Últimos 7d)</span>
        </div>
        <div>
          <h3 className="text-2xl font-black text-white group-hover:text-yellow-500 transition-colors tracking-tight">
            {formatBRL(stats.receivedThisWeek)}
          </h3>
          <p className="text-[10px] text-zinc-500 mt-1.5">Soma móvel dos últimos 7 dias</p>
        </div>
      </div>
    </div>
  );
}
