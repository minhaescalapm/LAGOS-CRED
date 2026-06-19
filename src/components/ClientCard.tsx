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
  Send
} from "lucide-react";
import { formatFriendlyDate, addDays, getTodayStr } from "../utils/dateUtils";

interface ClientCardProps {
  clientDetail: ClientWithLoanDetails;
  onRegisterPayment: (loanId: string, count: number, dateStr: string) => void;
  onOpenPixModal: (clientName: string) => void;
  onDeleteClient: (clientId: string) => void;
  onEditClient?: (clientDetail: ClientWithLoanDetails) => void;
}

export const ClientCard: React.FC<ClientCardProps> = ({ 
  clientDetail, 
  onRegisterPayment, 
  onOpenPixModal,
  onDeleteClient,
  onEditClient
}) => {
  const { client, activeLoan, paidCount, totalDays, referenceDate, isDelayed, daysBehind } = clientDetail;

  const [isExpandingPay, setIsExpandingPay] = useState(false);
  const [payDaysCount, setPayDaysCount] = useState<number>(1);
  const [paymentDate, setPaymentDate] = useState(() => getTodayStr());
  
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
    const dateFormatted = referenceDate 
      ? formatFriendlyDate(referenceDate) 
      : formatFriendlyDate(activeLoan.startDate);

    const messageTemplate = `Olá *${client.name}*, tudo bem?
Passando para lembrar da sua parcela diária no valor de *R$ ${activeLoan.dailyRate.toFixed(2)}*.

📊 *Seu Resumo:*
Progresso: *${paidCount} de ${totalDays} pagas*
Última atualização: *${dateFormatted}*

⚠️ Você precisa acertar a parcela pendente para mantermos o seu cadastro atualizado.

🔑 *Nossa Chave Pix (E-mail):*
lagoscelular5@gmail.com

ESTAREMOS À DISPOSIÇÃO. Não fique em atraso, não crie dificuldade para pegar um novo valor quando precisar.`;

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
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEditClient?.(clientDetail)}
                className="p-1 text-zinc-550 hover:text-yellow-500 rounded transition-colors cursor-pointer"
                title="Editar cliente"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Tem certeza que deseja remover o cliente ${client.name}? Todos os registros serão apagados.`)) {
                    onDeleteClient(client.id);
                  }
                }}
                className="p-1 text-zinc-550 hover:text-red-500 rounded transition-colors cursor-pointer"
                title="Excluir cliente"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
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
  const predictedNewReferenceDate = addDays(referenceDate || activeLoan.startDate, payDaysCount);

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
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onEditClient?.(clientDetail)}
                className="p-1 hover:bg-zinc-800/60 text-zinc-650 hover:text-yellow-500 rounded-lg transition-all cursor-pointer"
                title="Editar cliente"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Tem certeza que deseja apagar o cliente ${client.name} e seu contrato ativo?`)) {
                    onDeleteClient(client.id);
                  }
                }}
                className="p-1 hover:bg-zinc-800/60 text-zinc-650 hover:text-red-500 rounded-lg transition-all cursor-pointer"
                title="Excluir cliente"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
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

        {/* REFERENCE COVERAGE DATE */}
        <div className="flex items-center justify-between p-2.5 bg-zinc-950/50 rounded-xl border border-zinc-800/80">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-yellow-500/60" />
            Última Atualização
          </span>
          <span 
            className={`font-mono text-xs font-bold ${
              isFullyPaid 
                ? "text-yellow-500" 
                : isDelayed 
                  ? "text-amber-500" 
                  : "text-zinc-300"
            }`}
          >
            {referenceDate ? formatFriendlyDate(referenceDate) : formatFriendlyDate(activeLoan.startDate)}
          </span>
        </div>
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

      {/* QUICK ACTIONS BUTTONS */}
      {!isExpandingPay && (
        <div className="grid grid-cols-1 gap-2 select-none">
          {/* BOTÃO RECEBER PAGAMENTO */}
          {!isFullyPaid ? (
            <button
              onClick={() => {
                setPayDaysCount(1);
                setIsExpandingPay(!isExpandingPay);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-yellow-500 hover:bg-yellow-405 text-zinc-950 font-black text-xs rounded-xl shadow-lg hover:shadow-yellow-500/10 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-zinc-950" />
              Receber Pagamento
            </button>
          ) : (
            <div className="w-full py-2.5 px-3 text-center bg-yellow-500/10 text-yellow-500 text-xs font-bold rounded-xl border border-yellow-500/20 select-none cursor-default flex items-center justify-center gap-1">
              <Check className="w-4 h-4 text-yellow-500" />
              Contrato Quitado
            </div>
          )}

          {/* SECUNDARY ROW: COBRANÇA PIX & COBRAR NO WHATSAPP */}
          <div className="flex items-center gap-2">
            {/* COBRANÇA PIX */}
            <button
              onClick={() => onOpenPixModal(client.name)}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-250 font-semibold text-xs rounded-xl border border-zinc-700/80 transition-all cursor-pointer"
              title="Obter dados PIX"
            >
              <Copy className="w-3.5 h-3.5 text-yellow-350" />
              Cobrança Pix
            </button>

            {/* COBRAR NO WHATSAPP */}
            <button
              onClick={handleWhatsAppCharge}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-250 font-semibold text-xs rounded-xl border border-zinc-700/80 transition-all cursor-pointer"
              title="Cobrar no WhatsApp"
            >
              <Send className="w-3.5 h-3.5 text-yellow-350" />
              Whatsapp
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
