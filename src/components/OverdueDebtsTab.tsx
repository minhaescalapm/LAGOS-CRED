import React, { useMemo, useState } from "react";
import { ClientWithLoanDetails, Payment } from "../types";
import { formatFriendlyDate, getTodayStr } from "../utils/dateUtils";
import {
  FREQUENCY_LABELS,
  FREQUENCY_UNIT_PLURAL,
  getLoanFrequency,
  getLoanFrequencyBadge
} from "../utils/loanSchedule";
import { buildWhatsAppUrl, formatWhatsAppPhone } from "../utils/whatsappReceipt";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Search,
  Send,
  Smartphone,
  ArrowUpDown,
  CalendarDays
} from "lucide-react";

interface OverdueDebtsTabProps {
  clientsWithLoans: ClientWithLoanDetails[];
  targetDate?: string;
  onOpenPixModal: (clientName: string) => void;
  onIncrementCharge?: (clientId: string) => void;
  onRegisterPayment?: (
    loanId: string,
    count: number,
    dateStr: string,
    customReferenceDate?: string
  ) => Promise<Payment[] | void>;
  onSelectClientInDirectory?: (clientName: string) => void;
  isLoading?: boolean;
}

const roundBRL = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

export const OverdueDebtsTab: React.FC<OverdueDebtsTabProps> = ({
  clientsWithLoans,
  targetDate,
  onOpenPixModal,
  onIncrementCharge,
  onRegisterPayment,
  onSelectClientInDirectory,
  isLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"BEHIND" | "AMOUNT" | "NAME">("BEHIND");
  const [payingLoanId, setPayingLoanId] = useState<string | null>(null);

  const effectiveToday = targetDate || getTodayStr();

  const formatBRL = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);

  const overdueList = useMemo(() => {
    const filtered = clientsWithLoans.filter(
      c =>
        c.activeLoan &&
        c.activeLoan.status !== "completed" &&
        !c.client.archived &&
        c.isDelayed &&
        c.daysBehind >= 1 &&
        c.paidCount < c.totalDays
    );

    const mapped = filtered.map(detail => {
      const loan = detail.activeLoan!;
      const overdueInstallments = Math.min(detail.daysBehind, Math.max(0, detail.totalDays - detail.paidCount));
      const overdueAmount = roundBRL(overdueInstallments * loan.dailyRate);
      const totalRemainingInstallments = Math.max(0, detail.totalDays - detail.paidCount);
      const totalRemainingAmount = roundBRL(totalRemainingInstallments * loan.dailyRate);
      return {
        detail,
        loan,
        overdueInstallments,
        overdueAmount,
        totalRemainingInstallments,
        totalRemainingAmount
      };
    });

    const query = searchTerm.trim().toLowerCase();
    const searched = query
      ? mapped.filter(
          item =>
            item.detail.client.name.toLowerCase().includes(query) ||
            item.detail.client.phone.toLowerCase().includes(query)
        )
      : mapped;

    searched.sort((a, b) => {
      if (sortBy === "AMOUNT") {
        return b.overdueAmount - a.overdueAmount || b.overdueInstallments - a.overdueInstallments;
      }
      if (sortBy === "NAME") {
        return a.detail.client.name.localeCompare(b.detail.client.name);
      }
      return b.overdueInstallments - a.overdueInstallments || b.overdueAmount - a.overdueAmount;
    });

    return searched;
  }, [clientsWithLoans, searchTerm, sortBy]);

  const totals = useMemo(() => {
    return overdueList.reduce(
      (acc, item) => {
        acc.clientsCount += 1;
        acc.installmentsCount += item.overdueInstallments;
        acc.overdueAmount = roundBRL(acc.overdueAmount + item.overdueAmount);
        acc.totalOpenAmount = roundBRL(acc.totalOpenAmount + item.totalRemainingAmount);
        return acc;
      },
      { clientsCount: 0, installmentsCount: 0, overdueAmount: 0, totalOpenAmount: 0 }
    );
  }, [overdueList]);

  const handleDirectWhatsAppCharge = (
    detail: ClientWithLoanDetails,
    overdueInstallments: number,
    overdueAmount: number
  ) => {
    if (!detail.activeLoan) return;
    const loan = detail.activeLoan;
    const phone = formatWhatsAppPhone(detail.client.phone);
    if (!phone) return;

    onIncrementCharge?.(detail.client.id);

    const freq = getLoanFrequency(loan);
    const unitPlural = FREQUENCY_UNIT_PLURAL[freq];
    const lastDateFormatted = detail.referenceDate
      ? formatFriendlyDate(detail.referenceDate)
      : formatFriendlyDate(loan.startDate);
    const todayFormatted = formatFriendlyDate(effectiveToday);
    const remainingTotal = Math.max(0, detail.totalDays - detail.paidCount);

    const message = `Olá *${detail.client.name}*, tudo bem?
Passando para lembrar das suas *${overdueInstallments} ${
      overdueInstallments === 1 ? "prestação atrasada" : "prestações atrasadas"
    }* (${FREQUENCY_LABELS[freq].toLowerCase()}) no contrato *${getLoanFrequencyBadge(loan)}*.

⚠️ *DÍVIDA EM ATRASO:*
- Prestações em atraso: *${overdueInstallments}x de ${formatBRL(loan.dailyRate)}*
- Valor total atrasado: *${formatBRL(overdueAmount)}*
- Progresso atual: *${detail.paidCount} de ${detail.totalDays} pagas* (faltam ${remainingTotal} ${
      remainingTotal === 1 ? "parcela" : unitPlural
    } no contrato)
- Última parcela paga/atualizada em: *${lastDateFormatted}* _(apurado até ${todayFormatted})_

🔑 *Chave Pix para acerto:*
*lagoscelular5@gmail.com*

Faça seu pagamento para regularizar o seu cadastro e evitar restrições para novas renovações. Qualquer dúvida estou à disposição!`;

    const url = buildWhatsAppUrl(detail.client.phone, message);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handlePayOneOverdue = async (loanId: string) => {
    if (!onRegisterPayment || payingLoanId) return;
    setPayingLoanId(loanId);
    try {
      await onRegisterPayment(loanId, 1, effectiveToday);
    } finally {
      setPayingLoanId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in select-none">
      {/* KPIs DE DÍVIDAS EM ATRASO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-zinc-950/60 border border-red-500/25 rounded-2xl p-4">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-400 block">
            Clientes em Atraso
          </span>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {totals.clientsCount}
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">Com prestações vencidas</p>
        </div>

        <div className="bg-zinc-950/60 border border-amber-500/25 rounded-2xl p-4">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block">
            Prestações Atrasadas
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {totals.installmentsCount}x
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">Total de parcelas vencidas</p>
        </div>

        <div className="bg-zinc-950/60 border border-red-500/30 rounded-2xl p-4">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-400 block">
            Valor Atrasado Total
          </span>
          <div className="text-2xl font-black font-mono text-red-400 mt-1">
            {formatBRL(totals.overdueAmount)}
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">Soma só das parcelas vencidas</p>
        </div>

        <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">
            Saldo Total dos Devedores
          </span>
          <div className="text-2xl font-black font-mono text-zinc-200 mt-1">
            {formatBRL(totals.totalOpenAmount)}
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5">Todo saldo restante desses contratos</p>
        </div>
      </div>

      {/* BARRA DE BUSCA E ORDENAÇÃO */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-3.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar devedor por nome ou telefone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/70 border border-zinc-800 focus:border-amber-500 focus:outline-none rounded-xl py-2 pl-10 pr-4 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1 mr-1">
            <ArrowUpDown className="w-3 h-3" />
            Ordenar:
          </span>
          {[
            { id: "BEHIND", label: "Mais atrasadas" },
            { id: "AMOUNT", label: "Maior dívida" },
            { id: "NAME", label: "Nome (A-Z)" }
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSortBy(opt.id as "BEHIND" | "AMOUNT" | "NAME")}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                sortBy === opt.id
                  ? "bg-amber-500 text-zinc-950 border-amber-500"
                  : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* LISTA DE DEVEDORES E COBRANÇA DIRETA NO WHATSAPP */}
      {overdueList.length === 0 ? (
        <div className="bg-zinc-950/40 border border-zinc-800 border-dashed rounded-2xl py-14 px-6 text-center flex flex-col items-center">
          <div className="p-3.5 bg-emerald-500/10 rounded-full text-emerald-400 mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-black text-white">Nenhuma dívida em atraso encontrada</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-md">
            {searchTerm
              ? "Nenhum cliente em atraso corresponde à sua pesquisa."
              : "Todos os contratos ativos estão em dia até o momento."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {overdueList.map(({ detail, loan, overdueInstallments, overdueAmount, totalRemainingInstallments, totalRemainingAmount }) => {
            const hasPhone = Boolean(formatWhatsAppPhone(detail.client.phone));
            return (
              <div
                key={loan.id}
                className="bg-zinc-950/60 border border-amber-500/25 hover:border-amber-500/45 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onSelectClientInDirectory?.(detail.client.name)}
                      className="text-sm sm:text-base font-black text-white hover:text-yellow-400 transition-colors text-left cursor-pointer"
                      title="Ver ficha completa na aba Clientes"
                    >
                      {detail.client.name}
                    </button>
                    <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-yellow-400 text-[10px] font-bold rounded font-mono">
                      {getLoanFrequencyBadge(loan)}
                    </span>
                    <span className="px-2.5 py-0.5 bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-black rounded-lg font-mono flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {overdueInstallments} {overdueInstallments === 1 ? "prestação atrasada" : "prestações atrasadas"}
                    </span>
                    {detail.chargeCountToday && detail.chargeCountToday > 0 ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-mono font-bold rounded-lg">
                        Cobrado {detail.chargeCountToday}x hoje
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-zinc-400">
                    <span>
                      Tel:{" "}
                      <strong className="text-zinc-200">
                        {detail.client.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
                      </strong>
                    </span>
                    <span>
                      Parcela: <strong className="text-yellow-400">{formatBRL(loan.dailyRate)}</strong>
                    </span>
                    <span>
                      Total Atrasado: <strong className="text-red-400">{formatBRL(overdueAmount)}</strong>
                    </span>
                    <span>
                      Pagas: <strong className="text-white">{detail.paidCount}/{detail.totalDays}</strong>{" "}
                      <span className="text-zinc-500">(faltam {totalRemainingInstallments}x • {formatBRL(totalRemainingAmount)})</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-zinc-500">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3 text-amber-500/80" />
                      Última atualização: <strong className="text-amber-400">{formatFriendlyDate(detail.referenceDate || loan.startDate)}</strong>
                    </span>
                    {detail.nextDueDate && (
                      <span>
                        Vencida desde: <strong className="text-zinc-300">{formatFriendlyDate(detail.nextDueDate)}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* AÇÕES DIRETAS DE COBRANÇA E BAIXA */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={!hasPhone}
                    onClick={() => handleDirectWhatsAppCharge(detail, overdueInstallments, overdueAmount)}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/15 transition-all cursor-pointer"
                    title={hasPhone ? "Enviar cobrança direta no WhatsApp com prestações atrasadas" : "Cliente sem telefone válido"}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Cobrar no WhatsApp</span>
                  </button>

                  {onRegisterPayment && (
                    <button
                      type="button"
                      disabled={isLoading || payingLoanId === loan.id}
                      onClick={() => handlePayOneOverdue(loan.id)}
                      className="px-3 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Dar baixa em 1 prestação atrasada"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{payingLoanId === loan.id ? "Salvando..." : "Baixar 1x"}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenPixModal(detail.client.name)}
                    className="px-3 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/25 text-yellow-400 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Copiar chave Pix"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Pix</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
