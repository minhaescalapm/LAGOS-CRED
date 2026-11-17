import React from "react";
import { FinancialStats } from "../types";
import { TrendingUp, Award, Coins } from "lucide-react";

interface FinancialSummaryProps {
  stats: FinancialStats;
  onTotalInvestedClick?: () => void;
}

export function FinancialSummary({ stats, onTotalInvestedClick }: FinancialSummaryProps) {
  const roundBRL = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

  const capitalInvestido = roundBRL(stats.moneyInvested);
  const lucroJuros = roundBRL(stats.totalProfit);
  const totalAReceberComCapital = roundBRL(capitalInvestido + lucroJuros);
  const avgInterestPct =
    capitalInvestido > 0 ? ((lucroJuros / capitalInvestido) * 100).toFixed(1).replace(".", ",") : "0,0";

  // Formatar valores como Real Brasileiro (BRL)
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none">
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

      {/* CARD 3: LUCRO PELOS JUROS COLOCADOS */}
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
          <p className="text-[10px] text-zinc-500 mt-1.5">
            Calculado pelos juros colocados nos contratos ativos
          </p>
        </div>
      </div>
    </div>
  );
}

