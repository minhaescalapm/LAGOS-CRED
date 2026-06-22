import React, { useState, useMemo } from "react";
import { ClientWithLoanDetails, Loan, Payment } from "../types";
import { 
  parseLocalDate, 
  formatLocalDate, 
  formatFriendlyDate, 
  isSunday, 
  addDays, 
  getTodayStr 
} from "../utils/dateUtils";
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Phone, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  MessageSquare, 
  TrendingUp, 
  Sparkles, 
  DollarSign,
  User,
  Activity
} from "lucide-react";

interface SmartAgendaProps {
  clientsWithLoans: ClientWithLoanDetails[];
  allLoans: Loan[];
  allPayments: Payment[];
  simulationDate: string;
  onAddNewContractForDate: (date: string) => void;
}

export const SmartAgenda: React.FC<SmartAgendaProps> = ({
  clientsWithLoans,
  allLoans,
  allPayments,
  simulationDate,
  onAddNewContractForDate
}) => {
  // 1. Month Navigation State
  const currentDate = parseLocalDate(simulationDate);
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth()); // 0-indexed
  const [selectedDayStr, setSelectedDayStr] = useState(simulationDate);

  // Formatting helpers
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  // 2. Pre-calculate all expected payment dates for each loan
  const loanSchedules = useMemo(() => {
    return allLoans.map(loan => {
      const dates: string[] = [];
      let current = addDays(loan.startDate, 1);
      const isExcluding = loan.excludeSundays !== false;
      let added = 0;
      // Safeguard against infinite loops
      let iterations = 0;
      while (added < loan.totalDays && iterations < 1000) {
        iterations++;
        if (!isExcluding || !isSunday(current)) {
          dates.push(current);
          added++;
        }
        current = addDays(current, 1);
      }
      return {
        loan,
        scheduledDates: dates
      };
    });
  }, [allLoans]);

  // 3. Month & Year Details
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // 4. Generate calendar days list for the view month
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    
    // Day of week of first day (0 = Sunday, 6 = Saturday)
    let startDayOfWeek = firstDay.getDay(); 
    // Shift so Monday is index 0 if wanted, or keep standard (Sunday = 0)
    // We will keep standard Sunday = 0 for easy grid mapping
    
    const totalDays = lastDay.getDate();
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prepend previous month's trailing days for complete grid row alignment
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dummyDate = new Date(y, m, d);
      days.push({
        dateStr: formatLocalDate(dummyDate),
        dayNum: d,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dummyDate = new Date(viewYear, viewMonth, d);
      days.push({
        dateStr: formatLocalDate(dummyDate),
        dayNum: d,
        isCurrentMonth: true
      });
    }

    // Append next month's beginning days to complete 42 cells grid (6 rows of 7 days)
    const remainingCells = 42 - days.length;
    for (let d = 1; d <= remainingCells; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dummyDate = new Date(y, m, d);
      days.push({
        dateStr: formatLocalDate(dummyDate),
        dayNum: d,
        isCurrentMonth: false
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  // 5. Gather statistics per calendar day
  const dayStatsMap = useMemo(() => {
    const stats: Record<string, {
      expectedAmount: number;
      collectionsCount: number;
      contractsStarted: number;
      paymentsReceived: number;
      actualReceivedAmount: number;
    }> = {};

    calendarGrid.forEach(cell => {
      const { dateStr } = cell;

      // Contracts starting today
      const starts = allLoans.filter(l => l.startDate === dateStr).length;

      // Collections scheduled today
      let expected = 0;
      let count = 0;
      loanSchedules.forEach(({ loan, scheduledDates }) => {
        if (scheduledDates.includes(dateStr)) {
          expected += loan.dailyRate;
          count++;
        }
      });

      // Payments received physically today
      const collectedPayments = allPayments.filter(p => p.paymentDate === dateStr);
      const collectedAmt = collectedPayments.reduce((sum, p) => sum + p.amount, 0);

      stats[dateStr] = {
        expectedAmount: expected,
        collectionsCount: count,
        contractsStarted: starts,
        paymentsReceived: collectedPayments.length,
        actualReceivedAmount: collectedAmt
      };
    });

    return stats;
  }, [calendarGrid, allLoans, allPayments, loanSchedules]);

  // 6. Selected day detailed calculations
  const selectedDayDetails = useMemo(() => {
    const stats = dayStatsMap[selectedDayStr] || {
      expectedAmount: 0,
      collectionsCount: 0,
      contractsStarted: 0,
      paymentsReceived: 0,
      actualReceivedAmount: 0
    };

    // Find specific contracts starting on this day
    const starts = allLoans.filter(l => l.startDate === selectedDayStr).map(loan => {
      const clientDetail = clientsWithLoans.find(c => c.client.id === loan.clientId);
      return {
        loan,
        client: clientDetail?.client || { id: loan.clientId, name: "Cliente Desconhecido", phone: "" }
      };
    });

    // Find specific collections expected on this day
    const collections = loanSchedules
      .filter(({ scheduledDates }) => scheduledDates.includes(selectedDayStr))
      .map(({ loan }) => {
        const clientDetail = clientsWithLoans.find(c => c.client.id === loan.clientId && c.activeLoan?.id === loan.id);
        const paymentsOfThisLoan = allPayments.filter(p => p.loanId === loan.id);
        
        // Check if this particular date cell is covered by payments
        // We sort payments of this loan by Reference Date to find out
        const sortedRefDates = paymentsOfThisLoan
          .map(p => p.referenceDate)
          .sort();
        
        const isPaidCell = sortedRefDates.includes(selectedDayStr);

        return {
          loan,
          client: clientDetail?.client || { id: loan.clientId, name: "Cliente", phone: "" },
          paidCount: paymentsOfThisLoan.length,
          totalDays: loan.totalDays,
          isPaidCell,
          clientDetail
        };
      });

    // Received physical payments on this day
    const dynamicPayments = allPayments
      .filter(p => p.paymentDate === selectedDayStr)
      .map(p => {
        const loan = allLoans.find(l => l.id === p.loanId);
        const clientDetail = loan ? clientsWithLoans.find(c => c.client.id === loan.clientId) : null;
        return {
          payment: p,
          loan,
          client: clientDetail?.client || { name: "Consumidor", phone: "" }
        };
      });

    return {
      stats,
      starts,
      collections,
      dynamicPayments
    };
  }, [selectedDayStr, dayStatsMap, allLoans, clientsWithLoans, loanSchedules, allPayments]);

  // 7. General month stats (concentrations)
  const monthSummary = useMemo(() => {
    let totalScheduledMonth = 0;
    let actualCollectedMonth = 0;
    let newContractsMonth = 0;
    let peakDay = "---";
    let peakAmount = 0;

    Object.entries(dayStatsMap).forEach(([dateStr, statsValue]) => {
      const stats = statsValue as {
        expectedAmount: number;
        collectionsCount: number;
        contractsStarted: number;
        paymentsReceived: number;
        actualReceivedAmount: number;
      };
      // Check if day matches current viewing month
      const [y, mStr] = dateStr.split("-");
      const m = parseInt(mStr) - 1;
      if (parseInt(y) === viewYear && m === viewMonth) {
        totalScheduledMonth += stats.expectedAmount;
        actualCollectedMonth += stats.actualReceivedAmount;
        newContractsMonth += stats.contractsStarted;

        if (stats.expectedAmount > peakAmount) {
          peakAmount = stats.expectedAmount;
          peakDay = formatFriendlyDate(dateStr);
        }
      }
    });

    return {
      totalScheduledMonth,
      actualCollectedMonth,
      newContractsMonth,
      peakDay,
      peakAmount
    };
  }, [dayStatsMap, viewYear, viewMonth]);

  const sendWhatsAppDirectCharge = (clientName: string, phone: string, amount: number, dateStr: string) => {
    const formattedPhone = `55${phone.replace(/\D/g, "")}`;
    const dateFormatted = formatFriendlyDate(dateStr);
    const message = `Olá *${clientName}*, hoje (${dateFormatted}) temos o repasse agendado no valor de *R$ ${amount.toFixed(2)}*. 

Por gentileza, realize o envio no PIX lagoscelular5@gmail.com e nos envie o comprovante por aqui. Obrigado!`;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      
      {/* MONTLHY METRIC BANNER (BENTO CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-2xl flex items-center justify-between gap-3 shadow-inner">
          <div className="min-w-0">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Faturamento Previsto ({monthNames[viewMonth]})</span>
            <span className="text-md sm:text-xl font-black text-zinc-100 font-mono tracking-tight mt-1 block">
              {formatBRL(monthSummary.totalScheduledMonth)}
            </span>
          </div>
          <div className="p-2 sm:p-3 bg-yellow-500/10 text-yellow-500 rounded-xl shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-2xl flex items-center justify-between gap-3 shadow-inner">
          <div className="min-w-0">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Liquidez Recebida</span>
            <span className="text-md sm:text-xl font-black text-emerald-400 font-mono tracking-tight mt-1 block">
              {formatBRL(monthSummary.actualCollectedMonth)}
            </span>
          </div>
          <div className="p-2 sm:p-3 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-2xl flex items-center justify-between gap-3 shadow-inner">
          <div className="min-w-0">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Pico de Caixa Agendado</span>
            <span className="text-xs sm:text-sm font-black text-amber-500 tracking-tight mt-1.5 block font-mono">
              {monthSummary.peakDay} <span className="text-[10px] text-zinc-500">({formatBRL(monthSummary.peakAmount)})</span>
            </span>
          </div>
          <div className="p-2 sm:p-3 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-2xl flex items-center justify-between gap-3 shadow-inner">
          <div className="min-w-0">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Registros do Mês</span>
            <span className="text-md sm:text-xl font-black text-yellow-500 font-mono mt-1 block">
              +{monthSummary.newContractsMonth} contratos
            </span>
          </div>
          <div className="p-2 sm:p-3 bg-yellow-500/10 text-yellow-500 rounded-xl shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* CORE GRID: CALENDAR + DETAIL SIDEBAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* CALENDAR MONTH GRID CARD */}
        <div className="lg:col-span-7 bg-[#111113]/40 border border-zinc-850/90 rounded-2xl p-5 space-y-4">
          
          {/* HEADER: MONTH CONTROLS */}
          <div className="flex justify-between items-center bg-zinc-950/50 p-2 rounded-xl border border-zinc-900 select-none">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-yellow-500" />
              <span className="text-xs sm:text-sm font-extrabold text-white">
                {monthNames[viewMonth]} de {viewYear}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => {
                  const today = parseLocalDate(simulationDate);
                  setViewYear(today.getFullYear());
                  setViewMonth(today.getMonth());
                  setSelectedDayStr(simulationDate);
                }}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 rounded text-[9px] uppercase font-bold font-mono transition-colors border border-zinc-800 cursor-pointer"
              >
                Hoje
              </button>
              <button 
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CALENDAR BODY */}
          <div className="space-y-1">
            {/* Week Headers */}
            <div className="grid grid-cols-7 gap-1 border-b border-zinc-900 pb-1.5 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
              <span>Dom</span>
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
            </div>

            {/* Day Cells */}
            <div className="grid grid-cols-7 gap-1.5 pt-1.5">
              {calendarGrid.map((cell, idx) => {
                const { dateStr, dayNum, isCurrentMonth } = cell;
                const stats = dayStatsMap[dateStr] || {
                  expectedAmount: 0,
                  collectionsCount: 0,
                  contractsStarted: 0,
                  paymentsReceived: 0,
                  actualReceivedAmount: 0
                };

                const isToday = dateStr === simulationDate;
                const isSelected = dateStr === selectedDayStr;
                const sunCell = isSunday(dateStr);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayStr(dateStr)}
                    className={`min-h-[64px] sm:min-h-[75px] rounded-xl flex flex-col justify-between p-1.5 text-left border relative transition-all cursor-pointer ${
                      isSelected
                        ? "bg-yellow-500/10 border-yellow-500/70 shadow-[0_0_12px_rgba(234,179,8,0.1)] text-zinc-100 z-10"
                        : isToday
                          ? "bg-zinc-900/90 border-amber-500/40 text-amber-400 font-bold"
                          : isCurrentMonth
                            ? "bg-zinc-950/20 hover:bg-zinc-900/30 border-zinc-900 text-zinc-350"
                            : "bg-zinc-950/5 hover:bg-zinc-950/10 border-zinc-950 text-zinc-600"
                    }`}
                  >
                    {/* Day Number and badges */}
                    <div className="flex justify-between items-start w-full">
                      <span className={`text-[10px] sm:text-xs font-mono font-bold ${sunCell ? "text-red-500/70" : ""}`}>
                        {dayNum}
                      </span>
                      
                      {/* Active contract start badge */}
                      {stats.contractsStarted > 0 && (
                        <span className="w-2 h-2 bg-yellow-500 rounded-full" title="Contrato Iniciando" />
                      )}
                    </div>

                    {/* Daily cash stats */}
                    <div className="w-full text-right mt-1.5 sm:mt-3 font-mono space-y-0.5">
                      {stats.expectedAmount > 0 && (
                        <div className="text-[8px] sm:text-[9px] font-black text-amber-500/90 leading-tight">
                          {formatBRL(stats.expectedAmount)}
                        </div>
                      )}
                      
                      {/* Received indicators */}
                      {stats.actualReceivedAmount > 0 && (
                        <div className="text-[8px] sm:text-[9px] text-emerald-400 font-black leading-tight">
                          ✓ {stats.paymentsReceived}x
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

          </div>

          <p className="text-[9px] text-zinc-550 leading-relaxed font-mono flex items-center gap-1.5 justify-center">
            <span>🔴 Diária com contrato iniciando</span>
            <span>•</span>
            <span className="text-amber-500/90">Amarelo: Valores Previstos</span>
            <span>•</span>
            <span className="text-emerald-400">Verde: Valores Recebidos</span>
          </p>

        </div>

        {/* SELECTED DAY TIMELINE & ACTIONS PANEL */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          <div className="bg-[#111113]/40 border border-zinc-850/90 rounded-2xl p-5 space-y-5 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              
              {/* SELECTED HEADER TITLE */}
              <div className="border-b border-zinc-900 pb-3 flex justify-between items-center select-none">
                <div>
                  <h4 className="font-extrabold text-sm text-zinc-100 tracking-tight">agenda do dia</h4>
                  <span className="font-mono text-[11px] text-zinc-400">{formatFriendlyDate(selectedDayStr)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => onAddNewContractForDate(selectedDayStr)}
                  className="p-1 px-2.5 bg-yellow-500 hover:bg-yellow-405 text-zinc-950 hover:scale-102 flex items-center gap-1 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer shadow-md shadow-yellow-500/10"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  Agendar
                </button>
              </div>

              {/* STATS BREAKDOWN */}
              <div className="grid grid-cols-2 gap-2 text-center py-2.5 bg-zinc-950/30 font-mono rounded-xl border border-zinc-900">
                <div>
                  <span className="text-[8px] text-zinc-550 font-sans block uppercase font-bold tracking-wider">A Receber Diárias</span>
                  <span className="text-xs sm:text-sm font-bold text-amber-500 mt-0.5 block">
                    {formatBRL(selectedDayDetails.stats.expectedAmount)}
                  </span>
                  <span className="text-[9px] text-zinc-500">
                    ({selectedDayDetails.collections.length} cobranças)
                  </span>
                </div>
                <div>
                  <span className="text-[8px] text-zinc-550 font-sans block uppercase font-bold tracking-wider">Total Recebido</span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-400 mt-0.5 block">
                    {formatBRL(selectedDayDetails.stats.actualReceivedAmount)}
                  </span>
                  <span className="text-[9px] text-zinc-500">
                    ({selectedDayDetails.stats.paymentsReceived} físicas)
                  </span>
                </div>
              </div>

              {/* DETAILED TIMELINE LISTINGS */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[290px] pr-1 scrollbar-thin">
                
                {/* 1. CONTRACTS STARTING */}
                {selectedDayDetails.starts.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500 block font-mono">Início de Contratos ({selectedDayDetails.starts.length})</span>
                    <div className="space-y-1.5">
                      {selectedDayDetails.starts.map(({ loan, client }, i) => (
                        <div key={i} className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl flex items-center justify-between text-xs font-mono">
                          <div>
                            <span className="text-zinc-200 font-bold block truncate max-w-[150px]">{client.name}</span>
                            <span className="text-[9px] text-zinc-400">Emprestando {formatBRL(loan.amountInvested)} @ diária R$ {loan.dailyRate}</span>
                          </div>
                          <span className="p-0.5 px-2 bg-yellow-500/20 text-yellow-500 text-[8px] uppercase font-black tracking-wider rounded-lg">Novo</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. SCHEDULED REPAYMENTS DUE */}
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500 block font-mono">Cobranças Agendadas / Diárias do Dia</span>
                  
                  {selectedDayDetails.collections.length === 0 ? (
                    <div className="py-8 text-center bg-zinc-950/20 border border-dashed border-zinc-850 rounded-xl text-zinc-550 text-[10px]">
                      Nenhuma cobrança de diária prevista para este dia.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedDayDetails.collections.map((col, i) => (
                        <div 
                          key={i} 
                          className={`p-3 border rounded-xl flex items-center justify-between gap-4 text-xs font-mono transition-colors ${
                            col.isPaidCell
                              ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-300"
                              : "bg-zinc-900/30 border-zinc-850/80 hover:bg-zinc-900/50"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-zinc-200 font-extrabold truncate block">{col.client.name}</span>
                            <div className="flex items-center gap-2 text-[9px] text-zinc-450 mt-0.5">
                              <span>Parcela diária: <strong className="text-yellow-500">{formatBRL(col.loan.dailyRate)}</strong></span>
                              <span>•</span>
                              <span>Progresso: {col.paidCount}/{col.totalDays}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {col.isPaidCell ? (
                              <span className="p-1 bg-emerald-500/15 text-emerald-400 text-[10px] font-black rounded-lg flex items-center gap-0.5 font-mono">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                PAGO
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => sendWhatsAppDirectCharge(col.client.name, col.client.phone, col.loan.dailyRate, selectedDayStr)}
                                  className="p-1.5 bg-yellow-500 hover:bg-yellow-405 text-zinc-950 rounded-lg transition-transform cursor-pointer"
                                  title="Enviar Lembrete WhatsApp"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. PHYSICAL PAYMENTS MADE ON THIS DAY */}
                {selectedDayDetails.dynamicPayments.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500 block font-mono">Recibos Financeiros Registrados Hoje</span>
                    <div className="space-y-1.5">
                      {selectedDayDetails.dynamicPayments.map(({ payment, loan, client }, i) => (
                        <div key={i} className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center justify-between text-[11px] font-mono font-bold leading-normal text-emerald-400">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-emerald-500/10 rounded-md">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-zinc-200 font-extrabold block">{client.name}</span>
                              <span className="text-[9px] text-emerald-500/80">Pago em dinheiro via PIX</span>
                            </div>
                          </div>
                          <span className="text-xs font-black">{formatBRL(payment.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

            </div>

            {/* LOWER ASSIST INSIGHTS */}
            <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl mt-4">
              <span className="text-[9px] text-zinc-550 block uppercase font-extrabold font-mono tracking-widest">⚡ INTELIGÊNCIA EXECUTIVA FINANCEIRA</span>
              <p className="text-[10px] text-zinc-400 mt-1 leading-normal font-mono text-justify">
                Esta <strong>Agenda Inteligente</strong> consolida a concentração e projeção de caixa em tempo de execução real do sistema. Clique em qualquer célula do mês para analisar e efetuar cobranças rápidas!
              </p>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
