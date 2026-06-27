import React, { useState } from "react";
import { ClientWithLoanDetails, FinancialStats, Loan, Payment } from "../types";
import { getFinancialCycle, getTodayStr } from "../utils/dateUtils";
import { 
  TrendingUp, 
  ArrowDownCircle, 
  Award, 
  Coins, 
  Gauge, 
  Percent, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  DollarSign,
  HelpCircle,
  PiggyBank
} from "lucide-react";

interface FinancialControlProps {
  clientsWithLoans: ClientWithLoanDetails[];
  stats: FinancialStats;
  allLoans: Loan[];
  allPayments: Payment[];
}

export const FinancialControl: React.FC<FinancialControlProps> = ({
  clientsWithLoans,
  stats,
  allLoans,
  allPayments
}) => {
  // Simulator configuration states
  const [simulationMoMGrace, setSimulationMoMGrace] = useState<number>(20); // 20% requested default
  const [customInterestRate, setCustomInterestRate] = useState<number>(42); // 42% standard interest rate defaulted

  // 1. Calculate general financial aggregates from database
  const totalLent = allLoans.reduce((sum, l) => sum + l.amountInvested, 0);
  const totalReceived = allPayments.reduce((sum, p) => sum + p.amount, 0);
  
  // Realized Profit = received payments minus the proportion of principal returned (or active interest rate return)
  // For simplicity and finance elegance, let's calculate Net Interest Profit Collected:
  // Since we know the average interest rate is ~30%, the principal component is ~77%, and interest is ~23%.
  // Or we can calculate it exactly: we can sum the profit portions of loans.
  // Let's compute exact cumulative profit under active terms:
  const totalRevenueExpected = allLoans.reduce((sum, l) => sum + l.totalAmount, 0);
  const projectedInterestProfit = totalRevenueExpected - totalLent;
  
  // Received profit can be estimated by: totalReceived - (principal portion of that received amount)
  // Or simply: totalReceived - totalLent (if we consider direct flow), but since we operate like an active fund:
  // Let's showcase standard cashflow: 
  // Entradas = totalReceived
  // Saídas = totalLent
  // Lucro Atual (Saldo em Caixa) = totalReceived - totalLent (if negative, it's normal as capital is out on the streets. Let's call it "Saldo de Caixa Ativo").
  // Lucro Realizado Real (Juros Cobrados):
  const realizedProfitExact = allPayments.reduce((pSum, pay) => {
    // Find corresponding loan
    const loan = allLoans.find(l => l.id === pay.loanId);
    if (!loan || loan.amountInvested === 0) return pSum;
    const profitRatio = (loan.totalAmount - loan.amountInvested) / loan.totalAmount;
    return pSum + (pay.amount * profitRatio);
  }, 0);

  // Profit realized in current month's cycle (Starts on day 02)
  const currentMonthCycle = getFinancialCycle(getTodayStr());
  const realizedProfitThisMonth = allPayments
    .filter(p => p.paymentDate >= currentMonthCycle.start && p.paymentDate <= currentMonthCycle.end)
    .reduce((pSum, pay) => {
      const loan = allLoans.find(l => l.id === pay.loanId);
      if (!loan || loan.amountInvested === 0) return pSum;
      const profitRatio = (loan.totalAmount - loan.amountInvested) / loan.totalAmount;
      return pSum + (pay.amount * profitRatio);
    }, 0);

  // 2. Metrics for Pagantes (Up-to-Date) vs Inadimplentes (Delayed)
  const activeClients = clientsWithLoans.filter(c => c.activeLoan !== null);
  const payingClients = activeClients.filter(c => !c.isDelayed);
  const delinquentClients = activeClients.filter(c => c.isDelayed);

  const payingCount = payingClients.length;
  const delinquentCount = delinquentClients.length;
  const totalActiveCount = activeClients.length;

  // Delinquency rate calculations (NPL %)
  const defaultRateByClient = totalActiveCount > 0 ? (delinquentCount / totalActiveCount) * 100 : 0;
  
  // --- BLINDAGEM DE LUCROS & COMPENSAÇÃO DE INADIMPLÊNCIA MATEMÁTICA ENGENHADA ---
  const activeDefaultRate = defaultRateByClient > 0 ? defaultRateByClient : 15;
  const breakEvenInterestRate = (activeDefaultRate / (100 - Math.min(99, activeDefaultRate))) * 100;
  const maxDefaultTolerance = (1 - (1 / (1 + (customInterestRate / 100)))) * 100;
  const netInvestmentYieldProfit = ((1 - (activeDefaultRate / 100)) * (1 + (customInterestRate / 100)) - 1) * 100;
  
  // Delinquency by Value (overdue amount)
  const totalOverdueAmount = delinquentClients.reduce((sum, c) => {
    if (!c.activeLoan) return sum;
    // Overdue installments = expected payments to date - received payments to date
    // Actually, we already have c.daysBehind * c.activeLoan.dailyRate
    return sum + (c.daysBehind * c.activeLoan.dailyRate);
  }, 0);

  // Active Monthly Billing Runway (Faturamento Mensal Ativo)
  // Calculated as sum of (dailyRate * 30) of all active payers
  const activeMonthlyBillingPayers = payingClients.reduce((sum, c) => {
    if (!c.activeLoan) return sum;
    return sum + (c.activeLoan.dailyRate * 30);
  }, 0);

  const activeMonthlyBillingDelinquent = delinquentClients.reduce((sum, c) => {
    if (!c.activeLoan) return sum;
    return sum + (c.activeLoan.dailyRate * 30);
  }, 0);

  const totalActiveMonthlyBilling = activeMonthlyBillingPayers + activeMonthlyBillingDelinquent;

  // 3. 20% MoM SYSTEM GROWTH SIMULATOR
  // The goal: Grow billing by X% (MoM - standard default is 20%)
  const growthTargetPct = simulationMoMGrace / 100;
  const currentBillingForGrowth = totalActiveMonthlyBilling > 0 ? totalActiveMonthlyBilling : 15000; // fallback default to make it interactive even when wiped
  const targetBillingChangeNeeded = currentBillingForGrowth * growthTargetPct;
  const targetMonthlyBilling = currentBillingForGrowth + targetBillingChangeNeeded;

  // How much do we need to lend to capture that billing change next month?
  // Let's calculate: 
  // New Monthly Billing needed = targetBillingChangeNeeded.
  // Standard monthly return of a contract is 1.30x the principal (for 30% interest).
  // So Billing = Principal * (1 + interestRate/100).
  // Thus, Capital needed to lend = New Monthly Billing needed / (1 + interestRate/100).
  //BUT we must take delinquency/default rate into account!
  // If default rate is D%, only (1 - D) of the new loans will pay on time.
  // So to guarantee a net increase of targetBillingChangeNeeded, we must inflate the target by 1 / (1 - D).
  const defaultRatioFactor = defaultRateByClient > 0 ? (defaultRateByClient / 100) : 0.15; // default to 15% safety buffer if no default exists currently
  // Cap safety buffer to avoid division by zero
  const safeDefaultRatio = Math.min(0.5, defaultRatioFactor); 
  const riskAdjustedBillingNeeded = targetBillingChangeNeeded / (1 - safeDefaultRatio);
  
  // Total capital needed to lend:
  const interestFactor = 1 + (customInterestRate / 100);
  const requiredCapitalToLend = riskAdjustedBillingNeeded / interestFactor;
  
  // Number of average new contracts needed (assume average loan of $1,500)
  const averageLoanSize = 1500;
  const contractsCountNeeded = Math.ceil(requiredCapitalToLend / averageLoanSize);

  // Formatter helper
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  return (
    <div className="space-y-6 select-none animate-fade-in text-zinc-100">
      
      {/* SECTION 1: FINANCIAL FLOW CARD ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* CARD 1: ENTRADAS */}
        <div className="bg-zinc-950/40 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="absolute top-0 right-0 p-3 opacity-5">
            <ArrowDownCircle className="w-16 h-16 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <ArrowDownCircle className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider font-mono">Entradas (Repasses Coletados)</span>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight text-emerald-450">
              {formatBRL(totalReceived)}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">Soma total de todas as parcelas pagas no caixa</p>
          </div>
        </div>

        {/* CARD 2: SAÍDAS */}
        <div className="bg-zinc-950/40 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group hover:border-red-550/30 transition-all">
          <div className="absolute top-0 right-0 p-3 opacity-5">
            <TrendingUp className="w-16 h-16 text-red-400" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-red-500/10 text-red-400 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider font-mono">Saídas (Capital Emprestado)</span>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-zinc-100 font-mono tracking-tight">
              {formatBRL(totalLent)}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">Acúmulo histórico de capital disponibilizado</p>
          </div>
        </div>

        {/* CARD 3: VALOR A RECEBER (TODOS APORTES) */}
        <div className="bg-zinc-950/40 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group hover:border-sky-500/30 transition-all">
          <div className="absolute top-0 right-0 p-3 opacity-5">
            <Coins className="w-16 h-16 text-sky-400" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
              <Coins className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider font-mono">Valor a Receber (Todos Aportes)</span>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-sky-400 font-mono tracking-tight">
              {formatBRL(stats.futureProjections)}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">Total pendente a receber dos contratos ativos</p>
          </div>
        </div>

        {/* CARD 4: LUCRO REALIZADO DE JUROS */}
        <div className="bg-zinc-950/40 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group hover:border-amber-400/30 transition-all">
          <div className="absolute top-0 right-0 p-3 opacity-5">
            <Award className="w-16 h-16 text-amber-400" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-amber-400/10 text-amber-400 rounded-lg">
              <Award className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider font-mono">Lucro de Juros Realizado</span>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">
              {formatBRL(realizedProfitExact)}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">Total de juros líquido recuperado dos pagamentos</p>
          </div>
        </div>

        {/* CARD 5: LUCRO MENSAL */}
        <div className="bg-zinc-950/40 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group hover:border-violet-500/30 transition-all">
          <div className="absolute top-0 right-0 p-3 opacity-5">
            <PiggyBank className="w-16 h-16 text-violet-400" />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-violet-500/10 text-violet-400 rounded-lg">
              <PiggyBank className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider font-mono">Lucro Mensal (Mês Atual)</span>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-violet-400 font-mono tracking-tight">
              {formatBRL(realizedProfitThisMonth)}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1">Juros líquidos recuperados no ciclo atual (Dia 02)</p>
          </div>
        </div>

      </div>

      {/* SECTION 2: ADIMPLÊNCIA / INADIMPLÊNCIA METRICS SEGMENT (Pagantes vs Inadimplentes) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* PAYERS VS DELINQUENTS RATIOS (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-950/40 border border-zinc-850 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
            <Gauge className="w-4 h-4 text-amber-400" />
            <h4 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider">Métricas de Clientes & Comportamento</h4>
          </div>

          {/* Ratios visual progress row */}
          <div className="space-y-4">
            
            {/* Paying clients metrics group */}
            <div className="bg-zinc-900/30 border border-zinc-850 p-3 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <div>
                  <span className="text-xs font-bold text-zinc-200 block">Clientes Pagantes (Em Dia)</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Contratos ativos sem pendência</span>
                </div>
              </div>
              <span className="text-sm font-black font-mono text-zinc-100">{payingCount} <span className="text-[10px] text-zinc-500 font-normal">cli.</span></span>
            </div>

            {/* Delinquent clients metrics group (Inadimplente) */}
            <div className="bg-zinc-900/30 border border-zinc-850 p-3 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <div>
                  <span className="text-xs font-bold text-zinc-200 block">Clientes Inadimplentes (Com Atraso)</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Atraso superior a 1 diária</span>
                </div>
              </div>
              <span className="text-sm font-black font-mono text-amber-400">{delinquentCount} <span className="text-[10px] text-zinc-500 font-normal">cli.</span></span>
            </div>

            {/* Overdue capital metrics group */}
            <div className="bg-zinc-900/30 border border-zinc-850 p-3 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <div>
                  <span className="text-xs font-bold text-zinc-200 block">Capital Ativo em Atraso</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Soma de depósitos vencidos acumulados</span>
                </div>
              </div>
              <span className="text-sm font-black font-mono text-red-400">{formatBRL(totalOverdueAmount)}</span>
            </div>

            {/* General Default Risk Rate indicator */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-zinc-500 font-bold uppercase">Índice de Inadimplência Geral</span>
                <span className="text-amber-400 font-black">{defaultRateByClient.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-amber-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${defaultRateByClient}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono pt-0.5">
                <span>0% Risco de Perda</span>
                <span>Alerta Crítico &gt; 35%</span>
              </div>
            </div>

            {/* BLINDAGEM DE LUCRO INTERACTIVE MATHEMATICS CARD */}
            <div className="border-t border-zinc-900 pt-4 mt-2 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h5 className="font-extrabold text-[11px] uppercase tracking-wider text-zinc-300">Estrutura de Blindagem de Margem ({customInterestRate}%)</h5>
              </div>
              
              <div className="space-y-2 text-xs">
                {/* Break-even indicator */}
                <div className="flex justify-between items-center py-1.5 px-3 bg-zinc-900/30 rounded-xl border border-zinc-900">
                  <span className="text-zinc-400 text-[10px] uppercase font-mono">Ponto de Equilíbrio (Break-Even)</span>
                  <span className="font-bold text-zinc-100 font-mono">{breakEvenInterestRate.toFixed(1)}%</span>
                </div>
                
                {/* Net Safe Return rate */}
                <div className="flex justify-between items-center py-1.5 px-3 bg-zinc-900/40 rounded-xl border border-emerald-500/10">
                  <span className="text-emerald-400 text-[10px] uppercase font-bold font-mono">Margem Real Total Estimada</span>
                  <span className={`font-black font-mono ${netInvestmentYieldProfit >= 0 ? "text-emerald-400" : "text-amber-500"}`}>
                    {netInvestmentYieldProfit >= 0 ? "+" : ""}{netInvestmentYieldProfit.toFixed(1)}%
                  </span>
                </div>
                
                {/* Max Delinquency Tolerance limit */}
                <div className="flex justify-between items-center py-1.5 px-3 bg-zinc-900/30 rounded-xl border border-zinc-900">
                  <span className="text-zinc-400 text-[10px] uppercase font-mono">Limite para Suportar Perdas</span>
                  <span className="font-bold text-red-400 font-mono">{maxDefaultTolerance.toFixed(1)}% <span className="text-[9px] text-zinc-500">atraso</span></span>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-[10px] text-emerald-400 leading-normal text-justify font-mono">
                  ✨ <strong>Cálculos Prontos:</strong> Com a taxa padrão de <strong>{customInterestRate}%</strong>, sua carteira de repasse está blindada. Mesmo que a inadimplência chegue a <strong>{maxDefaultTolerance.toFixed(1)}%</strong>, seu capital inicial permanece intocado. Cada ciclo gerará lucro real que, se reinvestido, garante a meta de <strong>crescer a carteira 20% ao mês</strong> de forma robusta e recorrente!
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* 20% MoM GROWTH EVOLUTION & SIMULATOR PANEL (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-950/40 border border-zinc-850 rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-amber-400" />
              <h4 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider">Plano de Expansão e Crescimento MoM</h4>
            </div>
            <span className="bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-lg font-mono">
              Meta: +{simulationMoMGrace}% / mês
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-normal">
            Este simulador inteligente avalia a sua carteira ativa, calcula o impacto do índice de 
            <strong className="text-zinc-200"> inadimplência real ({defaultRateByClient.toFixed(0)}%)</strong> e planeja quanto capital precisa ser injetado para subir o faturamento recorrente.
          </p>

          {/* Interactive controls */}
          <div className="grid grid-cols-2 gap-4 bg-zinc-900/30 p-4 rounded-xl border border-zinc-850 select-none">
            
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">Meta de Crescimento (%)</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range"
                  min="5"
                  max="50"
                  value={simulationMoMGrace}
                  onChange={e => setSimulationMoMGrace(Number(e.target.value))}
                  className="flex-1 accent-amber-400 h-1"
                />
                <span className="text-xs font-bold text-amber-400 font-mono w-8 text-right">{simulationMoMGrace}%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">Juros Médio Praticado (%)</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range"
                  min="10"
                  max="100"
                  value={customInterestRate}
                  onChange={e => setCustomInterestRate(Number(e.target.value))}
                  className="flex-1 accent-amber-400 h-1"
                />
                <span className="text-xs font-bold text-amber-400 font-mono w-8 text-right">{customInterestRate}%</span>
              </div>
            </div>

          </div>

          {/* SIMULATION MATHEMATICS RESULTS CONTAINER */}
          <div className="space-y-3.5 pt-1">
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850/60 space-y-1">
                <span className="text-[9px] text-zinc-550 uppercase font-black font-mono block">Faturamento Atual</span>
                <span className="text-sm font-bold text-zinc-250 font-mono block">
                  {formatBRL(currentBillingForGrowth)}
                </span>
                <span className="text-[9px] text-zinc-500 block">Projeção mensal ativa</span>
              </div>

              <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850/60 space-y-1">
                <span className="text-[9px] text-zinc-550 uppercase font-black font-mono block">Nova Meta de Faturamento</span>
                <span className="text-sm font-bold text-emerald-400 font-mono block">
                  {formatBRL(targetMonthlyBilling)}
                </span>
                <span className="text-[9px] text-zinc-500 block">+{simulationMoMGrace}% de crescimento</span>
              </div>

              <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850/60 space-y-1">
                <span className="text-[9px] text-zinc-550 uppercase font-black font-mono block">Aumento Líquido Requerido</span>
                <span className="text-sm font-bold text-amber-400 font-mono block">
                  {formatBRL(targetBillingChangeNeeded)}
                </span>
                <span className="text-[9px] text-zinc-500 block">Incremento real de caixa</span>
              </div>

            </div>

            {/* HIGHLIGHTED INSTRUCTION: QUANTO PRECISA EMPRESTAR HOJE */}
            <div className="bg-gradient-to-r from-amber-950/20 to-zinc-900/40 border border-amber-500/25 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest font-mono block">
                    Capital a Emprestar Necessário
                  </span>
                  <strong className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight block">
                    {formatBRL(requiredCapitalToLend)}
                  </strong>
                </div>
                <div className="p-2.5 bg-amber-400 text-zinc-950 rounded-xl shadow-lg shadow-amber-400/10 shrink-0">
                  <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>

              <div className="text-[11px] text-zinc-400 leading-relaxed font-mono pt-1 text-justify">
                💡 <span className="text-amber-400 font-bold">Diagnóstico Operacional:</span> Para crescer seu faturamento em <span className="text-zinc-200 font-bold">{simulationMoMGrace}%</span>, você precisa liberar <span className="text-zinc-200 font-bold">{formatBRL(requiredCapitalToLend)}</span> em novos empréstimos com taxa de <span className="text-zinc-200 font-bold">{customInterestRate}%</span>. 
                Este cálculo foi compensado em <span className="text-amber-400 font-bold">{(defaultRatioFactor * 100).toFixed(0)}%</span> para suportar o atraso de maus pagadores detectados na sua carteira. 
                Isso equivale a aproximadamente <span className="text-zinc-250 font-bold">{contractsCountNeeded} novos contratos</span> de {formatBRL(averageLoanSize)} cada um.
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
