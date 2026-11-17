import React, { useMemo, useState } from "react";
import { ClientWithLoanDetails, Loan, Payment } from "../types";
import { formatFriendlyDate } from "../utils/dateUtils";
import { getLoanFrequencyBadge, getLoanScheduledDates } from "../utils/loanSchedule";
import {
  buildPaymentReceiptText,
  buildWhatsAppUrl,
  formatWhatsAppPhone,
  getDisplayCoverageDate,
  getNextDueDateAfterPayment
} from "../utils/whatsappReceipt";
import {
  Sun,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Check,
  TrendingUp,
  AlertTriangle
} from "lucide-react";

const roundBRL = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

interface DailyCollectionPanelProps {
  clientsWithLoans: ClientWithLoanDetails[];
  allLoans: Loan[];
  allPayments: Payment[];
  targetDate: string;
  onMarkPaidToday: (loanId: string) => Promise<Payment[] | void>;
  isLoading?: boolean;
}

export const DailyCollectionPanel: React.FC<DailyCollectionPanelProps> = ({
  clientsWithLoans,
  allLoans,
  allPayments,
  targetDate,
  onMarkPaidToday,
  isLoading = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [payingLoanId, setPayingLoanId] = useState<string | null>(null);

  const formatBRL = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);

  const summary = useMemo(() => {
    const activeClientIds = new Set(clientsWithLoans.map(c => c.client.id));
    const activeLoanIds = new Set(
      allLoans.filter(l => activeClientIds.has(l.clientId)).map(l => l.id)
    );

    const morningItems: {
      detail: ClientWithLoanDetails;
      loan: Loan;
      dailyRate: number;
      paidToday: boolean;
      paidTodayAmount: number;
    }[] = [];

    let morningTotal = 0;

    clientsWithLoans.forEach(detail => {
      const loan = detail.activeLoan;
      if (!loan || loan.status === "completed" || detail.client.archived) return;

      // Build scheduled dates for this contract (diária, semanal, quinzenal ou mensal)
      const scheduledDates = getLoanScheduledDates(loan);

      const isScheduledToday = scheduledDates.includes(targetDate);
      if (!isScheduledToday) return;

      const expectedUpToToday = scheduledDates.filter(d => d <= targetDate).length;
      const paymentsBeforeToday = detail.payments.filter(p => p.paymentDate < targetDate).length;

      // Morning Rule: 1 daily installment for today (NEVER sums overdue installments from previous days)
      if (paymentsBeforeToday < expectedUpToToday) {
        morningTotal = roundBRL(morningTotal + loan.dailyRate);
        const paidTodayList = detail.payments.filter(p => p.paymentDate === targetDate);
        const paidTodayAmount = roundBRL(paidTodayList.reduce((sum, p) => sum + p.amount, 0));
        morningItems.push({
          detail,
          loan,
          dailyRate: loan.dailyRate,
          paidToday: paidTodayList.length > 0,
          paidTodayAmount
        });
      }
    });

    // All payments physically received on targetDate
    const todayPayments = allPayments.filter(
      p => p.paymentDate === targetDate && activeLoanIds.has(p.loanId)
    );
    const receivedTodayTotal = roundBRL(todayPayments.reduce((sum, p) => sum + p.amount, 0));

    // Extra / overdue payments received today from clients not in morning list
    const morningLoanIds = new Set(morningItems.map(m => m.loan.id));
    type ExtraClientPayment = { loanId: string; clientName: string; amount: number; count: number };
    const extraTodayClients = todayPayments
      .filter(p => !morningLoanIds.has(p.loanId))
      .reduce((acc: ExtraClientPayment[], p) => {
        const existing = acc.find(item => item.loanId === p.loanId);
        if (existing) {
          existing.amount = roundBRL(existing.amount + p.amount);
          existing.count += 1;
        } else {
          const loan = allLoans.find(l => l.id === p.loanId);
          const client = loan ? clientsWithLoans.find(c => c.client.id === loan.clientId)?.client : undefined;
          acc.push({
            loanId: p.loanId,
            clientName: client?.name || "Cliente",
            amount: p.amount,
            count: 1
          });
        }
        return acc;
      }, []);

    // Sum remaining today strictly across scheduled morning clients so extra/overdue payments never distort other clients' open amounts
    const remainingToday = roundBRL(
      morningItems.reduce((sum, m) => sum + Math.max(0, roundBRL(m.dailyRate - m.paidTodayAmount)), 0)
    );
    const morningCollectedPortion = roundBRL(Math.max(0, morningTotal - remainingToday));
    const surplusToday = roundBRL(Math.max(0, receivedTodayTotal - morningCollectedPortion));
    const progressPct = morningTotal > 0 ? Math.min(100, (morningCollectedPortion / morningTotal) * 100) : 0;

    const pendingMorning = morningItems.filter(m => !m.paidToday);
    const paidMorning = morningItems.filter(m => m.paidToday);

    return {
      morningTotal,
      morningCount: morningItems.length,
      receivedTodayTotal,
      receivedTodayCount: todayPayments.length,
      remainingToday,
      surplusToday,
      progressPct,
      pendingMorning,
      paidMorning,
      extraTodayClients
    };
  }, [clientsWithLoans, allLoans, allPayments, targetDate]);

  const handleQuickPay = async (detail: ClientWithLoanDetails, loan: Loan) => {
    if (payingLoanId) return;
    const hasPhone = Boolean(formatWhatsAppPhone(detail.client.phone));
    const waWin = hasPhone ? window.open("", "_blank") : null;
    setPayingLoanId(loan.id);
    try {
      const result = await onMarkPaidToday(loan.id);
      const persisted = Array.isArray(result) ? result : [];
      const registeredCount = persisted.length > 0 ? persisted.length : 1;
      const newPaidCount = Math.min(loan.totalDays, detail.paidCount + registeredCount);
      const rawRef =
        persisted.length > 0
          ? persisted[persisted.length - 1].referenceDate
          : targetDate;
      const displayRef = getDisplayCoverageDate(loan, rawRef);
      const nextDue = getNextDueDateAfterPayment(loan, newPaidCount, rawRef);
      const amountPaid =
        persisted.length > 0
          ? roundBRL(persisted.reduce((sum, p) => sum + p.amount, 0))
          : loan.dailyRate;

      const receiptMsg = buildPaymentReceiptText({
        clientName: detail.client.name,
        loan,
        paidCount: newPaidCount,
        totalDays: loan.totalDays,
        paymentDate: targetDate,
        referenceDate: displayRef,
        nextDueDate: nextDue,
        amountPaid
      });
      const whatsappUrl = buildWhatsAppUrl(detail.client.phone, receiptMsg);
      if (whatsappUrl) {
        if (waWin && !waWin.closed) {
          waWin.location.href = whatsappUrl;
        } else {
          window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        }
      } else if (waWin && !waWin.closed) {
        waWin.close();
      }
    } catch (err) {
      if (waWin && !waWin.closed) {
        waWin.close();
      }
      throw err;
    } finally {
      setPayingLoanId(null);
    }
  };

  return (
    <section
      id="daily-collection-panel"
      aria-label="Caixa do Dia"
      className="bg-zinc-950/60 border border-zinc-800/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg select-none"
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-500">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-100">
                Recebimentos do Dia • {formatFriendlyDate(targetDate)}
              </h2>
              <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                Sem atrasados
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Meta fixa da manhã para hoje vs. pagamentos marcados como pagos no dia
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[11px] font-bold text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>
            {isExpanded ? "Ocultar Lista do Dia" : `Clientes do Dia (${summary.morningCount})`}
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-yellow-500" /> : <ChevronDown className="w-3.5 h-3.5 text-yellow-500" />}
        </button>
      </div>

      {/* 3 Main Daily Cards Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* 1. PARA RECEBER NO DIA (TOTAL DA MANHÃ SEM ATRASADOS) */}
        <div className="bg-zinc-900/50 border border-yellow-500/25 rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-yellow-500 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5" />
              Para Receber no Dia (Manhã)
            </span>
            <span className="text-[10px] font-mono font-bold text-zinc-400">
              {summary.morningCount} {summary.morningCount === 1 ? "cliente" : "clientes"}
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
              {formatBRL(summary.morningTotal)}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Total agendado para hoje (diária, semanal, quinzenal e mensal, sem atrasadas)
            </p>
          </div>
        </div>

        {/* 2. JÁ RECEBIDO NO DIA (PAGOS) */}
        <div className="bg-zinc-900/50 border border-emerald-500/25 rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Já Recebi no Dia (Pagos)
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-400/90">
              {summary.receivedTodayCount} {summary.receivedTodayCount === 1 ? "baixa" : "baixas"}
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 tracking-tight">
              {formatBRL(summary.receivedTodayTotal)}
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">
              Soma real das parcelas marcadas como pagas hoje
            </p>
          </div>
        </div>

        {/* 3. FALTA RECEBER NESTE DIA */}
        <div
          className={`bg-zinc-900/50 border rounded-xl p-4 flex flex-col justify-between gap-2 transition-colors ${
            summary.remainingToday === 0 && summary.morningTotal > 0
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-sky-500/25"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                summary.remainingToday === 0 && summary.morningTotal > 0
                  ? "text-emerald-400"
                  : "text-sky-400"
              }`}
            >
              {summary.remainingToday === 0 && summary.morningTotal > 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
              Falta Receber Neste Dia
            </span>
            <span className="text-[10px] font-mono font-bold text-zinc-400">
              {Math.round(summary.progressPct)}% do dia
            </span>
          </div>

          <div>
            <div
              className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                summary.remainingToday === 0 && summary.morningTotal > 0
                  ? "text-emerald-400"
                  : "text-sky-400"
              }`}
            >
              {formatBRL(summary.remainingToday)}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  summary.remainingToday === 0 && summary.morningTotal > 0
                    ? "bg-emerald-500"
                    : "bg-sky-400"
                }`}
                style={{ width: `${summary.progressPct}%` }}
              />
            </div>

            <p className="text-[10px] text-zinc-500 mt-1.5">
              {summary.morningTotal === 0
                ? summary.surplusToday > 0
                  ? `+${formatBRL(summary.surplusToday)} recebido em atrasos/adiantamentos`
                  : "Nenhuma parcela agendada para hoje"
                : summary.remainingToday === 0
                  ? summary.surplusToday > 0
                    ? `Meta do dia batida! (+${formatBRL(summary.surplusToday)} em atrasos/adiantamentos)`
                    : "100% dos valores do dia recebidos!"
                  : summary.surplusToday > 0
                    ? `${summary.pendingMorning.length} cliente(s) em aberto (+${formatBRL(summary.surplusToday)} extras recebidos)`
                    : `${summary.pendingMorning.length} cliente(s) de hoje ainda em aberto`}
            </p>
          </div>
        </div>
      </div>

      {/* Expandable Daily Clients Quick-Pay Drawer */}
      {isExpanded && (
        <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
          {/* Pending Today */}
          <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                Falta Pagar Hoje ({summary.pendingMorning.length})
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {formatBRL(summary.pendingMorning.reduce((s, m) => s + m.dailyRate, 0))}
              </span>
            </div>

            {summary.pendingMorning.length === 0 ? (
              <div className="py-5 text-center text-[11px] text-zinc-500 font-mono">
                Todos os clientes previstos para hoje já pagaram!
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {summary.pendingMorning.map(({ detail, loan, dailyRate }) => (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between gap-2 p-2.5 bg-zinc-950/60 border border-zinc-850 rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-zinc-100 truncate">
                          {detail.client.name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded font-mono font-bold shrink-0">
                          {getLoanFrequencyBadge(loan)}
                        </span>
                        {detail.isDelayed && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400 rounded font-mono font-bold flex items-center gap-0.5 shrink-0">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            -{detail.daysBehind}x
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">
                        Parcela do dia: <strong className="text-yellow-500">{formatBRL(dailyRate)}</strong> ({detail.paidCount}/{detail.totalDays})
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isLoading || payingLoanId === loan.id}
                      onClick={() => handleQuickPay(detail, loan)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-[11px] rounded-lg flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      {payingLoanId === loan.id ? "Salvando..." : "Pago"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Already Paid Today */}
          <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                Pagos Hoje ({summary.paidMorning.length + summary.extraTodayClients.length})
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                {formatBRL(summary.receivedTodayTotal)}
              </span>
            </div>

            {summary.paidMorning.length === 0 && summary.extraTodayClients.length === 0 ? (
              <div className="py-5 text-center text-[11px] text-zinc-500 font-mono">
                Nenhum pagamento marcado como pago hoje ainda.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {summary.paidMorning.map(({ detail, loan, paidTodayAmount }) => (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between gap-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-zinc-100 truncate block">
                        {detail.client.name}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400/80">
                        Progresso: {detail.paidCount}/{detail.totalDays} pagas
                      </span>
                    </div>
                    <span className="text-xs font-black font-mono text-emerald-400 shrink-0">
                      +{formatBRL(paidTodayAmount)}
                    </span>
                  </div>
                ))}
                {summary.extraTodayClients.map(extra => (
                  <div
                    key={`extra-${extra.loanId}`}
                    className="flex items-center justify-between gap-2 p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-zinc-100 truncate block">
                        {extra.clientName}
                      </span>
                      <span className="text-[10px] font-mono text-amber-400/90">
                        Baixa extra / atrasado ({extra.count}x)
                      </span>
                    </div>
                    <span className="text-xs font-black font-mono text-emerald-400 shrink-0">
                      +{formatBRL(extra.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
