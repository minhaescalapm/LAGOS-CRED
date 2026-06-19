import React from "react";
import { FinancialStats } from "../types";
import { BarChart3, HelpCircle } from "lucide-react";

interface StatsSectionProps {
  stats: FinancialStats;
}

export function StatsSection({ stats }: StatsSectionProps) {
  // Extract month historical values
  const pastEntries = Object.entries(stats.pastReceived); // [label, amount]
  
  // Find highest value to scale the bars correctly
  const allValues = [
    ...pastEntries.map(([_, val]) => val),
    stats.receivedThisMonth,
    stats.futureProjections
  ];
  const maxVal = Math.max(...allValues, 1000); // minimum scale limit to draw gracefully

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-5 md:p-6 select-none">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-1 px-2.5 bg-yellow-500/10 text-yellow-500 rounded-lg text-xs font-mono font-bold">
            STAT
          </div>
          <h3 className="font-semibold text-white text-sm md:text-base">Métricas de Faturamento por Ciclo</h3>
        </div>
        <BarChart3 className="w-5 h-5 text-yellow-500" />
      </div>

      <div className="space-y-5">
        {/* PAST & PRESENT CYCLES */}
        {pastEntries.map(([label, amount], idx) => {
          // Check if this is the active cycle (usually the last index of pastReceived since we query last 4 cycles)
          const isCurrentCycle = idx === pastEntries.length - 1;
          const percentage = Math.round((amount / maxVal) * 100);

          return (
            <div key={label} className="group">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5 font-medium">
                  <span className={isCurrentCycle ? "text-yellow-500 font-semibold" : "text-zinc-400"}>
                    {label}
                  </span>
                  {isCurrentCycle && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 font-bold rounded-full uppercase tracking-wider">
                      Ciclo Ativo
                    </span>
                  )}
                </div>
                <span className={`font-mono text-xs font-bold ${isCurrentCycle ? "text-yellow-500" : "text-zinc-300"}`}>
                  {formatBRL(amount)}
                </span>
              </div>
              
              <div className="h-3.5 bg-zinc-900 rounded-full overflow-hidden flex">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isCurrentCycle 
                      ? "bg-gradient-to-r from-yellow-500 to-amber-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]" 
                      : "bg-zinc-700"
                  }`}
                  style={{ width: `${Math.max(percentage, 4)}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* FUTURE PROJECTION */}
        <div className="group pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="text-yellow-500 font-semibold flex items-center gap-1">
                Faturamento Futuro (Projeção)
              </span>
              <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 font-bold rounded-full uppercase tracking-wider">
                Contratos Ativos
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-yellow-500">
              {formatBRL(stats.futureProjections)}
            </span>
          </div>
          
          <div className="h-3.5 bg-zinc-900 rounded-full overflow-hidden flex">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 shadow-[0_0_10px_rgba(234,179,8,0.3)] transition-all duration-1000"
              style={{ width: `${Math.max(Math.round((stats.futureProjections / maxVal) * 100), 4)}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2.5">
            <div className="text-[10px] text-zinc-500 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-yellow-500/60" />
              Projeção calculada somando os valores que faltam ser pagos de todos os empréstimos ativos.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
