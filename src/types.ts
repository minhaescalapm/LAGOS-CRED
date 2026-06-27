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
  dailyRate: number; // Valor da diária
  totalDays: number; // Tempo do empréstimo em dias
  startDate: string; // Data inicial YYYY-MM-DD
  excludeSundays?: boolean; // Se ignora os domingos no ciclo financeiro
  status?: string; // Status do contrato, e.g., 'active' ou 'completed'
}

export interface Payment {
  id: string;
  loanId: string;
  paymentDate: string; // Data real que o dinheiro caiu (YYYY-MM-DD)
  referenceDate: string; // Data de referência da parcela coberta (+1 dia por pagamento) (YYYY-MM-DD)
  amount: number; // Valor pago (geralmente igual à dailyRate, ou múltiplo)
}

// Full view model for client with active loans
export interface ClientWithLoanDetails {
  client: Client;
  activeLoan: Loan | null;
  payments: Payment[];
  paidCount: number; // Quantas parcelas pagas
  totalDays: number; // Dias totais do empréstimo
  referenceDate: string; // Data da última atualização / cobertura (YYYY-MM-DD)
  isDelayed: boolean; // Se o cliente está em atraso
  daysBehind: number; // Quantidade de diárias em atraso
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
