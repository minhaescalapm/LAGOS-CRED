import React, { useState } from "react";
import { ClientWithLoanDetails } from "../types";
import { AlertCircle, CheckCircle, Smartphone, Copy, Pencil, Trash2, Send } from "lucide-react";
import { formatFriendlyDate } from "../utils/dateUtils";

interface AlertsSectionProps {
  clientsWithLoans: ClientWithLoanDetails[];
  onOpenPixModal: (clientName: string) => void;
  onEditClient?: (clientDetail: ClientWithLoanDetails) => void;
  onDeleteClient?: (clientId: string) => void;
}

export function AlertsSection({ clientsWithLoans, onOpenPixModal, onEditClient, onDeleteClient }: AlertsSectionProps) {
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  // Filter delayed clients (daysBehind > 0 or isDelayed)
  const delayedClients = clientsWithLoans.filter(c => c.isDelayed && c.activeLoan);

  // Exact step 5 template
  const handleChargeWhatsApp = (client: ClientWithLoanDetails) => {
    if (!client.activeLoan) return;
    
    const formattedPhone = `55${client.client.phone.replace(/\D/g, "")}`;
    const dateFormatted = client.referenceDate 
      ? formatFriendlyDate(client.referenceDate) 
      : formatFriendlyDate(client.activeLoan.startDate);

    const messageTemplate = `Olá *${client.client.name}*, tudo bem?
Passando para lembrar da sua parcela diária no valor de *R$ ${client.activeLoan.dailyRate.toFixed(2)}*.

📊 *Seu Resumo:*
Progresso: *${client.paidCount} de ${client.totalDays} pagas*
Última atualização: *${dateFormatted}*

⚠️ Você precisa acertar a parcela pendente para mantermos o seu cadastro atualizado.

🔑 *Nossa Chave Pix (E-mail):*
lagoscelular5@gmail.com

ESTAREMOS À DISPOSIÇÃO. Não fique em atraso, não crie dificuldade para pegar um novo valor quando precisar.`;
    
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageTemplate)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-5 md:p-6 select-none">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-xl">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
        </div>
        <div>
          <h3 className="font-bold text-white text-xs sm:text-sm">Atenção Crítica</h3>
          <p className="text-[10px] text-zinc-500 font-mono">Diárias pendentes encontradas</p>
        </div>
      </div>

      {delayedClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center bg-zinc-900/10 rounded-xl border border-zinc-800 border-dashed p-4">
          <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-full mb-3">
            <CheckCircle className="w-8 h-8 text-yellow-500" />
          </div>
          <h4 className="text-white text-xs font-semibold">Tudo Sob Controle!</h4>
          <p className="text-[11px] text-zinc-500 max-w-[220px] mt-1">Nenhum cliente está com mais de 1 parcela em atraso no presente ciclo.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
          {delayedClients.map(client => {
            if (!client.activeLoan) return null;
            return (
              <div 
                key={client.client.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-yellow-500/5 hover:bg-yellow-500/10 border border-yellow-500/10 rounded-xl gap-3 transition-colors"
              >
                <div>
                   <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-zinc-200 text-xs sm:text-sm">{client.client.name}</span>
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-[10px] font-extrabold rounded-full font-mono">
                      -{client.daysBehind}x
                    </span>
                    <div className="flex items-center gap-1 ml-1">
                      {deletingClientId === client.client.id ? (
                        <div className="flex items-center gap-1 bg-red-950/40 border border-red-500/30 rounded px-1 py-0.5 animate-fade-in select-none">
                          <span className="text-[8px] text-red-400 font-extrabold uppercase mr-1">Excluir?</span>
                          <button
                            onClick={() => {
                              onDeleteClient?.(client.client.id);
                              setDeletingClientId(null);
                            }}
                            className="px-1.5 py-0.5 bg-red-600 hover:bg-red-505 text-white font-black text-[9px] rounded cursor-pointer"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setDeletingClientId(null)}
                            className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black text-[9px] rounded cursor-pointer"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => onEditClient?.(client)}
                            className="p-1 text-zinc-500 hover:text-yellow-500 rounded transition-colors cursor-pointer"
                            title="Editar devedor"
                          >
                            <Pencil className="w-3" />
                          </button>
                          <button
                            onClick={() => setDeletingClientId(client.client.id)}
                            className="p-1 text-zinc-500 hover:text-red-500 rounded transition-colors cursor-pointer"
                            title="Excluir devedor"
                          >
                            <Trash2 className="w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-400 font-mono">
                    <span>
                      Diária: <strong className="text-white">R$ {client.activeLoan.dailyRate}</strong>
                    </span>
                    <span>
                      Coberto: <strong className="text-yellow-500">{formatFriendlyDate(client.referenceDate)}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:self-center">
                  {/* COBRAR VIA WHATSAPP */}
                  <button
                    onClick={() => handleChargeWhatsApp(client)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold border border-zinc-700/80 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-yellow-500" />
                    Cobrar no WhatsApp
                  </button>

                  {/* COPIAR PIX CHAVE */}
                  <button
                    onClick={() => onOpenPixModal(client.client.name)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg text-xs font-bold border border-yellow-500/20 transition-all cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Chave Pix
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
