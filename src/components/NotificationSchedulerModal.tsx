import React, { useEffect, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  X
} from "lucide-react";
import {
  BrowserNotificationPermission,
  DailyNotificationSummary,
  NotificationReminderSlot,
  NotificationSettings,
  buildReminderPayload,
  dispatchBrowserNotification,
  getBrowserNotificationPermission,
  getNextScheduledReminder,
  isServiceWorkerSupported,
  registerNotificationServiceWorker,
  requestBrowserNotificationPermission
} from "../services/notificationService";

interface NotificationSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  onUpdateSettings: (next: NotificationSettings) => void;
  summary: DailyNotificationSummary;
}

export const NotificationSchedulerModal: React.FC<NotificationSchedulerModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  summary
}) => {
  const [permission, setPermission] = useState<BrowserNotificationPermission>(() =>
    getBrowserNotificationPermission()
  );
  const [swReady, setSwReady] = useState(false);
  const [newTime, setNewTime] = useState("12:00");
  const [newLabel, setNewLabel] = useState("Lembrete Meio-Dia");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPermission(getBrowserNotificationPermission());
    setFeedback(null);

    if (isServiceWorkerSupported()) {
      registerNotificationServiceWorker().then(reg => {
        setSwReady(Boolean(reg));
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatBRL = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);

  const handleEnablePermission = async () => {
    const result = await requestBrowserNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      const reg = await registerNotificationServiceWorker();
      setSwReady(Boolean(reg));
      setFeedback({
        type: "success",
        text: "Permissão concedida! As notificações em segundo plano estão prontas."
      });
    } else if (result === "denied") {
      setFeedback({
        type: "error",
        text: "Notificações bloqueadas no navegador. Libere no ícone de cadeado ao lado da URL."
      });
    }
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    setFeedback(null);
    try {
      let currentPerm = getBrowserNotificationPermission();
      if (currentPerm === "default") {
        currentPerm = await requestBrowserNotificationPermission();
        setPermission(currentPerm);
      }
      if (currentPerm !== "granted") {
        setFeedback({
          type: "error",
          text:
            currentPerm === "denied"
              ? "Notificações bloqueadas neste navegador. Clique no cadeado da barra de endereço e permita Notificações."
              : "Seu navegador não permite ou não suporta notificações push."
        });
        return;
      }

      const reg = await registerNotificationServiceWorker();
      setSwReady(Boolean(reg));

      const sampleSlot: NotificationReminderSlot = settings.slots[0] || {
        id: "test",
        label: "Cobranças do Dia",
        time: "09:00",
        enabled: true,
        includeOverdue: true
      };
      const payload = buildReminderPayload(sampleSlot, summary, true);
      const ok = await dispatchBrowserNotification(payload);
      if (ok) {
        setFeedback({
          type: "success",
          text: "Notificação de teste disparada! Verifique a central de notificações do seu aparelho/sistema."
        });
      } else {
        setFeedback({
          type: "error",
          text: "Não foi possível exibir a notificação neste ambiente."
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleMaster = () => {
    onUpdateSettings({
      ...settings,
      enabled: !settings.enabled
    });
  };

  const handleUpdateSlot = (id: string, patch: Partial<NotificationReminderSlot>) => {
    onUpdateSettings({
      ...settings,
      slots: settings.slots.map(s => (s.id === id ? { ...s, ...patch } : s))
    });
  };

  const handleDeleteSlot = (id: string) => {
    if (settings.slots.length <= 1) return;
    onUpdateSettings({
      ...settings,
      slots: settings.slots.filter(s => s.id !== id)
    });
  };

  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{2}:\d{2}$/.test(newTime)) return;
    const cleanLabel = newLabel.trim() || `Lembrete ${newTime}`;
    const nextSlot: NotificationReminderSlot = {
      id: `custom-${Date.now()}`,
      label: cleanLabel,
      time: newTime,
      enabled: true,
      includeOverdue: true
    };
    onUpdateSettings({
      ...settings,
      slots: [...settings.slots, nextSlot].sort((a, b) => a.time.localeCompare(b.time))
    });
    setNewLabel("Novo Lembrete");
  };

  const nextReminder = getNextScheduledReminder(settings);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-3 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/25 rounded-xl text-yellow-500">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                Notificações Agendadas (2º Plano)
              </h3>
              <p className="text-[11px] text-zinc-400">
                Receba alertas automáticos das cobranças do dia pelo navegador mesmo minimizado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Permission & Background Worker Status */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-zinc-200">Status no Navegador:</span>
                  {permission === "granted" ? (
                    <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black rounded font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      AUTORIZADAS
                    </span>
                  ) : permission === "denied" ? (
                    <span className="px-2 py-0.5 bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-black rounded font-mono flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      BLOQUEADAS
                    </span>
                  ) : permission === "default" ? (
                    <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black rounded font-mono">
                      AGUARDANDO PERMISSÃO
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] font-black rounded font-mono">
                      NÃO SUPORTADO
                    </span>
                  )}

                  {swReady && (
                    <span className="px-2 py-0.5 bg-sky-500/10 border border-sky-500/25 text-sky-400 text-[10px] font-bold rounded font-mono">
                      Service Worker Ativo
                    </span>
                  )}
                </div>

                {nextReminder && permission === "granted" && (
                  <p className="text-[11px] text-zinc-400 font-mono">
                    Próximo disparo:{" "}
                    <strong className="text-yellow-400">
                      {nextReminder.isToday ? "Hoje" : "Amanhã"} às {nextReminder.slot.time}
                    </strong>{" "}
                    ({nextReminder.slot.label})
                  </p>
                )}
              </div>

              {permission === "default" && (
                <button
                  type="button"
                  onClick={handleEnablePermission}
                  className="px-3.5 py-2 bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Ativar Notificações
                </button>
              )}
            </div>

            {permission === "denied" && (
              <p className="text-[11px] text-red-300/90 bg-red-950/30 border border-red-900/40 rounded-lg p-2.5 leading-relaxed">
                As notificações foram bloqueadas anteriormente. Clique no ícone de cadeado (ou ajustes do site) ao lado do endereço do site, mude <strong>Notificações</strong> para <strong>Permitir</strong> e recarregue a página.
              </p>
            )}

            {/* Master Enable Switch */}
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">
                  Ativar lembretes automáticos agendados
                </span>
                <span className="text-[10px] text-zinc-500">
                  Dispara alertas nos horários configurados mesmo com a aba em segundo plano
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleMaster}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer ${
                  settings.enabled
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                    : "bg-zinc-900 border-zinc-700 text-zinc-400"
                }`}
              >
                {settings.enabled ? "ATIVADO" : "PAUSADO"}
              </button>
            </div>
          </div>

          {/* Live Summary Preview */}
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-500 block">
                Prévia do Alerta Atual (Hoje)
              </span>
              <span className="text-zinc-200">
                {summary.pendingTodayCount > 0
                  ? `Faltam ${summary.pendingTodayCount} cliente(s) = ${formatBRL(summary.pendingTodayAmount)}`
                  : "Todos os clientes de hoje já pagaram!"}
                {summary.overdueCount > 0 && (
                  <span className="text-amber-400">
                    {" "}• {summary.overdueCount} atrasado(s) ({formatBRL(summary.overdueAmount)})
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Scheduled Slots */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-yellow-500" />
              Horários Agendados ({settings.slots.length})
            </h4>

            <div className="space-y-2">
              {settings.slots.map(slot => (
                <div
                  key={slot.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    slot.enabled
                      ? "bg-zinc-900/60 border-zinc-800"
                      : "bg-zinc-950/40 border-zinc-900 opacity-65"
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateSlot(slot.id, { enabled: !slot.enabled })}
                      className={`px-2 py-1 rounded-md text-[10px] font-black font-mono border shrink-0 cursor-pointer ${
                        slot.enabled
                          ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                          : "bg-zinc-900 border-zinc-700 text-zinc-500"
                      }`}
                    >
                      {slot.enabled ? "ON" : "OFF"}
                    </button>

                    <input
                      type="time"
                      value={slot.time}
                      onChange={e => handleUpdateSlot(slot.id, { time: e.target.value })}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-yellow-400 focus:border-yellow-500 focus:outline-none shrink-0"
                    />

                    <input
                      type="text"
                      value={slot.label}
                      onChange={e => handleUpdateSlot(slot.id, { label: e.target.value })}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-100 focus:border-yellow-500 focus:outline-none min-w-0 flex-1"
                    />
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateSlot(slot.id, { includeOverdue: !slot.includeOverdue })}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        slot.includeOverdue
                          ? "bg-amber-500/15 border-amber-500/35 text-amber-400"
                          : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                      }`}
                      title="Incluir contagem de prestações atrasadas neste alerta"
                    >
                      {slot.includeOverdue ? "+ Atrasados" : "Só hoje"}
                    </button>

                    {settings.slots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                        title="Remover horário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Reminder Slot */}
            <form
              onSubmit={handleAddSlot}
              className="p-3 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-xl flex flex-wrap items-center gap-2"
            >
              <input
                type="time"
                value={newTime}
                onChange={e => setNewTime(e.target.value)}
                required
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-zinc-100 focus:border-yellow-500 focus:outline-none"
              />
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Nome do lembrete (ex: Meio-dia)"
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-yellow-500 focus:outline-none flex-1 min-w-[160px]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-yellow-400 font-bold text-xs rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Horário
              </button>
            </form>
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium ${
                feedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-800 bg-zinc-900/30 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={isTesting}
            onClick={handleTestNotification}
            className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isTesting ? "Disparando..." : "Testar Notificação Agora"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-black text-xs rounded-xl transition-colors cursor-pointer"
          >
            Salvar e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
