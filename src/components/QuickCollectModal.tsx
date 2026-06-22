import React, { useState } from "react";
import { X, Send, Search, CheckCircle2, AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { ClientWithLoanDetails } from "../types";
import { formatFriendlyDate } from "../utils/dateUtils";

interface QuickCollectModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientsWithLoans: ClientWithLoanDetails[];
}

export const QuickCollectModal: React.FC<QuickCollectModalProps> = ({
  isOpen,
  onClose,
  clientsWithLoans,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyDelayed, setOnlyDelayed] = useState(true);
  const [sentClients, setSentClients] = useState<string[]>([]);

  if (!isOpen) return null;

  // Render list of active clients on active contracts
  const activeClients = clientsWithLoans.filter((c) => {
    if (!c.activeLoan) return false;
    // Must not be fully paid
    const isFullyPaid = c.paidCount >= c.totalDays;
    if (isFullyPaid) return false;

    // Filter by delay
    if (onlyDelayed && !c.isDelayed) return false;

    // Filter by search
    const matchesSearch =
      c.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.client.phone.includes(searchTerm);

    return matchesSearch;
  });

  const handleSendCharge = (detail: ClientWithLoanDetails) => {
    const { client, activeLoan, paidCount, totalDays, referenceDate } = detail;
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

    // Track sent clients in current session
    const targetId = activeLoan.id;
    if (!sentClients.includes(targetId)) {
      setSentClients([...sentClients, targetId]);
    }
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        id="quick-collect-container"
        className="bg-[#121215] border border-zinc-800/80 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-zinc-900 flex justify-between items-start select-none">
          <div className="space-y-1">
            <span className="text-[10px] text-yellow-500 font-extrabold uppercase tracking-widest flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
              Sessão de Alta Produtividade
            </span>
            <h3 className="font-extrabold text-sm sm:text-base text-zinc-100 uppercase tracking-tight">
              ⚡ Cobrança Rápida em Lote
            </h3>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Dispare lembretes de diárias para WhatsApp com apenas um clique.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 px-1.5 hover:bg-zinc-900 rounded-lg text-zinc-550 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* COMPREHENSIVE TOOLS TOOLBAR */}
        <div className="p-3 bg-zinc-950/40 border-b border-zinc-900/60 flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-650" />
            <input
              type="text"
              placeholder="Pesquisar cliente rápido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-yellow-500 focus:outline-none rounded-lg py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-600 font-mono"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setOnlyDelayed(true)}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                onlyDelayed
                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-500"
                  : "bg-zinc-900 border border-zinc-850 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Apenas Atrasados
            </button>
            <button
              onClick={() => setOnlyDelayed(false)}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !onlyDelayed
                  ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-500"
                  : "bg-zinc-900 border border-zinc-850 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Todos Ativos
            </button>
          </div>
        </div>

        {/* LIST AREA */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 min-h-[250px]">
          {activeClients.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="w-10 h-10 text-zinc-600 mx-auto mb-2.5" />
              <h4 className="text-zinc-300 font-semibold text-xs">Sem clientes pendentes de cobrança</h4>
              <p className="text-[10px] text-zinc-500 mt-1">Nenhum cliente atende aos critérios selecionados.</p>
            </div>
          ) : (
            activeClients.map((c) => {
              const uniqueTargetId = c.activeLoan ? c.activeLoan.id : c.client.id;
              const hasBeenSent = sentClients.includes(uniqueTargetId);
              return (
                <div
                  key={c.activeLoan ? `collect-loan-${c.activeLoan.id}` : `collect-client-${c.client.id}`}
                  className={`p-3 bg-zinc-900/20 hover:bg-zinc-900/40 border ${
                    hasBeenSent
                      ? "border-emerald-500/30 bg-emerald-500/5 animate-fade-in"
                      : "border-zinc-850/80"
                  } rounded-xl flex items-center justify-between gap-4 transition-all duration-200 select-none`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-xs text-white truncate max-w-[150px] sm:max-w-xs">{c.client.name}</span>
                      {c.isDelayed ? (
                        <span className="p-0.5 px-1.5 bg-amber-500/10 text-amber-500 rounded text-[9px] font-extrabold font-mono flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                          Atrasado (-{c.daysBehind})
                        </span>
                      ) : (
                        <span className="p-0.5 px-1.5 bg-zinc-850 text-zinc-400 rounded text-[9px] font-extrabold font-mono flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 text-zinc-500" />
                          Em dia
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-450 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                      <span>Progresso: <strong className="text-zinc-200">{c.paidCount} de {c.totalDays}</strong></span>
                      <span>Diária: <strong className="text-yellow-500">{formatBRL(c.activeLoan?.dailyRate ?? 0)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasBeenSent && (
                      <span className="text-[10px] text-emerald-400 font-extrabold font-mono flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Disparado
                      </span>
                    )}

                    <button
                      onClick={() => handleSendCharge(c)}
                      className={`px-3 py-2 ${
                        hasBeenSent
                          ? "bg-zinc-800 text-zinc-400 hover:text-white"
                          : "bg-emerald-500 text-zinc-950 hover:bg-emerald-405 font-black"
                      } rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer`}
                      title="Enviar cobrança via WhatsApp"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Cobrar
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER STATS */}
        <div className="p-3 bg-zinc-950/80 border-t border-zinc-900 flex justify-between items-center text-xs text-zinc-500 select-none">
          <span className="font-semibold text-[10px] uppercase font-mono">
            Filtrados: {activeClients.length} ativos
          </span>
          <span className="text-zinc-400 font-bold font-mono">
            Sessão: {sentClients.length} enviados
          </span>
        </div>
      </div>
    </div>
  );
};
