import { Loan } from "../types";
import { addDays, formatFriendlyDate, isSunday } from "./dateUtils";
import {
  getLoanFrequency,
  getLoanFrequencyBadge,
  getLoanScheduledDates,
  stepReferenceDate
} from "./loanSchedule";

const PIX_KEY = "lagoscelular5@gmail.com";

export function formatWhatsAppPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }
  return `55${digits}`;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const formattedPhone = formatWhatsAppPhone(phone);
  if (!formattedPhone) return "";
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * For daily contracts with Sunday exemption, paying Saturday covers Sunday too.
 */
export function getDisplayCoverageDate(
  loan: Pick<Loan, "excludeSundays" | "frequency">,
  rawReferenceDate: string
): string {
  if (!rawReferenceDate) return rawReferenceDate;
  const freq = getLoanFrequency(loan);
  if (freq === "daily" && loan.excludeSundays !== false) {
    const nextDay = addDays(rawReferenceDate, 1);
    if (isSunday(nextDay)) {
      return nextDay;
    }
  }
  return rawReferenceDate;
}

/**
 * Returns the next due date after `newPaidCount` installments have been paid.
 */
export function getNextDueDateAfterPayment(
  loan: Pick<
    Loan,
    "startDate" | "totalDays" | "excludeSundays" | "frequency" | "paymentWeekday" | "firstDueDate"
  >,
  newPaidCount: number,
  rawReferenceDate: string
): string | undefined {
  if (newPaidCount >= loan.totalDays) return undefined;
  const scheduled = getLoanScheduledDates(loan);
  const candidate = scheduled[newPaidCount];
  if (candidate && (!rawReferenceDate || candidate > rawReferenceDate)) {
    return candidate;
  }
  if (rawReferenceDate) {
    return stepReferenceDate(rawReferenceDate, 1, loan);
  }
  return undefined;
}

export function buildPaymentReceiptText(params: {
  clientName: string;
  loan: Pick<
    Loan,
    "dailyRate" | "totalDays" | "frequency" | "paymentWeekday" | "startDate" | "firstDueDate"
  >;
  paidCount: number;
  totalDays: number;
  paymentDate: string;
  referenceDate: string;
  nextDueDate?: string;
  amountPaid: number;
}): string {
  const formatBRL = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val);

  const name = params.clientName.toUpperCase();
  const payDateFormatted = formatFriendlyDate(params.paymentDate);
  const refDateFormatted = formatFriendlyDate(params.referenceDate);
  const nextDueFormatted = params.nextDueDate ? formatFriendlyDate(params.nextDueDate) : "";
  const remainingCount = Math.max(0, params.totalDays - params.paidCount);
  const freqBadge = getLoanFrequencyBadge(params.loan);
  const amt = formatBRL(params.amountPaid);

  const statusLine =
    remainingCount === 0
      ? `PAGAS: ${params.paidCount}/${params.totalDays} (CONTRATO QUITADO)`
      : `PAGAS: ${params.paidCount}/${params.totalDays} (${remainingCount === 1 ? "Falta 1 prestação" : `Faltam ${remainingCount} prestações`})`;

  const nextDueLine = nextDueFormatted ? `\nPRÓXIMO VENCIMENTO: ${nextDueFormatted}` : "";

  return `${name}
PAGAMENTO CONFIRMADO (${freqBadge})
DATA DO PAGAMENTO: ${payDateFormatted}
ULTIMA ATUALIZAÇÃO: ${refDateFormatted}
${statusLine}${nextDueLine}
VALOR PAGO: ${amt}

FAÇA SEU PIX: ${PIX_KEY}

Estaremos a Disposição, não perca seu crédito.

🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n\n\n`;
}
