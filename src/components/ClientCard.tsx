import React, { useState } from "react";
import { ClientWithLoanDetails } from "../types";
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Smartphone, 
  Copy, 
  CalendarDays,
  PlusCircle,
  Check,
  Trash2,
  Pencil,
  Send,
  Sliders,
  CalendarDays as CalendarDaysIcon
} from "lucide-react";
import { formatFriendlyDate, addDays, getTodayStr, getRetroactiveStartDate, getElapsedDaysExcludingSundays, isSunday } from "../utils/dateUtils";

interface ClientCardProps {
  clientDetail: ClientWithLoanDetails;
  onRegisterPayment: (loanId: string, count: number, dateStr: string) => void;
  onOpenPixModal: (clientName: string) => void;
  onDeleteClient: (clientId: string) => void;
  onEditClient?: (clientDetail: ClientWithLoanDetails) => void;
  onAdjustLoan?: (loanId: string, targetPaidCount: number, targetStartDate: string) => void;
  onToggleSunday?: (loanId: string) => void;
  onCopyContract?: (clientDetail: ClientWithLoanDetails) => void;
}

export const ClientCard: React.FC<ClientCardProps> = ({ 
  clientDetail, 
  onRegisterPayment, 
  onOpenPixModal,
  onDeleteClient,
  onEditClient,
  onAdjustLoan,
  onToggleSunday,
  onCopyContract
}) => {
  const { client, activeLoan, paidCount, totalDays, referenceDate, isDelayed, daysBehind } = clientDetail;

  const [isExpandingPay, setIsExpandingPay] = useState(false);
  const [payDaysCount, setPayDaysCount] = useState<number>(1);
  const [paymentDate, setPaymentDate] = useState(() => getTodayStr());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // States for Contract Adjustments
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustedPaidCount, setAdjustedPaidCount] = useState(paidCount);
  const [adjustedStartDate, setAdjustedStartDate] = useState(() => activeLoan?.startDate || getTodayStr());

  // Synchronize when parent triggers update/save
  React.useEffect(() => {
    setAdjustedPaidCount(paidCount);
  }, [paidCount]);

  React.useEffect(() => {
    if (activeLoan) {
      setAdjustedStartDate(activeLoan.startDate);
    }
  }, [activeLoan?.startDate]);

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoan || !onAdjustLoan) return;
    try {
      await onAdjustLoan(activeLoan.id, adjustedPaidCount, adjustedStartDate);
      setIsAdjusting(false);
    } catch (err) {
      console.error("Erro ao reajustar parcelas e data:", err);
    }
  };

  // Smart Calculations for instant preview & single-button adjustments
  const isExcludingSundays = activeLoan ? activeLoan.excludeSundays !== false : true;
  const computedRetroStartDate = activeLoan 
    ? addDays(getRetroactiveStartDate(getTodayStr(), adjustedPaidCount, isExcludingSundays), -1) 
    : getTodayStr();
  const elapsedDaysBack = activeLoan 
    ? getElapsedDaysExcludingSundays(addDays(adjustedStartDate, 1), getTodayStr(), isExcludingSundays) 
    : 0;
  const expectedPaidCount = activeLoan ? Math.max(0, Math.min(elapsedDaysBack, totalDays)) : 0;

  // Generate all scheduled dates for the active loan
  const allScheduledDates = React.useMemo(() => {
    if (!activeLoan) return [];
    const dates: string[] = [];
    let current = addDays(activeLoan.startDate, 1);
    const isExcluding = activeLoan.excludeSundays !== false;
    let added = 0;
    let iterations = 0;
    while (added < activeLoan.totalDays && iterations < 1000) {
      iterations++;
      if (!isExcluding || !isSunday(current)) {
        dates.push(current);
        added++;
      }
      current = addDays(current, 1);
    }
    return dates;
  }, [activeLoan]);

  // The first paidCount schedules are already paid. The rest are unpaid!
  const unpaidSchedules = React.useMemo(() => {
    return allScheduledDates.slice(paidCount);
  }, [allScheduledDates, paidCount]);

  const [selectedUnpaidDates, setSelectedUnpaidDates] = React.useState<string[]>([]);

  // Automatically pre-select late dates or the first single upcoming unpaid date
  React.useEffect(() => {
    if (activeLoan && unpaidSchedules.length > 0) {
      const today = getTodayStr();
      const lateDates = unpaidSchedules.filter(d => d <= today);
      if (lateDates.length > 0) {
        setSelectedUnpaidDates(lateDates);
      } else {
        setSelectedUnpaidDates([unpaidSchedules[0]]);
      }
    } else {
      setSelectedUnpaidDates([]);
    }
  }, [unpaidSchedules, activeLoan]);

  // Sincronizar contador de parcelas com as datas marcadas interativamente
  React.useEffect(() => {
    if (selectedUnpaidDates.length > 0) {
      setPayDaysCount(selectedUnpaidDates.length);
    } else {
      setPayDaysCount(1);
    }
  }, [selectedUnpaidDates]);

  // Show temporary Whatsapp Button for the most recent payload
  const [showWhatsappReceipt, setShowWhatsappReceipt] = useState(false);
  const [lastReceiptDetails, setLastReceiptDetails] = useState<{ x: number; y: number } | null>(null);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);
  };

  // Handler for sending exact WhatsApp billing message (Step 5 template)
  const handleWhatsAppCharge = () => {
    if (!activeLoan) return;
    const formattedPhone = `55${client.phone.replace(/\D/g, "")}`;
    const dateFormatted = paidCount > 0 
      ? formatFriendlyDate(referenceDate) 
      : "Nenhuma diária paga";

    // List of selected dates
    const selectedDaysText = selectedUnpaidDates.length > 0
      ? selectedUnpaidDates
          .map((d, idx) => {
            const isToday = d === getTodayStr();
            const dateLabel = formatFriendlyDate(d);
            const displayIndex = paidCount + unpaidSchedules.indexOf(d) + 1;
            return `• *Diária #${displayIndex} (${dateLabel})* ${isToday ? "_(Hoje)_" : ""}: R$ ${activeLoan.dailyRate.toFixed(2)}`;
          })
          .join("\n")
      : `• *Nova Diária*: R$ ${activeLoan.dailyRate.toFixed(2)}`;

    const totalSelectedAmount = (selectedUnpaidDates.length > 0 ? selectedUnpaidDates.length : 1) * activeLoan.dailyRate;

    const messageTemplate = `Olá *${client.name}*, tudo bem?
Passando para lembrar das parcelas diárias pendentes do seu contrato no valor individual de *R$ ${activeLoan.dailyRate.toFixed(2)}*.

📊 *Seu Resumo Geral:*
Progresso do Contrato: *${paidCount} de ${totalDays} pagas*
Sua última diária paga foi em: *${dateFormatted}*

🗓️ *Parcelas em aberto selecionadas para acerto:*
${selectedDaysText}

*Valor total desta cobrança:* 👇
🚨 *R$ ${totalSelectedAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*

🔑 *Nossa Chave Pix (E-mail):*
lagoscelular5@gmail.com

ESTAREMOS À DISPOSIÇÃO. Não fique em atraso, para não criar dificuldade ao simular um novo valor. Obrigado!`;

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageTemplate)}`;
    window.open(url, "_blank");
  };

  if (!activeLoan) {
    // Non-active contract state card
    return (
      <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between min-h-[160px] relative select-none">
        <div>
          <div className="flex justify-between items-start">
            <h4 className="font-bold text-white text-xs sm:text-sm">{client.name}</h4>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1 bg-red-950/40 border border-red-500/30 rounded p-1 animate-fade-in select-none">
                <span className="text-[8px] text-red-400 font-extrabold uppercase mr-1">Deletar?</span>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteClient(client.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="px-1.5 py-0.5 bg-red-600 hover:bg-red-505 text-white font-black text-[9px] rounded-md cursor-pointer transition-all"
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-1.5 py-0.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-black text-[9px] rounded-md cursor-pointer transition-all"
                >
                  Não
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEditClient?.(clientDetail)}
                  className="p-1 text-zinc-550 hover:text-yellow-500 rounded transition-colors cursor-pointer"
                  title="Editar cliente"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1 text-zinc-550 hover:text-red-500 rounded transition-colors cursor-pointer"
                  title="Excluir cliente"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <p className="text-zinc-500 text-[11px] mt-1 font-mono">
            Tel: {client.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
          </p>
        </div>
        <div className="mt-4 p-3 bg-zinc-900/40 rounded-xl border border-zinc-800 border-dashed text-center">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Sem empréstimo ativo</span>
        </div>
      </div>
    );
  }

  // Calculate percentage progress of paid daily rates
  const progressRatio = totalDays > 0 ? (paidCount / totalDays) * 100 : 0;
  const isFullyPaid = paidCount >= totalDays;

  // Predict new reference date if we added payDaysCount days
  const getPredictedRefDate = (startRef: string | null, count: number, excludeSundays: boolean) => {
    let currentRef = startRef || (activeLoan ? activeLoan.startDate : getTodayStr());
    for (let i = 0; i < count; i++) {
      currentRef = addDays(currentRef, 1);
      if (excludeSundays && isSunday(currentRef)) {
        currentRef = addDays(currentRef, 1);
      }
    }
    return currentRef;
  };
  const predictedNewReferenceDate = getPredictedRefDate(referenceDate, payDaysCount, isExcludingSundays);

  // Trigger registration
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegisterPayment(activeLoan.id, payDaysCount, paymentDate);
    
    // Configure Whatsapp Receipt values
    setLastReceiptDetails({
      x: paidCount + payDaysCount,
      y: totalDays
    });
    setShowWhatsappReceipt(true);
    setIsExpandingPay(false);
  };

  // WhatsApp receipt generator
  const handleSendReceipt = () => {
    if (!lastReceiptDetails) return;
    
    const formattedPhone = `55${client.phone.replace(/\D/g, "")}`;
    const today = new Date();
    const formattedToday = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

    const receiptMsg = `Olá *${client.name}*, pagamento registrado com sucesso em *${formattedToday}*!
