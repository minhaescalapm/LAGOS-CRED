import { Loan, Payment, PaymentFrequency } from "../types";
import { addDays, formatLocalDate, isSunday, parseLocalDate } from "./dateUtils";

export const WEEKDAY_NAMES_FULL = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado"
] as const;

export const WEEKDAY_NAMES_SHORT = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb"
] as const;

export const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal"
};

export const FREQUENCY_UNIT_PLURAL: Record<PaymentFrequency, string> = {
  daily: "dias",
  weekly: "semanas",
  biweekly: "quinzenas",
  monthly: "meses"
};

export const FREQUENCY_UNIT_SINGULAR: Record<PaymentFrequency, string> = {
  daily: "diária",
  weekly: "semanal",
  biweekly: "quinzenal",
  monthly: "mensal"
};

export function getLoanFrequency(loan?: Pick<Loan, "frequency"> | null): PaymentFrequency {
  const f = loan?.frequency;
  if (f === "weekly" || f === "biweekly" || f === "monthly" || f === "daily") {
    return f;
  }
  return "daily";
}

export function getWeekdayFromDate(dateStr: string): number {
  if (!dateStr) return 5; // Sexta-feira fallback
  return parseLocalDate(dateStr).getDay();
}

export function addMonthsClamped(dateStr: string, monthsToAdd: number): string {
  const base = parseLocalDate(dateStr);
  const targetDay = base.getDate();
  const targetMonthIndex = base.getMonth() + monthsToAdd;
  const firstOfTargetMonth = new Date(base.getFullYear(), targetMonthIndex, 1);
  const daysInTargetMonth = new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth() + 1,
    0
  ).getDate();
  const clampedDay = Math.min(targetDay, daysInTargetMonth);
  return formatLocalDate(
    new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth(), clampedDay)
  );
}

/**
 * Computes the next occurrence of `weekday` (0..6) strictly after `startDate`
 * (if startDate itself is already that weekday, returns +7 days so first payment is next week).
 */
