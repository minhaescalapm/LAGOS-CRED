import { ClientWithLoanDetails, Payment } from "../types";
import { getTodayStr, isSunday } from "../utils/dateUtils";
import {
  getLoanFrequency,
  getLoanScheduledDates,
  getWeekdayFromDate,
  stepReferenceDate
} from "../utils/loanSchedule";

const NOTIFICATION_SETTINGS_KEY = "gestao_emprestimos_notification_settings_v1";
const NOTIFICATION_SW_PATH = "/notifications-sw.js";
const roundBRL = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

export interface NotificationReminderSlot {
  id: string;
  label: string;
  time: string; // "HH:MM"
  enabled: boolean;
  includeOverdue: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  slots: NotificationReminderSlot[];
  lastFiredMap: Record<string, string>; // `${slotId}_${YYYY-MM-DD}` -> ISO timestamp
}

export interface DailyNotificationSummary {
  targetDate: string;
  morningCount: number;
  morningTotal: number;
  pendingTodayCount: number;
  pendingTodayAmount: number;
  paidTodayCount: number;
  paidTodayAmount: number;
  pendingNamesPreview: string[];
  overdueCount: number;
  overdueInstallments: number;
  overdueAmount: number;
}

export interface NotificationPayload {
  title: string;
  body: string;
  tag: string;
  requireInteraction?: boolean;
  data?: {
    tab: "home" | "collections" | "debts";
  };
}

export type BrowserNotificationPermission = NotificationPermission | "unsupported";

export const DEFAULT_REMINDER_SLOTS: NotificationReminderSlot[] = [
  {
    id: "morning",
    label: "Resumo da Manhã",
    time: "09:00",
    enabled: true,
    includeOverdue: true
  },
  {
    id: "afternoon",
    label: "Cobrança da Tarde",
    time: "14:30",
    enabled: true,
    includeOverdue: false
  },
  {
    id: "closing",
    label: "Fechamento do Caixa (19h)",
    time: "18:45",
    enabled: true,
    includeOverdue: true
  }
];

export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (!raw) {
      return {
        enabled: true,
        slots: DEFAULT_REMINDER_SLOTS,
        lastFiredMap: {}
      };
    }
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    const validSlots =
      Array.isArray(parsed.slots) && parsed.slots.length > 0
        ? parsed.slots.map((s, idx) => ({
            id: s.id || `slot-${idx}`,
            label: s.label || "Lembrete de Cobrança",
            time: /^\d{2}:\d{2}$/.test(s.time || "") ? s.time! : "09:00",
            enabled: Boolean(s.enabled),
            includeOverdue: Boolean(s.includeOverdue)
          }))
        : DEFAULT_REMINDER_SLOTS;

    // Prune lastFiredMap entries older than 7 days to keep storage tiny
    const rawMap = parsed.lastFiredMap && typeof parsed.lastFiredMap === "object" ? parsed.lastFiredMap : {};
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const prunedMap: Record<string, string> = {};
    Object.entries(rawMap).forEach(([k, v]) => {
      const ts = Date.parse(v);
      if (!Number.isNaN(ts) && ts >= cutoff) {
        prunedMap[k] = v;
      }
    });

    return {
      enabled: parsed.enabled !== false,
      slots: validSlots,
      lastFiredMap: prunedMap
    };
  } catch {
    return {
      enabled: true,
      slots: DEFAULT_REMINDER_SLOTS,
      lastFiredMap: {}
    };
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function isServiceWorkerSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistrations();
    const match = existing.find(reg => reg.active?.scriptURL.endsWith(NOTIFICATION_SW_PATH));
    if (match) return match;

    const registration = await navigator.serviceWorker.register(NOTIFICATION_SW_PATH, {
      scope: "/"
    });
    return registration;
  } catch (err) {
    console.warn("Erro ao registrar Service Worker de notificações:", err);
    return null;
  }
}