Progresso: *${lastReceiptDetails.x} de ${lastReceiptDetails.y} pagas*.

ESTAREMOS À DISPOSIÇÃO. Não fique em atraso, não crie dificuldade para pegar um novo valor quando precisar.`;

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(receiptMsg)}`;
    window.open(url, "_blank");
    setShowWhatsappReceipt(false);
  };

  return (
    <div 
      className={`bg-zinc-950/40 border ${
        isFullyPaid 
          ? "border-yellow-500/20 bg-yellow-550/5 shadow-[0_4px_12px_rgba(234,179,8,0.02)]" 
          : isDelayed 
            ? "border-amber-500/30 bg-amber-550/5" 
            : "border-zinc-800/85 hover:border-yellow-500/40"
      } rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-300 relative select-none`}
    >
      {/* TOP: CLIENT NAME AND QUICK STATS */}
      <div>
        <div className="flex justify-between items-start gap-2">
          <div>
            <h4 className="font-bold text-white text-xs sm:text-sm leading-tight group-hover:text-yellow-500 transition-colors">
              {client.name}
            </h4>
            <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">
              Tel: {client.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
            </span>
          </div>

          <div className="flex items-center gap-1.5 self-start">
            {/* Status indicator pill */}
            {isFullyPaid ? (
              <span className="p-1 px-2 bg-yellow-500/10 text-yellow-500 rounded-lg text-[9px] font-extrabold font-mono flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-yellow-500" />
                CONCLUÍDO
              </span>
            ) : isDelayed ? (
              <span className="p-1 px-2 bg-amber-500/15 text-amber-500 rounded-lg text-[9px] font-extrabold font-mono flex items-center gap-0.5 animate-pulse">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                ATRASADO (-{daysBehind})
              </span>
            ) : (
              <span className="p-1 px-2 bg-zinc-800 text-zinc-400 rounded-lg text-[9px] font-extrabold font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-500" />
                EM DIA
              </span>
            )}

            {/* Quick edit & delete client */}
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1 bg-red-950/40 border border-red-500/30 rounded p-1 animate-fade-in select-none">
                <span className="text-[8px] text-red-400 font-extrabold uppercase mr-1">Deletar?</span>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteClient(client.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="px-1.5 py-0.5 bg-red-600 hover:bg-red-505 text-white font-black text-[9px] rounded-md cursor-pointer transition-all"
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-1.5 py-0.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-black text-[9px] rounded-md cursor-pointer transition-all"
                >
                  Não
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                {activeLoan && (
                  <button
                    onClick={() => {
                      setIsAdjusting(!isAdjusting);
                      setIsExpandingPay(false); // Mutual exclusion
                    }}
                    className={`p-1 rounded-lg transition-all cursor-pointer ${
                      isAdjusting 
                        ? "bg-amber-500/10 text-amber-500" 
                        : "hover:bg-zinc-800/60 text-zinc-650 hover:text-amber-500"
                    }`}
                    title="Reajustar parcelas e data de início do contrato"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                )}
                {onCopyContract && (
                  <button
                    onClick={() => onCopyContract(clientDetail)}
                    className="p-1 hover:bg-zinc-800/60 text-zinc-650 hover:text-emerald-500 rounded-lg transition-all cursor-pointer"
                    title="Copiar e criar novo contrato para este cliente"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onEditClient?.(clientDetail)}
                  className="p-1 hover:bg-zinc-800/60 text-zinc-650 hover:text-yellow-500 rounded-lg transition-all cursor-pointer"
                  title="Editar cliente"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1 hover:bg-zinc-800/60 text-zinc-650 hover:text-red-500 rounded-lg transition-all cursor-pointer"
                  title="Excluir cliente"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* METADADOS FINANCIAMENTO */}
        <div className="mt-4 grid grid-cols-3 gap-2 py-2 border-y border-zinc-800/60 text-center">
          <div>
            <span className="text-[9px] text-zinc-550 block uppercase font-bold tracking-wider">Investido</span>
            <span className="font-mono text-xs font-bold text-zinc-300">{formatBRL(activeLoan.amountInvested)}</span>
          </div>
          <div>
            <span className="text-[9px] text-zinc-550 block uppercase font-bold tracking-wider">Diária</span>
            <span className="font-mono text-xs font-bold text-yellow-500">{formatBRL(activeLoan.dailyRate)}</span>
          </div>
          <div>
            <span className="text-[9px] text-zinc-550 block uppercase font-bold tracking-wider">Total</span>
            <span className="font-mono text-xs font-bold text-zinc-200">{formatBRL(activeLoan.dailyRate * activeLoan.totalDays)}</span>
          </div>
        </div>
      </div>

      {/* MID: PROGRESS AND REF COVERAGE */}
      <div className="space-y-3">
        {/* PROGRESS DISPLAY */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="text-zinc-500 font-bold text-[9px] uppercase tracking-wider">Progresso de Diárias</span>
            <span className="font-mono font-bold text-white text-[11px]">
              {paidCount} de {totalDays} pagas
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                isFullyPaid 
                  ? "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.2)]" 
                  : "bg-yellow-500"
              }`}
              style={{ width: `${progressRatio}%` }}
            />
          </div>
        </div>

        {/* DUAL DATES GRID */}
        <div className="grid grid-cols-2 gap-2">
          {/* LOAN START DATE */}
          <div className="flex flex-col justify-between p-2 bg-zinc-950/20 rounded-xl border border-zinc-900">
            <span className="text-[8px] text-zinc-550 uppercase font-bold tracking-wider flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-zinc-500" />
              Data do Empréstimo
            </span>
            <span className="font-mono text-[11px] font-bold text-zinc-300 block mt-1">
              {activeLoan.startDate ? formatFriendlyDate(activeLoan.startDate) : "-"}
            </span>
          </div>

          {/* REFERENCE COVERAGE DATE */}
          <div className="flex flex-col justify-between p-2 bg-zinc-950/50 rounded-xl border border-zinc-800/80">
            <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-wider flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-yellow-500/60" />
              Última Diária Paga
            </span>
            <span 
              className={`font-mono text-[11px] font-bold block mt-1 ${
                isFullyPaid 
                  ? "text-yellow-500" 
                  : isDelayed 
                    ? "text-amber-500" 
                    : "text-zinc-300"
              }`}
            >
              {paidCount > 0 ? formatFriendlyDate(referenceDate) : "Nenhuma paga"}
            </span>
          </div>
        </div>

        {/* INTERACTIVE PENDING DAYS SELECTION */}
        {!isFullyPaid && unpaidSchedules.length > 0 && (
          <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center pb-1 border-b border-zinc-800/40">
              <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider block">
                Selecionar para PG / Cobrança
              </span>
              <span className="text-[10px] text-yellow-500 font-black font-mono">
                {selectedUnpaidDates.length === 1 
                  ? "1 marcada" 
                  : `${selectedUnpaidDates.length} marcadas`}
              </span>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-800">
              {unpaidSchedules.slice(0, 10).map((date, index) => {
                const isSelected = selectedUnpaidDates.includes(date);
                const labelDate = formatFriendlyDate(date);
                const isOverdue = date < getTodayStr();
                const isTodayDate = date === getTodayStr();
                const displayIndex = paidCount + index + 1;
                
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedUnpaidDates(prev => prev.filter(d => d !== date));
                      } else {
                        setSelectedUnpaidDates(prev => [...prev, date].sort());
                      }
                    }}
                    className={`flex-shrink-0 p-2 rounded-xl text-left border transition-all flex flex-col justify-between min-w-[100px] h-[75px] cursor-pointer ${
                      isSelected 
                        ? "bg-emerald-500/15 border-emerald-500 text-white" 
                        : isOverdue 
                          ? "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/20 text-zinc-400" 
                          : "bg-zinc-900/40 hover:bg-zinc-900/60 border-zinc-850 text-zinc-400"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="font-mono text-[9px] text-zinc-500 font-bold">
                        #{displayIndex}
                      </span>
                      <span className={`text-[8px] px-1 rounded font-black uppercase ${
                        isOverdue 
                          ? "bg-amber-500/10 text-amber-500" 
                          : isTodayDate 
                            ? "bg-yellow-500/10 text-yellow-500" 
                            : "bg-zinc-800 text-zinc-500"
                      }`}>
                        {isOverdue ? "Atraso" : isTodayDate ? "Hoje" : "Futuro"}
                      </span>
                    </div>
                    
                    <span className="font-bold text-[10px] tracking-tight truncate mt-1">
                      {labelDate}
                    </span>
                    
                    <div className={`mt-1.5 w-full py-0.5 rounded text-center text-[9px] font-black tracking-wider transition-all uppercase ${
                      isSelected 
                        ? "bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.25)]" 
                        : "bg-zinc-950/60 hover:bg-zinc-900 text-zinc-500 border border-zinc-850"
                    }`}>
                      {isSelected ? "✓ PG" : "Marcar"}
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedUnpaidDates.length > 0 && (
              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 bg-zinc-900/40 p-1.5 rounded-lg">
                <span>Total Marcado para PG:</span>
                <span className="font-black text-emerald-400 font-bold">
                  R$ {(selectedUnpaidDates.length * activeLoan.dailyRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* SUNDAY SETTING BUTTON */}
        {onToggleSunday && (
          <button
            id={`sunday-toggle-${activeLoan.id}`}
            onClick={() => onToggleSunday(activeLoan.id)}
            className={`w-full py-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-[0.98] ${
              activeLoan.excludeSundays !== false
                ? "bg-zinc-900/50 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10 hover:border-yellow-500/40"
                : "bg-zinc-950/40 border-zinc-800 text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-400 hover:border-zinc-700"
            }`}
            title="Clique para alternar de domingos"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {activeLoan.excludeSundays !== false ? "Domingos Isentos" : "Domingos Cobrados"}
          </button>
        )}
      </div>

      {/* COMPROVANTE WHATSAPP NOTIFIER */}
      {showWhatsappReceipt && lastReceiptDetails && (
        <div className="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-xl flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-zinc-350 text-[10px] font-bold">Comprovante de pagamento pronto!</span>
          </div>
          <button
            onClick={handleSendReceipt}
            className="px-2.5 py-1 bg-yellow-500 hover:bg-yellow-405 text-zinc-950 font-black text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
          >
            <Smartphone className="w-3 h-3" />
            Enviar WhatsApp
          </button>
        </div>
      )}

      {/* PAYMENT DRAWER SLIDE EXPANSION FILE */}
      {isExpandingPay && (
        <form onSubmit={handlePaymentSubmit} className="bg-zinc-950/90 border border-zinc-800 p-3.5 rounded-xl space-y-3.5 animate-slide-down">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest block">Registrar Diárias</span>
            <button 
              type="button" 
              onClick={() => setIsExpandingPay(false)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Stepper selectors */}
            <div>
              <label className="text-[9px] text-zinc-400 block mb-1">Quantidade diárias</label>
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPayDaysCount(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold cursor-pointer text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max={totalDays - paidCount}
                  value={payDaysCount}
                  onChange={e => setPayDaysCount(Math.min(totalDays - paidCount, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-full text-center bg-transparent text-xs font-mono font-bold text-white border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => setPayDaysCount(p => Math.min(totalDays - paidCount, p + 1))}
                  className="px-3 py-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold cursor-pointer text-xs"
                >
                  +
                </button>
              </div>
              {/* Preset buttons */}
              <div className="flex gap-1 mt-1.5">
                {[1, 2, 3, 5, 10].map(n => {
                  const maxPossible = totalDays - paidCount;
                  if (n > maxPossible) return null;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPayDaysCount(n)}
                      className={`flex-1 text-[9px] font-extrabold py-1 rounded transition-all cursor-pointer ${
                        payDaysCount === n
                          ? "bg-yellow-500 text-zinc-950"
                          : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {n}x
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Simulated date input */}
            <div>
              <label className="text-[9px] text-zinc-400 block mb-1">Data Compensada</label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white font-mono focus:outline-none cursor-pointer h-[32px]"
              />
            </div>
          </div>

          {/* preview calculations referencing +1 date shift */}
          <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 text-[10px] space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-zinc-500">Valor Total:</span>
              <span className="font-bold text-zinc-300">R$ {(payDaysCount * activeLoan.dailyRate).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Nova Cobertura:</span>
              <span className="font-bold text-yellow-500">{formatFriendlyDate(predictedNewReferenceDate)}</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-yellow-500 text-zinc-950 hover:bg-yellow-405 font-black text-xs rounded-lg shadow-lg hover:shadow-yellow-500/10 transition-colors cursor-pointer"
          >
            Confirmar Recebimento
          </button>
        </form>
      )}

      {/* CONTRACT ADJUSTMENT PANEL */}
      {isAdjusting && activeLoan && (
        <form onSubmit={handleAdjustmentSubmit} className="bg-zinc-950/90 border border-amber-500/30 p-3.5 rounded-xl space-y-4 animate-slide-down">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Reajustar Contrato
            </span>
            <button 
              type="button" 
              onClick={() => setIsAdjusting(false)}
              className="text-[10px] text-zinc-500 hover:text-zinc-350 font-bold"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Parcelas Jás Pagas */}
            <div>
              <label className="text-[9px] text-zinc-400 font-bold uppercase block mb-1">Parcelas já pagas</label>
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden h-[34px]">
                <button
                  type="button"
                  onClick={() => setAdjustedPaidCount(p => Math.max(0, p - 1))}
                  className="px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white font-black cursor-pointer text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  max={totalDays}
                  value={adjustedPaidCount}
                  onChange={e => setAdjustedPaidCount(Math.min(totalDays, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-full text-center bg-transparent text-xs font-mono font-bold text-white border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-extrabold"
                />
                <button
                  type="button"
                  onClick={() => setAdjustedPaidCount(p => Math.min(totalDays, p + 1))}
                  className="px-2.5 py-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white font-black cursor-pointer text-xs"
                >
                  +
                </button>
              </div>
            </div>

            {/* Data Inicial */}
            <div>
              <label className="text-[9px] text-zinc-400 font-bold uppercase block mb-1">Data Início Contrato</label>
              <input
                type="date"
                value={adjustedStartDate}
                onChange={e => setAdjustedStartDate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white font-mono focus:outline-none cursor-pointer h-[34px] font-bold"
              />
            </div>
          </div>

          {/* CÁLCULO INTELIGENTE / AUTOMÁTICO */}
          <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-850 space-y-3.5 text-[10px] font-mono leading-relaxed">
            <span className="text-[8px] font-extrabold text-zinc-400 block uppercase tracking-widest border-b border-zinc-800/80 pb-1">Recursos Retroativos Inteligentes</span>
            
            {/* Retroactive Date Calculation button */}
            <div className="space-y-1.5">
              <p className="text-zinc-400">
                Para ficar <strong className="text-emerald-400 font-extrabold uppercase">EM DIA</strong> hoje com <span className="text-white font-extrabold">{adjustedPaidCount} parcelas pagas</span>, o contrato começaria em: <span className="text-yellow-500 font-extrabold">{formatFriendlyDate(computedRetroStartDate)}</span>.
              </p>
              <button
                type="button"
                onClick={() => setAdjustedStartDate(computedRetroStartDate)}
                className="w-full py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/25 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors"
              >
                📥 Aplicar Data Retroativa ({formatFriendlyDate(computedRetroStartDate)})
              </button>
            </div>

            {/* Retroactive Paid Count Calculation button */}
            <div className="space-y-1.5 border-t border-zinc-800/80 pt-3">
              <p className="text-zinc-400">
                Para ficar <strong className="text-emerald-400 font-extrabold uppercase">EM DIA</strong> hoje com início em <span className="text-white font-extrabold">{formatFriendlyDate(adjustedStartDate)}</span>, o total pago deveria ser: <span className="text-yellow-500 font-extrabold">{expectedPaidCount} parcelas</span>.
              </p>
              <button
                type="button"
                onClick={() => setAdjustedPaidCount(expectedPaidCount)}
                className="w-full py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/25 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors"
              >
                📥 Ajustar Parcelas Pagas para {expectedPaidCount}x
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-405 text-zinc-950 font-black text-xs rounded-lg shadow-lg hover:shadow-amber-500/15 transition-all cursor-pointer uppercase tracking-wider"
          >
            Confirmar Reajuste
          </button>
        </form>
      )}

      {/* QUICK ACTIONS BUTTONS */}
      {!isExpandingPay && !isAdjusting && (
        <div className="space-y-2 select-none">
          {/* PRINCIPAL ROW: COBRANÇA (WHATSAPP VERDE) & RECEBIMENTO (BAIXA AMARELO) */}
          <div className="grid grid-cols-2 gap-2">
            {/* BOTAO DE COBRANÇA (WHATSAPP VERDE) */}
            <button
              onClick={handleWhatsAppCharge}
              className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Mandar mensagem de cobrança via WhatsApp"
            >
              <Send className="w-4 h-4 text-white shrink-0" />
              <span>Cobrança</span>
            </button>

            {/* BOTAO DE RECEBIMENTO (DAR BAIXA) */}
            {!isFullyPaid ? (
              <button
                onClick={() => {
                  setPayDaysCount(selectedUnpaidDates.length > 0 ? selectedUnpaidDates.length : 1);
                  setIsExpandingPay(!isExpandingPay);
                  setIsAdjusting(false); // Exclusão mútua
                }}
                className="px-3 py-2.5 bg-yellow-500 hover:bg-yellow-405 text-zinc-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-500/10 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                title="Registrar recebimento de parcela de diária"
              >
                <PlusCircle className="w-4 h-4 text-zinc-950 shrink-0" />
                <span>
                  {selectedUnpaidDates.length > 0
                    ? `Baixa ${selectedUnpaidDates.length}x`
                    : "Recebimento"}
                </span>
              </button>
            ) : (
              <div className="px-3 py-2.5 text-center bg-yellow-500/10 text-yellow-500 text-xs font-bold rounded-xl border border-yellow-500/20 flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                <span>Quitado</span>
              </div>
            )}
          </div>

          {/* SECUNDARY ROW: COBRANÇA PIX (COPIAR QR CODE) */}
          <button
            onClick={() => onOpenPixModal(client.name)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 hover:text-white text-zinc-350 font-bold text-xs rounded-xl border border-zinc-800 transition-all duration-200 cursor-pointer"
            title="Obter dados PIX"
          >
            <Copy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span>Copiar Chave Pix</span>
          </button>
        </div>
      )}
    </div>
  );
};