export function getNextWeekdayAfter(startDate: string, weekday: number): string {
  if (!startDate) return startDate;
  const startDay = parseLocalDate(startDate).getDay();
  let delta = (weekday - startDay + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(startDate, delta);
}

/**
 * Computes the default first due date for a contract given its startDate and frequency parameters.
 */
export function computeDefaultFirstDueDate(
  startDate: string,
  frequency: PaymentFrequency,
  excludeSundays: boolean = true,
  paymentWeekday?: number
): string {
  if (!startDate) return startDate;

  if (frequency === "weekly") {
    const targetWeekday =
      paymentWeekday !== undefined && paymentWeekday >= 0 && paymentWeekday <= 6
        ? paymentWeekday
        : getWeekdayFromDate(startDate);
    return getNextWeekdayAfter(startDate, targetWeekday);
  }

  if (frequency === "biweekly") {
    if (paymentWeekday !== undefined && paymentWeekday >= 0 && paymentWeekday <= 6) {
      const nextWd = getNextWeekdayAfter(startDate, paymentWeekday);
      // Ensure at least ~10 days if next weekday is very close? No, if user picked a weekday/firstDueDate, use next weekday or +14
      const diffDays = Math.round(
        (parseLocalDate(nextWd).getTime() - parseLocalDate(startDate).getTime()) / 86400000
      );
      return diffDays < 7 ? addDays(nextWd, 7) : nextWd;
    }
    return addDays(startDate, 15);
  }

  if (frequency === "monthly") {
    return addMonthsClamped(startDate, 1);
  }

  // Daily
  let first = addDays(startDate, 1);
  if (excludeSundays && isSunday(first)) {
    first = addDays(first, 1);
  }
  return first;
}

/**
 * Generates the exact ordered list of scheduled due dates (YYYY-MM-DD) for any loan contract.
 */
export function getLoanScheduledDates(
  loan: Pick<Loan, "startDate" | "totalDays" | "excludeSundays" | "frequency" | "paymentWeekday" | "firstDueDate">,
  countOverride?: number
): string[] {
  const targetCount = Math.max(0, countOverride !== undefined ? countOverride : loan.totalDays);
  if (targetCount === 0 || !loan.startDate) return [];

  const frequency = getLoanFrequency(loan);
  const isExcluding = loan.excludeSundays !== false;

  if (frequency === "daily") {
    const dates: string[] = [];
    let current = loan.firstDueDate ? loan.firstDueDate : addDays(loan.startDate, 1);
    let iterations = 0;
    while (dates.length < targetCount && iterations < 2000) {
      iterations++;
      if (!isExcluding || !isSunday(current)) {
        dates.push(current);
      }
      current = addDays(current, 1);
    }
    return dates;
  }

  const firstDue =
    loan.firstDueDate && loan.firstDueDate > loan.startDate
      ? loan.firstDueDate
      : computeDefaultFirstDueDate(loan.startDate, frequency, isExcluding, loan.paymentWeekday);

  const dates: string[] = [];
  if (frequency === "weekly") {
    for (let i = 0; i < targetCount; i++) {
      dates.push(addDays(firstDue, i * 7));
    }
    return dates;
  }

  if (frequency === "biweekly") {
    const stepDays =
      loan.paymentWeekday !== undefined && loan.paymentWeekday >= 0 && loan.paymentWeekday <= 6
        ? 14
        : 15;
    for (let i = 0; i < targetCount; i++) {
      dates.push(addDays(firstDue, i * stepDays));
    }
    return dates;
  }

  // monthly
  for (let i = 0; i < targetCount; i++) {
    dates.push(addMonthsClamped(firstDue, i));
  }
  return dates;
}

/**
 * Steps `steps` installments forward from `baseRefDate` following the loan's frequency rules.
 */
export function stepReferenceDate(
  baseRefDate: string,
  steps: number,
  loan: Pick<Loan, "excludeSundays" | "frequency" | "paymentWeekday">
): string {
  const frequency = getLoanFrequency(loan);
  const isExcluding = loan.excludeSundays !== false;
  let current = baseRefDate;

  if (steps <= 0) return current;

  if (frequency === "weekly") {
    return addDays(current, steps * 7);
  }
  if (frequency === "biweekly") {
    const stepDays =
      loan.paymentWeekday !== undefined && loan.paymentWeekday >= 0 && loan.paymentWeekday <= 6
        ? 14
        : 15;
    return addDays(current, steps * stepDays);
  }
  if (frequency === "monthly") {
    return addMonthsClamped(current, steps);
  }

  for (let i = 0; i < steps; i++) {
    current = addDays(current, 1);
    if (isExcluding && isSunday(current)) {
      current = addDays(current, 1);
    }
  }
  return current;
}

/**
 * Computes retroactive startDate given `closingDate`, `paidCount` installments already paid, and frequency.
 */
export function getRetroactiveStartDateForFrequency(
  closingDate: string,
  paidCount: number,
  frequency: PaymentFrequency,
  excludeSundays: boolean = true,
  paymentWeekday?: number
): string {
  if (paidCount <= 0 || !closingDate) return closingDate;

  if (frequency === "weekly") {
    // If `paidCount` weekly installments have been paid up to `closingDate`,
    // the contract started 1 week before the 1st installment
    const firstInstallment = addDays(closingDate, -(paidCount - 1) * 7);
    return addDays(firstInstallment, -7);
  }

  if (frequency === "biweekly") {
    const stepDays =
      paymentWeekday !== undefined && paymentWeekday >= 0 && paymentWeekday <= 6 ? 14 : 15;
    const firstInstallment = addDays(closingDate, -(paidCount - 1) * stepDays);
    return addDays(firstInstallment, -stepDays);
  }

  if (frequency === "monthly") {
    const firstInstallment = addMonthsClamped(closingDate, -(paidCount - 1));
    return addMonthsClamped(firstInstallment, -1);
  }

  // Daily
  let count = 0;
  let tempDate = closingDate;
  while (count < paidCount) {
    if (!excludeSundays || !isSunday(tempDate)) {
      count++;
      if (count === paidCount) {
        return addDays(tempDate, -1);
      }
    }
    tempDate = addDays(tempDate, -1);
  }
  return addDays(tempDate, -1);
}

/**
 * Returns a human-friendly badge label for a loan's payment frequency (e.g., "Semanal • Sexta").
 */
export function getLoanFrequencyBadge(loan?: Pick<Loan, "frequency" | "paymentWeekday" | "startDate" | "firstDueDate"> | null): string {
  const freq = getLoanFrequency(loan);
  if (freq === "weekly") {
    const wd =
      loan?.paymentWeekday !== undefined && loan.paymentWeekday >= 0 && loan.paymentWeekday <= 6
        ? loan.paymentWeekday
        : loan?.firstDueDate
          ? getWeekdayFromDate(loan.firstDueDate)
          : loan?.startDate
            ? getWeekdayFromDate(loan.startDate)
            : 5;
    return `Semanal • ${WEEKDAY_NAMES_SHORT[wd]}`;
  }
  if (freq === "biweekly") {
    if (loan?.paymentWeekday !== undefined && loan.paymentWeekday >= 0 && loan.paymentWeekday <= 6) {
      return `Quinzenal • ${WEEKDAY_NAMES_SHORT[loan.paymentWeekday]}`;
    }
    return "Quinzenal";
  }
  if (freq === "monthly") {
    const dayRef = loan?.firstDueDate || loan?.startDate;
    if (dayRef) {
      const day = dayRef.split("-")[2];
      if (day) return `Mensal • Dia ${day}`;
    }
    return "Mensal";
  }
  return "Diária";
}

/**
 * Estimated monthly multiplier for projecting monthly billing from installment rate.
 */
export function getMonthlyBillingMultiplier(loan: Pick<Loan, "frequency" | "excludeSundays">): number {
  const freq = getLoanFrequency(loan);
  if (freq === "weekly") return 4.33;
  if (freq === "biweekly") return 2;
  if (freq === "monthly") return 1;
  return loan.excludeSundays !== false ? 26 : 30;
}

export interface LoanEndProjection {
  /** Data final prevista no cronograma original (sem contar domingos isentos) */
  scheduledEndDate: string;
  /** Data real prevista do último pagamento considerando parcelas restantes e eventuais atrasos */
  projectedEndDate: string;
  /** Quantidade de parcelas que ainda faltam */
  remainingInstallments: number;
  /** Indica se o prazo se estendeu além da data original por parcelas em atraso */
  isExtendedByDelay: boolean;
}

/**
 * Calcula a data exata do último pagamento de um contrato (ex.: 100 diárias sem contar os domingos isentos),
 * considerando tanto o cronograma original quanto o saldo de parcelas restantes a partir de `baseToday`.
 */
export function getLoanFinalPaymentProjection(
  loan: Pick<Loan, "startDate" | "totalDays" | "excludeSundays" | "frequency" | "paymentWeekday" | "firstDueDate">,
  paidCount: number,
  payments: Pick<Payment, "paymentDate" | "referenceDate">[],
  baseToday: string
): LoanEndProjection {
  const scheduledDates = getLoanScheduledDates(loan);
  const scheduledEndDate =
    scheduledDates.length > 0 ? scheduledDates[scheduledDates.length - 1] : loan.startDate;
  const remainingInstallments = Math.max(0, loan.totalDays - paidCount);

  const latestStoredRef = payments.reduce(
    (max, p) => (p.referenceDate > max ? p.referenceDate : max),
    ""
  );

  if (remainingInstallments === 0) {
    return {
      scheduledEndDate,
      projectedEndDate: latestStoredRef || scheduledEndDate,
      remainingInstallments: 0,
      isExtendedByDelay: false
    };
  }

  const nextScheduled = paidCount < scheduledDates.length ? scheduledDates[paidCount] : undefined;
  if (nextScheduled && nextScheduled >= baseToday) {
    return {
      scheduledEndDate,
      projectedEndDate: scheduledEndDate,
      remainingInstallments,
      isExtendedByDelay: false
    };
  }

  const freq = getLoanFrequency(loan);
  const isExcluding = loan.excludeSundays !== false;
  const hasPaidToday = payments.some(
    p => p.paymentDate === baseToday || (p.referenceDate === baseToday && latestStoredRef === baseToday)
  );
  const minDate = hasPaidToday ? addDays(baseToday, 1) : baseToday;

  let firstActiveDate: string;
  if (freq === "daily") {
    firstActiveDate = minDate;
    if (isExcluding && isSunday(firstActiveDate)) {
      firstActiveDate = addDays(firstActiveDate, 1);
    }
  } else {
    firstActiveDate = nextScheduled || scheduledEndDate || minDate;
    let guard = 0;
    while (firstActiveDate < minDate && guard < 500) {
      guard++;
      firstActiveDate = stepReferenceDate(firstActiveDate, 1, loan);
    }
  }

  const projectedEndDate = stepReferenceDate(firstActiveDate, remainingInstallments - 1, loan);
  return {
    scheduledEndDate,
    projectedEndDate,
    remainingInstallments,
    isExtendedByDelay: projectedEndDate > scheduledEndDate
  };
}