export function computeDailyNotificationSummary(
  clientsWithLoans: ClientWithLoanDetails[],
  targetDate: string
): DailyNotificationSummary {
  let morningCount = 0;
  let morningTotal = 0;
  let pendingTodayCount = 0;
  let pendingTodayAmount = 0;
  let paidTodayCount = 0;
  let paidTodayAmount = 0;
  const pendingNamesPreview: string[] = [];

  let overdueCount = 0;
  let overdueInstallments = 0;
  let overdueAmount = 0;

  clientsWithLoans.forEach(detail => {
    const loan = detail.activeLoan;
    if (!loan || detail.client.archived || loan.dailyRate <= 0 || loan.totalDays <= 0) return;

    // Count overdue debts
    if (loan.status !== "completed" && detail.isDelayed && detail.daysBehind >= 1 && detail.paidCount < detail.totalDays) {
      const behind = Math.min(detail.daysBehind, Math.max(0, detail.totalDays - detail.paidCount));
      overdueCount += 1;
      overdueInstallments += behind;
      overdueAmount = roundBRL(overdueAmount + behind * loan.dailyRate);
    }

    const latestStoredRef = detail.payments.reduce(
      (max, p) => (p.referenceDate > max ? p.referenceDate : max),
      ""
    );
    const isPaymentForTargetDay = (p: Payment) =>
      p.paymentDate === targetDate ||
      (p.referenceDate === targetDate && latestStoredRef === targetDate);

    const paidTodayList = detail.payments.filter(isPaymentForTargetDay);
    if (loan.status === "completed" && paidTodayList.length === 0) return;

    const scheduledDates = getLoanScheduledDates(loan);
    if (scheduledDates.length === 0) return;

    const freq = getLoanFrequency(loan);
    const firstDue = scheduledDates[0];
    let isScheduledForTargetDate = scheduledDates.includes(targetDate);

    if (!isScheduledForTargetDate && firstDue && targetDate >= firstDue) {
      if (freq === "daily") {
        isScheduledForTargetDate = !isSunday(targetDate) || loan.excludeSundays === false;
      } else if (freq === "weekly") {
        const targetWd =
          loan.paymentWeekday !== undefined && loan.paymentWeekday >= 0 && loan.paymentWeekday <= 6
            ? loan.paymentWeekday
            : getWeekdayFromDate(firstDue);
        isScheduledForTargetDate = getWeekdayFromDate(targetDate) === targetWd;
      } else {
        let cursor = scheduledDates[scheduledDates.length - 1];
        let guard = 0;
        while (cursor && cursor < targetDate && guard < 120) {
          guard++;
          cursor = stepReferenceDate(cursor, 1, loan);
          if (cursor === targetDate) {
            isScheduledForTargetDate = true;
            break;
          }
        }
      }
    }

    if (!isScheduledForTargetDate) return;

    const expectedUpToToday =
      targetDate > scheduledDates[scheduledDates.length - 1]
        ? loan.totalDays
        : scheduledDates.filter(d => d <= targetDate).length;

    const paymentsBeforeToday = detail.payments.filter(
      p => p.paymentDate < targetDate && !isPaymentForTargetDay(p)
    ).length;

    if (paymentsBeforeToday < expectedUpToToday) {
      morningCount += 1;
      morningTotal = roundBRL(morningTotal + loan.dailyRate);

      if (paidTodayList.length > 0) {
        const rawPaid = roundBRL(paidTodayList.reduce((s, p) => s + p.amount, 0));
        const dailyCredit = Math.min(loan.dailyRate, rawPaid);
        paidTodayCount += 1;
        paidTodayAmount = roundBRL(paidTodayAmount + dailyCredit);
      } else {
        pendingTodayCount += 1;
        pendingTodayAmount = roundBRL(pendingTodayAmount + loan.dailyRate);
        if (pendingNamesPreview.length < 3) {
          pendingNamesPreview.push(detail.client.name.split(" ")[0]);
        }
      }
    }
  });

  return {
    targetDate,
    morningCount,
    morningTotal,
    pendingTodayCount,
    pendingTodayAmount,
    paidTodayCount,
    paidTodayAmount,
    pendingNamesPreview,
    overdueCount,
    overdueInstallments,
    overdueAmount
  };
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(val);
}

export function buildReminderPayload(
  slot: NotificationReminderSlot,
  summary: DailyNotificationSummary,
  isTest: boolean = false
): NotificationPayload {
  const titlePrefix = isTest ? "Teste • " : "";
  const title = `Lagos Credit • ${titlePrefix}${slot.label}`;
  const parts: string[] = [];

  if (summary.pendingTodayCount > 0) {
    const names =
      summary.pendingNamesPreview.length > 0
        ? ` (${summary.pendingNamesPreview.join(", ")}${summary.pendingTodayCount > 3 ? "..." : ""})`
        : "";
    parts.push(
      `Faltam ${summary.pendingTodayCount} cliente(s) hoje = ${formatBRL(summary.pendingTodayAmount)}${names}.`
    );
  } else if (summary.morningCount > 0) {
    parts.push(
      `100% recebido hoje! ${summary.paidTodayCount} pagamento(s) somando ${formatBRL(summary.paidTodayAmount)}.`
    );
  } else {
    parts.push("Nenhuma parcela do dia agendada para hoje.");
  }

  if (slot.includeOverdue && summary.overdueCount > 0) {
    parts.push(
      `⚠️ Dívidas: ${summary.overdueCount} cliente(s) com ${summary.overdueInstallments}x em atraso (${formatBRL(summary.overdueAmount)}).`
    );
  }

  const targetTab: "home" | "debts" =
    summary.pendingTodayCount === 0 && summary.overdueCount > 0 ? "debts" : "home";

  return {
    title,
    body: parts.join(" "),
    tag: isTest
      ? `lagos-credit-test-${Date.now()}`
      : `lagos-credit-${slot.id}-${summary.targetDate}`,
    requireInteraction: summary.pendingTodayCount > 0 || summary.overdueCount > 0,
    data: { tab: targetTab }
  };
}

