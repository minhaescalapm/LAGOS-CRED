export type PaymentFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export interface Client {
  id: string;
  name: string;
  phone: string; // Formatting / WhatsApp mask
  archived?: boolean; // Se o cliente está arquivado/desativado
}

export interface Loan {
  id: string;
  clientId: string;
  amountInvested: number; // Valor principal emprestado
  totalAmount: number; // Valor total a receber (amountInvested + juros, i.e., dailyRate * totalDays)
  dailyRate: number; // Valor da parcela (diária, semanal, quinzenal ou mensal)
  totalDays: number; // Quantidade total de parcelas (dias, semanas, quinzenas ou meses)
  startDate: string; // Data inicial YYYY-MM-DD
  excludeSundays?: boolean; // Se ignora os domingos no ciclo diário
  status?: string; // Status do contrato, e.g., 'active' ou 'completed'
  frequency?: PaymentFrequency; // Modalidade de pagamento (padrão: 'daily')
  paymentWeekday?: number; // Dia fixo da semana (0=Dom..6=Sáb), usado em cobranças semanais/quinzenais
  firstDueDate?: string; // Data da 1ª parcela YYYY-MM-DD (opcional)
}

export interface Payment {
  id: string;
  loanId: string;
  paymentDate: string; // Data real que o dinheiro caiu (YYYY-MM-DD)
  referenceDate: string; // Data de referência da parcela coberta (YYYY-MM-DD)
  amount: number; // Valor pago
}

// Full view model for client with active loans
export interface ClientWithLoanDetails {
  client: Client;
  activeLoan: Loan | null;
  payments: Payment[];
  paidCount: number; // Quantas parcelas pagas
  totalDays: number; // Quantidade total de parcelas do contrato
  referenceDate: string; // Data da última atualização / cobertura (YYYY-MM-DD)
  nextDueDate?: string; // Data prevista da próxima parcela em aberto (YYYY-MM-DD)
  isDelayed: boolean; // Se o cliente está em atraso
  daysBehind: number; // Quantidade de parcelas em atraso
  chargeCountToday?: number; // Quantidade de vezes que o cliente foi cobrado hoje
}

export interface FinancialStats {
  moneyInvested: number; // Dinheiro Investido (Soma total do principal de loans ativos)
  receivedThisMonth: number; // Recebidos no mês (com base no ciclo do dia 02 até dia 01)
  receivedThisWeek: number; // Recebidos nos últimos 7 dias
  totalProfit: number; // Diferença entre o esperado a receber e o investido para os contratos ativos
  pastReceived: { [monthLabel: string]: number }; // Histórico de recebimentos por mês financeiro
  futureProjections: number; // Projeção futura de recebimentos com base nos contratos ativos (o que falta receber)
  totalReceived: number; // Entradas totais de repasses já coletados
  monthlyProfit: number; // Lucro mensal realizado (juros do ciclo atual)
}