export async function dispatchBrowserNotification(payload: NotificationPayload): Promise<boolean> {
  if (getBrowserNotificationPermission() !== "granted") return false;

  try {
    if (isServiceWorkerSupported()) {
      const reg = await registerNotificationServiceWorker();
      if (reg) {
        await reg.showNotification(payload.title, {
          body: payload.body,
          icon: "/icon.svg",
          badge: "/icon.svg",
          tag: payload.tag,
          requireInteraction: Boolean(payload.requireInteraction),
          data: payload.data || { tab: "home" }
        });
        return true;
      }
    }
  } catch (err) {
    console.warn("Fallback para Notification API direta:", err);
  }

  try {
    const notif = new Notification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      tag: payload.tag
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return true;
  } catch (err) {
    console.error("Erro ao disparar notificação:", err);
    return false;
  }
}

function getLocalTodayDateAndSlotTimestamp(timeStr: string): { todayStr: string; triggerAtMs: number } {
  const now = new Date();
  const [hh, mm] = timeStr.split(":").map(Number);
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    Number.isFinite(hh) ? hh : 9,
    Number.isFinite(mm) ? mm : 0,
    0,
    0
  );
  return {
    todayStr: getTodayStr(),
    triggerAtMs: target.getTime()
  };
}

export async function syncRemindersWithServiceWorker(
  settings: NotificationSettings,
  summary: DailyNotificationSummary
): Promise<void> {
  if (!isServiceWorkerSupported()) return;
  const reg = await registerNotificationServiceWorker();
  const targetWorker = navigator.serviceWorker.controller || reg?.active;
  if (!targetWorker) return;

  if (!settings.enabled || getBrowserNotificationPermission() !== "granted") {
    targetWorker.postMessage({ type: "CLEAR_REMINDERS" });
    return;
  }

  const now = Date.now();
  const items = settings.slots
    .filter(slot => slot.enabled)
    .map(slot => {
      const { todayStr, triggerAtMs } = getLocalTodayDateAndSlotTimestamp(slot.time);
      const fireKey = `${slot.id}_${todayStr}`;
      if (settings.lastFiredMap[fireKey]) return null;

      // Only schedule upcoming alerts for today (or within next 24h if tomorrow)
      let scheduledMs = triggerAtMs;
      if (scheduledMs < now - 60 * 1000) {
        // Passed today; schedule for tomorrow at the exact same HH:MM
        scheduledMs += 24 * 60 * 60 * 1000;
      }

      return {
        id: fireKey,
        triggerAtMs: scheduledMs,
        payload: buildReminderPayload(slot, summary, false)
      };
    })
    .filter(Boolean);

  targetWorker.postMessage({
    type: "SYNC_REMINDERS",
    items
  });
}

/**
 * Checks if any enabled reminder slot is due now (within a 15-minute window after its HH:MM)
 * and hasn't fired yet today. Returns updated settings if any notification was dispatched.
 */
export async function checkAndFireDueReminders(
  settings: NotificationSettings,
  summary: DailyNotificationSummary
): Promise<{ updatedSettings: NotificationSettings; firedSlotLabels: string[] }> {
  if (!settings.enabled || getBrowserNotificationPermission() !== "granted") {
    return { updatedSettings: settings, firedSlotLabels: [] };
  }

  const now = Date.now();
  const GRACE_WINDOW_MS = 15 * 60 * 1000;
  const nextFiredMap = { ...settings.lastFiredMap };
  const firedSlotLabels: string[] = [];

  for (const slot of settings.slots) {
    if (!slot.enabled) continue;
    const { todayStr, triggerAtMs } = getLocalTodayDateAndSlotTimestamp(slot.time);
    const fireKey = `${slot.id}_${todayStr}`;
    if (nextFiredMap[fireKey]) continue;

    if (now >= triggerAtMs && now - triggerAtMs <= GRACE_WINDOW_MS) {
      const payload = buildReminderPayload(slot, summary, false);
      const sent = await dispatchBrowserNotification(payload);
      if (sent) {
        nextFiredMap[fireKey] = new Date().toISOString();
        firedSlotLabels.push(slot.label);
      }
    }
  }

  if (firedSlotLabels.length > 0) {
    const updatedSettings: NotificationSettings = {
      ...settings,
      lastFiredMap: nextFiredMap
    };
    saveNotificationSettings(updatedSettings);
    return { updatedSettings, firedSlotLabels };
  }

  return { updatedSettings: settings, firedSlotLabels: [] };
}

export function getNextScheduledReminder(
  settings: NotificationSettings
): { slot: NotificationReminderSlot; isToday: boolean } | null {
  if (!settings.enabled) return null;
  const activeSlots = settings.slots.filter(s => s.enabled);
  if (activeSlots.length === 0) return null;

  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todayStr = getTodayStr();

  const sorted = [...activeSlots].sort((a, b) => a.time.localeCompare(b.time));
  const nextToday = sorted.find(
    s => s.time > currentHHMM && !settings.lastFiredMap[`${s.id}_${todayStr}`]
  );

  if (nextToday) {
    return { slot: nextToday, isToday: true };
  }

  return { slot: sorted[0], isToday: false };
}
