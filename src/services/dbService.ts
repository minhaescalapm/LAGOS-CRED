import { Client, Loan, Payment, ClientWithLoanDetails, FinancialStats, PaymentFrequency } from "../types";
import { 
  addDays, 
  getTodayStr, 
  getFinancialCycle, 
  getLastNFinancialCycles,
  isSunday
} from "../utils/dateUtils";
import {
  computeDefaultFirstDueDate,
  getLoanFrequency,
  getLoanScheduledDates,
  stepReferenceDate
} from "../utils/loanSchedule";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

// Keys for LocalStorage fallback
const CLIENTS_KEY = "gestao_emprestimos_clients";
const LOANS_KEY = "gestao_emprestimos_loans";
const PAYMENTS_KEY = "gestao_emprestimos_payments";
const ARCHIVED_CLIENTS_KEY = "gestao_emprestimos_archived_client_ids";
const LOAN_META_KEY = "gestao_emprestimos_loan_schedule_meta";

function generateUUID(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch (e) {
    // Ignore and fallback
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Seed initial mockup data in Local Storage
function seedLocalMockData() {
  const mockClients: Client[] = [
    { id: "c1", name: "Carlos Henrique Silva", phone: "11988887777" },
    { id: "c2", name: "Ana Beatriz Souza", phone: "11977776666" },
    { id: "c3", name: "Marcos Antonio Barbosa", phone: "11966665555" },
    { id: "c4", name: "Julia Ferreira Costa", phone: "11955554444" },
    { id: "c5", name: "Ricardo Santos Oliveira", phone: "11944443333" }
  ];

  const mockLoans: Loan[] = [
    {
      id: "l1",
      clientId: "c1",
      amountInvested: 1000,
      totalAmount: 1300,
      dailyRate: 50,
      totalDays: 26,
      startDate: "2026-05-25"
    },
    {
      id: "l2",
      clientId: "c2",
      amountInvested: 500,
      totalAmount: 650,
      dailyRate: 25,
      totalDays: 26,
      startDate: "2026-06-10"
    },
    {
      id: "l3",
      clientId: "c3",
      amountInvested: 2000,
      totalAmount: 2600,
      dailyRate: 100,
      totalDays: 26,
      startDate: "2026-05-18"
    },
    {
      id: "l4",
      clientId: "c4",
      amountInvested: 1500,
      totalAmount: 1950,
      dailyRate: 75,
      totalDays: 26,
      startDate: "2026-06-15"
    }
  ];

  const mockPayments: Payment[] = [];

  // 1. Carlos Henrinque (17 payments)
  for (let i = 0; i < 17; i++) {
    mockPayments.push({
      id: `p1_${i}`,
      loanId: "l1",
      paymentDate: addDays("2026-05-25", i),
      referenceDate: addDays("2026-05-25", i),
      amount: 50
    });
  }

  // 2. Ana Souza (9 payments)
  for (let i = 0; i < 9; i++) {
    mockPayments.push({
      id: `p2_${i}`,
      loanId: "l2",
      paymentDate: addDays("2026-06-10", i),
      referenceDate: addDays("2026-06-10", i),
      amount: 25
    });
  }

  // 3. Marcos Barbosa (12 payments)
  for (let i = 0; i < 12; i++) {
    mockPayments.push({
      id: `p3_${i}`,
      loanId: "l3",
      paymentDate: addDays("2026-05-18", i),
      referenceDate: addDays("2026-05-18", i),
      amount: 100
    });
  }

  // 4. Julia Ferreira (4 payments)
  for (let i = 0; i < 4; i++) {
    mockPayments.push({
      id: `p4_${i}`,
      loanId: "l4",
      paymentDate: addDays("2026-06-15", i),
      referenceDate: addDays("2026-06-15", i),
      amount: 75
    });
  }

  localStorage.setItem(CLIENTS_KEY, JSON.stringify(mockClients));
  localStorage.setItem(LOANS_KEY, JSON.stringify(mockLoans));
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(mockPayments));
}

// Map database column names to client interfaces
function mapClients(supabaseClients: any[]): Client[] {
  return supabaseClients.map(c => ({
    id: String(c.id),
    name: String(c.name || ""),
    phone: String(c.phone || ""),
    archived: c.archived !== undefined ? Boolean(c.archived) : false
  }));
}

type LoanScheduleMeta = {
  frequency?: PaymentFrequency;
  paymentWeekday?: number;
  firstDueDate?: string;
};

function getLoanMetaMap(): Record<string, LoanScheduleMeta> {
  try {
    const raw = localStorage.getItem(LOAN_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLoanMeta(loanId: string, meta: LoanScheduleMeta): void {
  try {
    const current = getLoanMetaMap();
    current[loanId] = {
      frequency: meta.frequency || "daily",
      paymentWeekday: meta.paymentWeekday,
      firstDueDate: meta.firstDueDate
    };
    localStorage.setItem(LOAN_META_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage quota errors
  }
}

function isMissingColumnError(error: any): boolean {
  const msg = String(error?.message || error?.details || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code === "PGRST204" ||
    code === "42703" ||
    msg.includes("column") ||
    msg.includes("schema cache")
  );
}

function mapLoans(supabaseLoans: any[]): Loan[] {
  const metaMap = getLoanMetaMap();
  return supabaseLoans.map(l => {
    const id = String(l.id);
    const localMeta = metaMap[id];
    const rawFreq = l.frequency ?? localMeta?.frequency;
    const frequency: PaymentFrequency =
      rawFreq === "weekly" || rawFreq === "biweekly" || rawFreq === "monthly" || rawFreq === "daily"
        ? rawFreq
        : "daily";
    const rawWeekday = l.payment_weekday ?? l.paymentWeekday ?? localMeta?.paymentWeekday;
    const paymentWeekday =
      rawWeekday !== undefined && rawWeekday !== null && rawWeekday !== ""
        ? Number(rawWeekday)
        : undefined;
    const rawFirstDue = l.first_due_date || l.firstDueDate || localMeta?.firstDueDate;
    return {
      id,
      clientId: String(l.client_id || l.clientId || ""),
      amountInvested: Number(l.amount_invested ?? l.amountInvested ?? 0),
      totalAmount: Number(l.total_amount ?? l.totalAmount ?? 0),
      dailyRate: Number(l.daily_rate ?? l.dailyRate ?? 0),
      totalDays: Number(l.total_days ?? l.totalDays ?? 0),
      startDate: String(l.start_date || l.startDate || ""),
      excludeSundays:
        l.exclude_sundays !== undefined
          ? Boolean(l.exclude_sundays)
          : l.excludeSundays !== undefined
            ? Boolean(l.excludeSundays)
            : true,
      status: l.status ? String(l.status) : undefined,
      frequency,
      paymentWeekday: Number.isFinite(paymentWeekday) ? paymentWeekday : undefined,
      firstDueDate: rawFirstDue ? String(rawFirstDue) : undefined
    };
  });
}

function mapPayments(supabasePayments: any[]): Payment[] {
  return supabasePayments.map(p => ({
    id: String(p.id),
    loanId: String(p.loan_id || p.loanId || ""),
    paymentDate: String(p.payment_date || p.paymentDate || ""),
    referenceDate: String(p.reference_date || p.referenceDate || ""),
    amount: Number(p.amount ?? 0)
  }));
}

// Initial seeding of localStorage ONLY if empty. Now defaulted to empty array to allow a 100% blank slate.
if (!localStorage.getItem(CLIENTS_KEY) || !localStorage.getItem("wiped_tests_v2")) {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify([]));
  localStorage.setItem(LOANS_KEY, JSON.stringify([]));
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify([]));
  localStorage.setItem("wiped_tests_v2", "true");
}

// Per-loan async mutex to prevent concurrent/racing mutations for the same contract
const loanOperationLocks = new Map<string, Promise<unknown>>();

async function withLoanLock<T>(loanId: string, task: () => Promise<T>): Promise<T> {
  const previous = loanOperationLocks.get(loanId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  const tracked = current.finally(() => {
    if (loanOperationLocks.get(loanId) === tracked) {
      loanOperationLocks.delete(loanId);
    }
  });
  loanOperationLocks.set(loanId, tracked);
  return current;
}

export function deduplicateAndSortPayments(payments: Payment[]): Payment[] {
  const byId = new Map<string, Payment>();
  for (const p of payments) {
    if (!p || !p.id) continue;
    byId.set(p.id, p);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const refCmp = a.referenceDate.localeCompare(b.referenceDate);
    if (refCmp !== 0) return refCmp;
    const payCmp = a.paymentDate.localeCompare(b.paymentDate);
    if (payCmp !== 0) return payCmp;
    return a.id.localeCompare(b.id);
  });
}

export function buildClientLoanDetail(
  client: Client,
  loan: Loan | null,
  rawPaymentsForLoan: Payment[],
  simulationDate: string = getTodayStr(),
  chargeCountToday: number = 0
): ClientWithLoanDetails {
  if (!loan) {
    return {
      client,
      activeLoan: null,
      payments: [],
      paidCount: 0,
      totalDays: 0,
      referenceDate: "",
      isDelayed: false,
      daysBehind: 0,
      chargeCountToday
    };
  }

  const loanPayments = deduplicateAndSortPayments(
    rawPaymentsForLoan.filter(p => p.loanId === loan.id)
  );
  const paidCount = loanPayments.length;
  const totalDays = loan.totalDays;
  const freq = getLoanFrequency(loan);

  let referenceDate = "";
  if (paidCount > 0) {
    const lastPaidRef = loanPayments[paidCount - 1].referenceDate;
    referenceDate = lastPaidRef;

    // Se for modalidade diária com domingos isentos e o dia seguinte for domingo,
    // o cliente está coberto também no domingo.
    if (freq === "daily" && loan.excludeSundays !== false) {
      const nextDay = addDays(lastPaidRef, 1);
      if (isSunday(nextDay)) {
        referenceDate = nextDay;
      }
    }
  } else {
    referenceDate = loan.startDate;
  }

  const allScheduledDates = getLoanScheduledDates(loan);
  const nextDueDate = paidCount < allScheduledDates.length ? allScheduledDates[paidCount] : undefined;

  const isToday = simulationDate === getTodayStr();
  const currentHour = new Date().getHours();
  const limitDate = (isToday && currentHour < 19) ? addDays(simulationDate, -1) : simulationDate;

  const expectedPayments = allScheduledDates.filter(d => d <= limitDate).length;
  const daysBehind = Math.max(0, expectedPayments - paidCount);
  const isDelayed = daysBehind >= 1 && paidCount < totalDays;

  return {
    client,
    activeLoan: loan,
    payments: loanPayments,
    paidCount,
    totalDays,
    referenceDate,
    nextDueDate,
    isDelayed,
    daysBehind: paidCount >= totalDays ? 0 : daysBehind,
    chargeCountToday
  };
}

function mergePaymentsIntoLocalCache(paymentsToMerge: Payment[]): void {
  try {
    const raw = localStorage.getItem(PAYMENTS_KEY);
    const existing: Payment[] = raw ? JSON.parse(raw) : [];
    const merged = deduplicateAndSortPayments([...existing, ...paymentsToMerge]);
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage quota or parse errors
  }
}

function computeClientDetailsList(
  clients: Client[],
  loans: Loan[],
  payments: Payment[],
  simulationDate: string,
  getChargeCountFn: (clientId: string, dateStr: string) => number
): ClientWithLoanDetails[] {
  const activeClients = clients.filter(c => !c.archived);

  return activeClients.flatMap(client => {
    const clientLoans = loans
      .filter(l => l.clientId === client.id && l.status !== "completed")
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    const chargeCount = getChargeCountFn(client.id, simulationDate);

    if (clientLoans.length === 0) {
      return [buildClientLoanDetail(client, null, [], simulationDate, chargeCount)];
    }

    return clientLoans.map(loan =>
      buildClientLoanDetail(client, loan, payments, simulationDate, chargeCount)
    );
  });
}

function computeFinancialStats(
  clients: Client[],
  loans: Loan[],
  payments: Payment[],
  simulationDate: string
): FinancialStats {
  const archivedClientIds = clients.filter(c => c.archived).map(c => c.id);

  // 1. Dinheiro Investido (Soma total do valor principal emprestado de contratos ativos)
  const activeLoans = loans.filter(loan => {
    if (archivedClientIds.includes(loan.clientId)) return false;
    if (loan.status === "completed") return false;
    const loanPaymentsCount = payments.filter(p => p.loanId === loan.id).length;
    return loanPaymentsCount < loan.totalDays;
  });

  const moneyInvested = activeLoans.reduce((sum, l) => sum + l.amountInvested, 0);

  // 2. Lucro: Diferença entre o total a receber (com juros) e o investido nos contratos ativos
  const totalProfit = activeLoans.reduce((sum, l) => {
    const totalAmt = l.totalAmount || (l.dailyRate * l.totalDays);
    return sum + (totalAmt - l.amountInvested);
  }, 0);

  // 3. Recebidos no Mês (com base no ciclo crítico: do dia 02 do mês atual até o dia 01 do mês seguinte)
  const currentMonthCycle = getFinancialCycle(simulationDate);
  const receivedThisMonth = payments
    .filter(p => p.paymentDate >= currentMonthCycle.start && p.paymentDate <= currentMonthCycle.end)
    .reduce((sum, p) => sum + p.amount, 0);

  // 4. Recebidos na Semana: Recebidos nos últimos 7 dias
  const sevenDaysAgo = addDays(simulationDate, -6);
  const receivedThisWeek = payments
    .filter(p => p.paymentDate >= sevenDaysAgo && p.paymentDate <= simulationDate)
    .reduce((sum, p) => sum + p.amount, 0);

  // 5. Histórico passado
  const last3Cycles = getLastNFinancialCycles(simulationDate, 4);
  const pastReceived: { [monthLabel: string]: number } = {};

  last3Cycles.forEach(cycle => {
    const cycleTotal = payments
      .filter(p => p.paymentDate >= cycle.start && p.paymentDate <= cycle.end)
      .reduce((sum, p) => sum + p.amount, 0);

    pastReceived[cycle.label] = cycleTotal;
  });

  // 6. Projeção Futura (Falta receber nos contratos ativos)
  const futureProjections = activeLoans.reduce((sum, loan) => {
    const loanPayments = payments.filter(p => p.loanId === loan.id);
    const remainingPayments = Math.max(0, loan.totalDays - loanPayments.length);
    return sum + (remainingPayments * loan.dailyRate);
  }, 0);

  // 7. Total de Entradas (Repasses Coletados)
  const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);

  // 8. Lucro Mensal Realizado (com base no ciclo do dia 02 até dia 01)
  const monthlyProfit = payments
    .filter(p => p.paymentDate >= currentMonthCycle.start && p.paymentDate <= currentMonthCycle.end)
    .reduce((pSum, pay) => {
      const loan = loans.find(l => l.id === pay.loanId);
      if (!loan || loan.amountInvested === 0) return pSum;
      const totalAmt = loan.totalAmount || (loan.dailyRate * loan.totalDays);
      if (totalAmt <= 0) return pSum;
      const profitRatio = (totalAmt - loan.amountInvested) / totalAmt;
      return pSum + (pay.amount * profitRatio);
    }, 0);

  return {
    moneyInvested,
    receivedThisMonth,
    receivedThisWeek,
    totalProfit,
    pastReceived,
    futureProjections,
    totalReceived,
    monthlyProfit
  };
}

// Helper to fetch ALL rows from Supabase bypassing the 1,000-row PostgREST limit (with 1 automatic retry)
async function fetchAllFromSupabase<T = any>(
  table: string,
  primaryOrderCol?: { column: string; ascending: boolean },
  filterEq?: { column: string; value: string }
): Promise<T[]> {
  if (!supabase) return [];
  const PAGE_SIZE = 1000;

  const runFetch = async (): Promise<T[]> => {
    let allRows: T[] = [];
    let from = 0;

    while (true) {
      let query = supabase!.from(table).select("*").range(from, from + PAGE_SIZE - 1);
      if (filterEq) {
        query = query.eq(filterEq.column, filterEq.value);
      }
      if (primaryOrderCol) {
        query = query.order(primaryOrderCol.column, { ascending: primaryOrderCol.ascending });
      }
      query = query.order("id", { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      allRows = allRows.concat(data as T[]);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return allRows;
  };

  try {
    return await runFetch();
  } catch (firstErr) {
    await new Promise(resolve => setTimeout(resolve, 250));
    return await runFetch();
  }
}

export const dbService = {
  // SUPABASE CONFIGURATION FLAG LISTENER
  isUsingSupabase(): boolean {
    return isSupabaseConfigured();
  },

  // GET ALL REQUIRING RECORDS (WITH FULL PAGINATION > 1000 ROWS)
  async getClients(options?: { throwOnCloudError?: boolean }): Promise<Client[]> {
    let list: Client[] = [];
    let fetchedFromCloud = false;
    if (supabase) {
      try {
        const data = await fetchAllFromSupabase("clients", { column: "name", ascending: true });
        list = mapClients(data);
        fetchedFromCloud = true;
        try {
          localStorage.setItem(CLIENTS_KEY, JSON.stringify(list));
        } catch {
          // Ignore storage quota errors
        }
      } catch (err) {
        if (options?.throwOnCloudError) {
          throw err;
        }
        console.warn("Supabase Error, falling back to localStorage:", err);
      }
    }
    
    if (!fetchedFromCloud) {
      const data = localStorage.getItem(CLIENTS_KEY);
      list = data ? JSON.parse(data) : [];
    }

    // Load local archiving status
    const archivedIdsStr = localStorage.getItem(ARCHIVED_CLIENTS_KEY);
    const archivedIds: string[] = archivedIdsStr ? JSON.parse(archivedIdsStr) : [];

    return list.map(c => ({
      ...c,
      archived: c.archived || archivedIds.includes(c.id)
    })).sort((a, b) => a.name.localeCompare(b.name));
  },

  async getLoans(options?: { throwOnCloudError?: boolean }): Promise<Loan[]> {
    if (supabase) {
      try {
        const data = await fetchAllFromSupabase("loans", { column: "start_date", ascending: false });
        const mapped = mapLoans(data);
        try {
          localStorage.setItem(LOANS_KEY, JSON.stringify(mapped));
        } catch {
          // Ignore storage quota errors
        }
        return mapped;
      } catch (err) {
        if (options?.throwOnCloudError) {
          throw err;
        }
        console.warn("Supabase Error, falling back to localStorage:", err);
      }
    }
    const data = localStorage.getItem(LOANS_KEY);
    return data ? JSON.parse(data) : [];
  },

  async getPayments(options?: { throwOnCloudError?: boolean }): Promise<Payment[]> {
    if (supabase) {
      try {
        const data = await fetchAllFromSupabase("payments", { column: "reference_date", ascending: true });
        const mapped = deduplicateAndSortPayments(mapPayments(data));
        try {
          localStorage.setItem(PAYMENTS_KEY, JSON.stringify(mapped));
        } catch {
          // Ignore storage quota errors
        }
        return mapped;
      } catch (err) {
        if (options?.throwOnCloudError) {
          throw err;
        }
        console.warn("Supabase Error, falling back to localStorage:", err);
      }
    }
    const data = localStorage.getItem(PAYMENTS_KEY);
    return data ? deduplicateAndSortPayments(JSON.parse(data)) : [];
  },

  // ADD NEW CLIENT
  async addClient(name: string, phone: string): Promise<Client> {
    const cleanedPhone = phone.replace(/\D/g, "");
    const newClient: Client = {
      id: generateUUID(),
      name: name.trim(),
      phone: cleanedPhone
    };

    if (supabase) {
      try {
        const { error } = await supabase.from("clients").insert({
          id: newClient.id,
          name: newClient.name,
          phone: newClient.phone
        });
        if (error) {
          throw new Error(`Erro ao salvar cliente no Supabase: ${error.message}. Por favor, verifique se executou o arquivo "schema.sql" no editor SQL do seu painel Supabase.`);
        }
        return newClient;
      } catch (err: any) {
        console.error("Supabase client insertion error:", err);
        throw err;
      }
    }

    const clients = await this.getClients();
    clients.push(newClient);
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
    return newClient;
  },

  // EDIT CLIENT
  async editClient(id: string, name: string, phone: string): Promise<Client> {
    const cleanedPhone = phone.replace(/\D/g, "");
    const trimmedName = name.trim();

    // Ensure edited client is unarchived
    await this.unarchiveClient(id);

    if (supabase) {
      try {
        const { error } = await supabase.from("clients").update({
          name: trimmedName,
          phone: cleanedPhone
        }).eq("id", id);
        if (error) {
          throw new Error(`Erro ao atualizar cliente no Supabase: ${error.message}`);
        }
        return { id, name: trimmedName, phone: cleanedPhone };
      } catch (err: any) {
        console.error("Supabase client edit error:", err);
        throw err;
      }
    }

    const clients = await this.getClients();
    clients.forEach(c => {
      if (c.id === id) {
        c.name = trimmedName;
        c.phone = cleanedPhone;
      }
    });
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
    return { id, name: trimmedName, phone: cleanedPhone };
  },

  // UNARCHIVE/RESTORE CLIENT
  async unarchiveClient(clientId: string): Promise<void> {
    // Remove from local storage list
    const archivedIdsStr = localStorage.getItem(ARCHIVED_CLIENTS_KEY);
    if (archivedIdsStr) {
      let archivedIds: string[] = JSON.parse(archivedIdsStr);
      archivedIds = archivedIds.filter(id => id !== clientId);
      localStorage.setItem(ARCHIVED_CLIENTS_KEY, JSON.stringify(archivedIds));
    }

    // Try to update client in Supabase
    if (supabase) {
      try {
        await supabase
          .from("clients")
          .update({ archived: false })
          .eq("id", clientId);
      } catch (err) {
        console.warn("Could not unarchive client in Supabase. Table schema might not have archived column.", err);
      }
    }

    // Update locally stored client list if any
    const data = localStorage.getItem(CLIENTS_KEY);
    if (data) {
      const clients: Client[] = JSON.parse(data);
      clients.forEach(c => {
        if (c.id === clientId) {
          c.archived = false;
        }
      });
      localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
    }
  },

  // ADD NEW LOAN
  async addLoan(
    clientId: string, 
    amountInvested: number, 
    totalDays: number, 
    dailyRate: number, 
    startDate: string,
    options?: {
      frequency?: PaymentFrequency;
      paymentWeekday?: number;
      firstDueDate?: string;
      excludeSundays?: boolean;
    }
  ): Promise<Loan> {
    // Ensure the client is unarchived when starting a new contract
    await this.unarchiveClient(clientId);

    const frequency: PaymentFrequency = options?.frequency || "daily";
    const excludeSundays = options?.excludeSundays !== undefined ? options.excludeSundays : true;
    const paymentWeekday = options?.paymentWeekday;
    const firstDueDate =
      options?.firstDueDate ||
      (frequency !== "daily"
        ? computeDefaultFirstDueDate(startDate, frequency, excludeSundays, paymentWeekday)
        : undefined);

    const newLoan: Loan = {
      id: generateUUID(),
      clientId,
      amountInvested,
      totalAmount: Math.round(dailyRate * totalDays),
      dailyRate,
      totalDays,
      startDate,
      excludeSundays,
      status: "active",
      frequency,
      paymentWeekday,
      firstDueDate
    };

    saveLoanMeta(newLoan.id, { frequency, paymentWeekday, firstDueDate });

    if (supabase) {
      try {
        const fullPayload: Record<string, any> = {
          id: newLoan.id,
          client_id: newLoan.clientId,
          amount_invested: newLoan.amountInvested,
          total_amount: newLoan.totalAmount,
          daily_rate: newLoan.dailyRate,
          total_days: newLoan.totalDays,
          start_date: newLoan.startDate,
          exclude_sundays: excludeSundays,
          status: "active",
          frequency,
          payment_weekday: paymentWeekday ?? null,
          first_due_date: firstDueDate ?? null
        };

        const { error } = await supabase.from("loans").insert(fullPayload);
        if (error) {
          if (isMissingColumnError(error)) {
            const { error: baseErr } = await supabase.from("loans").insert({
              id: newLoan.id,
              client_id: newLoan.clientId,
              amount_invested: newLoan.amountInvested,
              total_amount: newLoan.totalAmount,
              daily_rate: newLoan.dailyRate,
              total_days: newLoan.totalDays,
              start_date: newLoan.startDate
            });
            if (baseErr) {
              throw new Error(`Erro ao salvar empréstimo no Supabase: ${baseErr.message}.`);
            }
          } else {
            throw new Error(`Erro ao salvar empréstimo no Supabase: ${error.message}.`);
          }
        }
        return newLoan;
      } catch (err: any) {
        console.error("Supabase loan insert error:", err);
        throw err;
      }
    }

    const loans = await this.getLoans();
    loans.push(newLoan);
    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
    return newLoan;
  },

  // EDIT LOAN
  async editActiveLoan(
    id: string, 
    amountInvested: number, 
    totalDays: number, 
    dailyRate: number, 
    startDate: string,
    options?: {
      frequency?: PaymentFrequency;
      paymentWeekday?: number;
      firstDueDate?: string;
    }
  ): Promise<Loan> {
    const totalAmount = Math.round(dailyRate * totalDays);

    if (options?.frequency !== undefined) {
      saveLoanMeta(id, {
        frequency: options.frequency,
        paymentWeekday: options.paymentWeekday,
        firstDueDate: options.firstDueDate
      });
    }

    if (supabase) {
      try {
        const updatePayload: Record<string, any> = {
          amount_invested: amountInvested,
          total_days: totalDays,
          daily_rate: dailyRate,
          total_amount: totalAmount,
          start_date: startDate
        };
        if (options?.frequency !== undefined) {
          updatePayload.frequency = options.frequency;
          updatePayload.payment_weekday = options.paymentWeekday ?? null;
          updatePayload.first_due_date = options.firstDueDate ?? null;
        }

        const { error } = await supabase.from("loans").update(updatePayload).eq("id", id);
        if (error) {
          if (isMissingColumnError(error)) {
            const { error: baseErr } = await supabase
              .from("loans")
              .update({
                amount_invested: amountInvested,
                total_days: totalDays,
                daily_rate: dailyRate,
                total_amount: totalAmount,
                start_date: startDate
              })
              .eq("id", id);
            if (baseErr) {
              throw new Error(`Erro ao atualizar contrato no Supabase: ${baseErr.message}`);
            }
          } else {
            throw new Error(`Erro ao atualizar contrato no Supabase: ${error.message}`);
          }
        }
        
        // Fetch loan to get client_id
        const currentLoans = await this.getLoans({ throwOnCloudError: true });
        const oldLoan = currentLoans.find(l => l.id === id);
        return {
          id,
          clientId: oldLoan ? oldLoan.clientId : "",
          amountInvested,
          totalDays,
          dailyRate,
          totalAmount,
          startDate,
          excludeSundays: oldLoan?.excludeSundays,
          status: oldLoan?.status,
          frequency: options?.frequency ?? oldLoan?.frequency,
          paymentWeekday: options?.frequency !== undefined ? options.paymentWeekday : oldLoan?.paymentWeekday,
          firstDueDate: options?.frequency !== undefined ? options.firstDueDate : oldLoan?.firstDueDate
        };
      } catch (err: any) {
        console.error("Supabase editActiveLoan error:", err);
        throw err;
      }
    }

    const loans = await this.getLoans();
    let updatedLoan: Loan | null = null;
    loans.forEach(l => {
      if (l.id === id) {
        l.amountInvested = amountInvested;
        l.totalDays = totalDays;
        l.dailyRate = dailyRate;
        l.totalAmount = totalAmount;
        l.startDate = startDate;
        if (options?.frequency !== undefined) {
          l.frequency = options.frequency;
          l.paymentWeekday = options.paymentWeekday;
          l.firstDueDate = options.firstDueDate;
        }
        updatedLoan = l;
      }
    });
    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
    return updatedLoan || { id, clientId: "", amountInvested, totalDays, dailyRate, totalAmount, startDate };
  },

  // DELETE INDIVIDUAL LOAN AND ITS ASSOCIATED PAYMENTS
  async deleteLoan(loanId: string): Promise<void> {
    if (supabase) {
      try {
        // Delete payments of this loan first
        const { error: pErr } = await supabase
          .from("payments")
          .delete()
          .eq("loan_id", loanId);
        
        if (pErr) {
          console.error("Erro ao deletar pagamentos do empréstimo no Supabase:", pErr);
        }

        // Delete the loan
        const { error: lErr } = await supabase
          .from("loans")
          .delete()
          .eq("id", loanId);

        if (lErr) {
          throw new Error(`Erro ao deletar empréstimo no Supabase: ${lErr.message}`);
        }
      } catch (err: any) {
        console.error("Supabase deleteLoan error:", err);
        throw err;
      }
    }

    // Always update local storage
    try {
      const loans = await this.getLoans({ throwOnCloudError: !supabase });
      const filteredLoans = loans.filter(l => l.id !== loanId);
      localStorage.setItem(LOANS_KEY, JSON.stringify(filteredLoans));

      const payments = await this.getPayments({ throwOnCloudError: !supabase });
      const filteredPayments = payments.filter(p => p.loanId !== loanId);
      localStorage.setItem(PAYMENTS_KEY, JSON.stringify(filteredPayments));
    } catch {
      // Cloud delete already succeeded
    }
  },

  // RENEW AN ACTIVE CONTRACT
  async renewLoan(
    oldLoanId: string,
    amountInvested: number,
    totalDays: number,
    dailyRate: number,
    startDate: string,
    totalAmount?: number,
    options?: {
      frequency?: PaymentFrequency;
      paymentWeekday?: number;
      firstDueDate?: string;
    }
  ): Promise<Loan> {
    const loans = await this.getLoans({ throwOnCloudError: true });
    const oldLoan = loans.find(l => l.id === oldLoanId);
    if (!oldLoan) {
      throw new Error("Contrato antigo não encontrado.");
    }

    const clientId = oldLoan.clientId;
    const finalTotalAmount = totalAmount !== undefined ? totalAmount : Math.round(dailyRate * totalDays);
    const frequency = options?.frequency ?? oldLoan.frequency ?? "daily";
    const paymentWeekday = options?.frequency !== undefined ? options.paymentWeekday : oldLoan.paymentWeekday;
    const excludeSundays = oldLoan.excludeSundays !== false;
    const firstDueDate =
      options?.firstDueDate ||
      (frequency !== "daily"
        ? computeDefaultFirstDueDate(startDate, frequency, excludeSundays, paymentWeekday)
        : undefined);

    const newLoan: Loan = {
      id: generateUUID(),
      clientId,
      amountInvested,
      totalAmount: finalTotalAmount,
      dailyRate,
      totalDays,
      startDate,
      excludeSundays,
      status: "active",
      frequency,
      paymentWeekday,
      firstDueDate
    };

    saveLoanMeta(newLoan.id, { frequency, paymentWeekday, firstDueDate });

    if (supabase) {
      try {
        // 1. Mark old loan as 'completed'
        const { error: updateError } = await supabase
          .from("loans")
          .update({ status: "completed" })
          .eq("id", oldLoanId);

        if (updateError) {
          console.warn("Could not set status='completed' in Supabase. Table schema might not have status column.", updateError);
        }

        // 2. Insert new loan
        const { error: insertError } = await supabase
          .from("loans")
          .insert({
            id: newLoan.id,
            client_id: clientId,
            amount_invested: amountInvested,
            total_amount: newLoan.totalAmount,
            daily_rate: dailyRate,
            total_days: totalDays,
            start_date: startDate,
            exclude_sundays: newLoan.excludeSundays,
            status: "active",
            frequency,
            payment_weekday: paymentWeekday ?? null,
            first_due_date: firstDueDate ?? null
          });

        if (insertError) {
          console.warn("Could not insert new loan with extended fields, retrying...", insertError);
          const { error: retryError1 } = await supabase
            .from("loans")
            .insert({
              id: newLoan.id,
              client_id: clientId,
              amount_invested: amountInvested,
              total_amount: newLoan.totalAmount,
              daily_rate: dailyRate,
              total_days: totalDays,
              start_date: startDate,
              exclude_sundays: newLoan.excludeSundays
            });
          
          if (retryError1) {
            console.warn("Could not insert with exclude_sundays either, trying basic fields only (same as addLoan)...", retryError1);
            const { error: retryError2 } = await supabase
              .from("loans")
              .insert({
                id: newLoan.id,
                client_id: clientId,
                amount_invested: amountInvested,
                total_amount: newLoan.totalAmount,
                daily_rate: dailyRate,
                total_days: totalDays,
                start_date: startDate
              });
            if (retryError2) throw retryError2;
          }
        }
      } catch (err: any) {
        console.error("Supabase renewLoan error:", err);
        throw err;
      }
    }

    // Always update local storage
    loans.forEach(l => {
      if (l.id === oldLoanId) {
        l.status = "completed";
      }
    });
    loans.push(newLoan);
    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));

    return newLoan;
  },

  // TOGGLE EXCLUDE SUNDAYS FOR A LOAN
  async toggleExcludeSundays(loanId: string): Promise<boolean> {
    const loans = await this.getLoans({ throwOnCloudError: true });
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return false;

    const newToggle = !(loan.excludeSundays !== false); // default to true, so toggles to false
    loan.excludeSundays = newToggle;

    if (supabase) {
      const { error } = await supabase.from("loans").update({
        exclude_sundays: newToggle
      }).eq("id", loanId);
      if (error) {
        throw new Error(`Erro ao atualizar regra de domingos no Supabase: ${error.message}`);
      }
    }

    try {
      localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
    } catch {
      // Ignore storage quota errors
    }
    
    // Also, we must reconstruct payments for this loan to apply the Sunday rule shifts!
    const payments = await this.getPayments({ throwOnCloudError: true });
    const loanPayments = deduplicateAndSortPayments(
      payments.filter(p => p.loanId === loanId)
    );
      
    const paidCount = loanPayments.length;
    if (paidCount > 0) {
      await this.adjustLoanPaymentsAndStartDate(loanId, paidCount, loan.startDate);
    }
    
    return newToggle;
  },

  // REGISTER PAYMENTS (DATA + 1 LOGIC)
  async registerPayment(
    loanId: string,
    dailyCount: number,
    paymentDate: string,
    customReferenceDate?: string,
    useReferenceAsPaymentDate: boolean = false
  ): Promise<Payment[]> {
    const requestedCount = Math.floor(Number(dailyCount));
    if (!Number.isFinite(requestedCount) || requestedCount <= 0) {
      throw new Error("Quantidade de diárias inválida.");
    }

    return withLoanLock(loanId, async () => {
      let loan: Loan | undefined;
      let loanPayments: Payment[] = [];
      let allLocalPayments: Payment[] = [];

      if (supabase) {
        const { data: loanRow, error: loanErr } = await supabase
          .from("loans")
          .select("*")
          .eq("id", loanId)
          .maybeSingle();

        if (loanErr) {
          throw new Error(`Erro ao carregar contrato no Supabase: ${loanErr.message}`);
        }
        if (loanRow) {
          loan = mapLoans([loanRow])[0];
        }

        const paymentRows = await fetchAllFromSupabase(
          "payments",
          { column: "reference_date", ascending: true },
          { column: "loan_id", value: loanId }
        );
        loanPayments = deduplicateAndSortPayments(mapPayments(paymentRows));
      } else {
        const loans = await this.getLoans();
        allLocalPayments = await this.getPayments();
        loan = loans.find(l => l.id === loanId);
        loanPayments = deduplicateAndSortPayments(
          allLocalPayments.filter(p => p.loanId === loanId)
        );
      }

      if (!loan) {
        throw new Error("Contrato de empréstimo não encontrado.");
      }

      const countAlreadyPaid = loanPayments.length;
      if (countAlreadyPaid >= loan.totalDays) {
        throw new Error("Este empréstimo já foi totalmente quitado.");
      }

      let startingRefDate: string;
      if (countAlreadyPaid === 0) {
        // First payment! The reference starts at the startDate.
        // So the first payment covers the day AFTER the startDate.
        startingRefDate = loan.startDate;
      } else {
        // Last reference date covered
        startingRefDate = loanPayments[loanPayments.length - 1].referenceDate;
      }

      const daysToRegister = Math.min(requestedCount, loan.totalDays - countAlreadyPaid);
      if (daysToRegister <= 0) {
        throw new Error("Este empréstimo já foi totalmente quitado.");
      }

      const newPayments: Payment[] = [];
      const isExcluding = loan.excludeSundays !== false;
      const freq = getLoanFrequency(loan);
      const scheduledDates = getLoanScheduledDates(loan);

      if (customReferenceDate) {
        let currentRef = customReferenceDate;
        if (freq === "daily" && isExcluding && isSunday(currentRef)) {
          currentRef = addDays(currentRef, 1);
        }
        for (let i = 0; i < daysToRegister; i++) {
          if (i > 0) {
            currentRef = stepReferenceDate(currentRef, 1, loan);
          }
          newPayments.push({
            id: generateUUID(),
            loanId,
            paymentDate: useReferenceAsPaymentDate ? currentRef : paymentDate,
            referenceDate: currentRef,
            amount: loan.dailyRate
          });
        }
      } else {
        let currentRef = countAlreadyPaid > 0
          ? loanPayments[loanPayments.length - 1].referenceDate
          : loan.startDate;

        for (let i = 0; i < daysToRegister; i++) {
          const scheduleCandidate = scheduledDates[countAlreadyPaid + i];
          if (scheduleCandidate && (countAlreadyPaid === 0 || scheduleCandidate > currentRef)) {
            currentRef = scheduleCandidate;
          } else {
            currentRef = stepReferenceDate(currentRef, 1, loan);
          }
          newPayments.push({
            id: generateUUID(),
            loanId,
            paymentDate: useReferenceAsPaymentDate ? currentRef : paymentDate,
            referenceDate: currentRef,
            amount: loan.dailyRate
          });
        }
      }

      if (supabase) {
        try {
          const formattedPayments = newPayments.map(p => ({
            id: p.id,
            loan_id: p.loanId,
            payment_date: p.paymentDate,
            reference_date: p.referenceDate,
            amount: p.amount
          }));

          const { data: insertedRows, error } = await supabase
            .from("payments")
            .insert(formattedPayments)
            .select();

          if (error) {
            throw new Error(`Erro ao registrar pagamentos no Supabase: ${error.message}`);
          }

          const persistedPayments =
            insertedRows && insertedRows.length > 0
              ? deduplicateAndSortPayments(mapPayments(insertedRows))
              : newPayments;

          mergePaymentsIntoLocalCache(persistedPayments);
          return persistedPayments;
        } catch (err: any) {
          console.error("Supabase payment registration error:", err);
          throw err;
        }
      }

      // Fallback local storage
      const updatedPayments = deduplicateAndSortPayments([...allLocalPayments, ...newPayments]);
      localStorage.setItem(PAYMENTS_KEY, JSON.stringify(updatedPayments));
      return newPayments;
    });
  },

  // DELETE CLIENT (ARCHIVE/SOFT DELETE CLIENT BUT KEEP HISTORICAL DATA IN DATABASE FOR SUGGESTIONS)
  async deleteClient(clientId: string): Promise<void> {
    // 1. Add to local storage archived list for safe fallback
    const archivedIdsStr = localStorage.getItem(ARCHIVED_CLIENTS_KEY);
    const archivedIds: string[] = archivedIdsStr ? JSON.parse(archivedIdsStr) : [];
    if (!archivedIds.includes(clientId)) {
      archivedIds.push(clientId);
      localStorage.setItem(ARCHIVED_CLIENTS_KEY, JSON.stringify(archivedIds));
    }

    // 2. Try to update status in Supabase (archived = true)
    if (supabase) {
      try {
        const { error } = await supabase
          .from("clients")
          .update({ archived: true })
          .eq("id", clientId);
        
        if (error) {
          console.warn("Could not set archived=true in Supabase. Table schema might not have archived column.", error);
        }
      } catch (err: any) {
        console.warn("Erro ao sincronizar deleção (arquivamento) no Supabase:", err);
      }
    }

    // 3. Keep local storage clients list updated with archived: true
    const clients = await this.getClients();
    clients.forEach(c => {
      if (c.id === clientId) {
        c.archived = true;
      }
    });
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  },

  // ADJUST LOAN PAYMENTS AND START DATE (FLEXIBLE ADJUSTMENT PRESERVING PAYMENT HISTORY)
  async adjustLoanPaymentsAndStartDate(
    loanId: string, 
    targetPaidCount: number, 
    targetStartDate: string
  ): Promise<void> {
    return withLoanLock(loanId, async () => {
      const loans = await this.getLoans({ throwOnCloudError: true });
      const loan = loans.find(l => l.id === loanId);
      if (!loan) {
        throw new Error("Contrato não encontrado para reajuste.");
      }

      const validatedPaidCount = Math.min(loan.totalDays, Math.max(0, targetPaidCount));
      const allPayments = await this.getPayments({ throwOnCloudError: true });
      const existingLoanPayments = deduplicateAndSortPayments(
        allPayments.filter(p => p.loanId === loanId)
      );

      const isExcluding = loan.excludeSundays !== false;
      const todayStr = getTodayStr();
      const startDateChanged = targetStartDate !== loan.startDate;
      const freq = getLoanFrequency(loan);
      const effectiveFirstDueDate =
        freq !== "daily"
          ? (startDateChanged
              ? computeDefaultFirstDueDate(targetStartDate, freq, isExcluding, loan.paymentWeekday)
              : loan.firstDueDate)
          : undefined;

      const scheduledDates = getLoanScheduledDates(
        {
          ...loan,
          startDate: targetStartDate,
          firstDueDate: effectiveFirstDueDate
        },
        validatedPaidCount
      );

      // Build the target payment list preserving existing paymentDate & id where possible
      const targetPayments: Payment[] = [];
      for (let i = 0; i < validatedPaidCount; i++) {
        const currentRef = scheduledDates[i] || stepReferenceDate(targetStartDate, i + 1, loan);
        const existing = existingLoanPayments[i];
        targetPayments.push({
          id: existing ? existing.id : generateUUID(),
          loanId,
          paymentDate: existing ? existing.paymentDate : (currentRef <= todayStr ? currentRef : todayStr),
          referenceDate: currentRef,
          amount: loan.dailyRate
        });
      }

      if (startDateChanged && freq !== "daily") {
        saveLoanMeta(loanId, {
          frequency: freq,
          paymentWeekday: loan.paymentWeekday,
          firstDueDate: effectiveFirstDueDate
        });
      }

      const overlapCount = Math.min(validatedPaidCount, existingLoanPayments.length);
      const refsChanged = existingLoanPayments
        .slice(0, overlapCount)
        .some((p, idx) => p.referenceDate !== targetPayments[idx]?.referenceDate);

      // Supabase synchronization
      if (supabase) {
        try {
          if (startDateChanged) {
            const { error: loanErr } = await supabase
              .from("loans")
              .update({ start_date: targetStartDate })
              .eq("id", loanId);
            if (loanErr) throw loanErr;
          }

          if (!startDateChanged && !refsChanged && validatedPaidCount === existingLoanPayments.length) {
            // Only update amounts if dailyRate changed
            const needsRateUpdate = existingLoanPayments.some(p => p.amount !== loan.dailyRate);
            if (needsRateUpdate && existingLoanPayments.length > 0) {
              const { error: amtErr } = await supabase
                .from("payments")
                .update({ amount: loan.dailyRate })
                .eq("loan_id", loanId);
              if (amtErr) throw amtErr;
            }
          } else if (!startDateChanged && !refsChanged && validatedPaidCount > existingLoanPayments.length) {
            // Incremental insert only for newly added installments
            const toInsert = targetPayments.slice(existingLoanPayments.length).map(p => ({
              id: p.id,
              loan_id: p.loanId,
              payment_date: p.paymentDate,
              reference_date: p.referenceDate,
              amount: p.amount
            }));
            if (toInsert.length > 0) {
              const { error: insErr } = await supabase.from("payments").insert(toInsert);
              if (insErr) throw insErr;
            }
          } else if (!startDateChanged && !refsChanged && validatedPaidCount < existingLoanPayments.length) {
            // Incremental delete only for excess installments
            const idsToDelete = existingLoanPayments.slice(validatedPaidCount).map(p => p.id);
            if (idsToDelete.length > 0) {
              const { error: delErr } = await supabase.from("payments").delete().in("id", idsToDelete);
              if (delErr) throw delErr;
            }
          } else {
            // Start date or reference schedule changed: reconstruct while preserving original payment_dates
            const { error: delErr } = await supabase
              .from("payments")
              .delete()
              .eq("loan_id", loanId);
            if (delErr) throw delErr;

            if (targetPayments.length > 0) {
              const formatted = targetPayments.map(p => ({
                id: p.id,
                loan_id: p.loanId,
                payment_date: p.paymentDate,
                reference_date: p.referenceDate,
                amount: p.amount
              }));
              const { error: insErr } = await supabase.from("payments").insert(formatted);
              if (insErr) throw insErr;
            }
          }
        } catch (err: any) {
          console.error("Error updating in Supabase during contract adjustment:", err);
          throw new Error(`Erro ao reajustar contrato no Supabase: ${err.message || err}`);
        }
      }

      // Local Storage synchronization
      try {
        const updatedLoans = loans.map(l =>
          l.id === loanId ? { ...l, startDate: targetStartDate } : l
        );
        localStorage.setItem(LOANS_KEY, JSON.stringify(updatedLoans));

        const otherPayments = allPayments.filter(p => p.loanId !== loanId);
        localStorage.setItem(PAYMENTS_KEY, JSON.stringify(deduplicateAndSortPayments([...otherPayments, ...targetPayments])));
      } catch {
        // Ignore storage quota errors
      }
    });
  },

  // CLEAR ALL DATA
  async clearAllData(): Promise<void> {
    if (supabase) {
      try {
        await supabase.from("payments").delete().neq("id", "");
        await supabase.from("loans").delete().neq("id", "");
        await supabase.from("clients").delete().neq("id", "");
        return;
      } catch (err) {
        console.warn("Supabase clear error:", err);
      }
    }

    localStorage.setItem(CLIENTS_KEY, JSON.stringify([]));
    localStorage.setItem(LOANS_KEY, JSON.stringify([]));
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify([]));
  },

  // RESTORE DEMO DATA SCRIPT
  async resetToMockSync(): Promise<void> {
    await this.clearAllData();
    
    if (supabase) {
      try {
        // Build seed lists
        const seedClin = [
          { id: "c1", name: "Carlos Henrique Silva", phone: "11988887777" },
          { id: "c2", name: "Ana Beatriz Souza", phone: "11977776666" },
          { id: "c3", name: "Marcos Antonio Barbosa", phone: "11966665555" },
          { id: "c4", name: "Julia Ferreira Costa", phone: "11955554444" },
          { id: "c5", name: "Ricardo Santos Oliveira", phone: "11944443333" }
        ];

        const seedLns = [
          { id: "l1", client_id: "c1", amount_invested: 1000, total_amount: 1300, daily_rate: 50, total_days: 26, start_date: "2026-05-25" },
          { id: "l2", client_id: "c2", amount_invested: 500, total_amount: 650, daily_rate: 25, total_days: 26, start_date: "2026-06-10" },
          { id: "l3", client_id: "c3", amount_invested: 2000, total_amount: 2600, daily_rate: 100, total_days: 26, start_date: "2026-05-18" },
          { id: "l4", client_id: "c4", amount_invested: 1500, total_amount: 1950, daily_rate: 75, total_days: 26, start_date: "2026-06-15" }
        ];

        const seedPay: any[] = [];
        
        // payments l1
        for (let i = 0; i < 17; i++) {
          seedPay.push({
            id: `p1_${i}`,
            loan_id: "l1",
            payment_date: addDays("2026-05-25", i),
            reference_date: addDays("2026-05-25", i),
            amount: 50
          });
        }
        // payments l2
        for (let i = 0; i < 9; i++) {
          seedPay.push({
            id: `p2_${i}`,
            loan_id: "l2",
            payment_date: addDays("2026-06-10", i),
            reference_date: addDays("2026-06-10", i),
            amount: 25
          });
        }
        // payments l3
        for (let i = 0; i < 12; i++) {
          seedPay.push({
            id: `p3_${i}`,
            loan_id: "l3",
            payment_date: addDays("2026-05-18", i),
            reference_date: addDays("2026-05-18", i),
            amount: 100
          });
        }
        // payments l4
        for (let i = 0; i < 4; i++) {
          seedPay.push({
            id: `p4_${i}`,
            loan_id: "l4",
            payment_date: addDays("2026-06-15", i),
            reference_date: addDays("2026-06-15", i),
            amount: 75
          });
        }

        // Write sequentially
        const { error: cErr } = await supabase.from("clients").insert(seedClin);
        if (cErr) throw cErr;
        const { error: lErr } = await supabase.from("loans").insert(seedLns);
        if (lErr) throw lErr;
        const { error: pErr } = await supabase.from("payments").insert(seedPay);
        if (pErr) throw pErr;
        return;
      } catch (err) {
        console.warn("Couldn't seed mock directly in Supabase. Seeding local...", err);
      }
    }

    seedLocalMockData();
  },

  // ATOMIC DASHBOARD SNAPSHOT (SINGLE FETCH FOR CLIENTS, LOANS & PAYMENTS)
  async getDashboardSnapshot(simulationDate: string = getTodayStr()): Promise<{
    clientsWithLoans: ClientWithLoanDetails[];
    stats: FinancialStats;
    loans: Loan[];
    payments: Payment[];
  }> {
    const [clients, loans, payments] = await Promise.all([
      this.getClients({ throwOnCloudError: true }),
      this.getLoans({ throwOnCloudError: true }),
      this.getPayments({ throwOnCloudError: true })
    ]);

    const clientsWithLoans = computeClientDetailsList(
      clients,
      loans,
      payments,
      simulationDate,
      (clientId, dateStr) => this.getChargeCount(clientId, dateStr)
    );
    const stats = computeFinancialStats(clients, loans, payments, simulationDate);

    return {
      clientsWithLoans,
      stats,
      loans,
      payments
    };
  },

  // EXTRACT DENSE RECONCILIATION DATA FOR MAIN DISPLAY
  async getClientDetailsList(simulationDate: string = getTodayStr()): Promise<ClientWithLoanDetails[]> {
    const [clients, loans, payments] = await Promise.all([
      this.getClients(),
      this.getLoans(),
      this.getPayments()
    ]);

    return computeClientDetailsList(
      clients,
      loans,
      payments,
      simulationDate,
      (clientId, dateStr) => this.getChargeCount(clientId, dateStr)
    );
  },

  // CALCULATE FINANCIAL SCORES (MONTH SPLICED AT DAY 02)
  async getFinancialStats(simulationDate: string = getTodayStr()): Promise<FinancialStats> {
    const [clients, loans, payments] = await Promise.all([
      this.getClients(),
      this.getLoans(),
      this.getPayments()
    ]);

    return computeFinancialStats(clients, loans, payments, simulationDate);
  },

  // Charges tracking helpers
  getChargeCount(clientId: string, dateStr: string): number {
    const key = `gestao_emprestimos_charges_${clientId}_${dateStr}`;
    const stored = localStorage.getItem(key);
    return stored ? Number(stored) : 0;
  },

  async incrementChargeCount(clientId: string, dateStr: string): Promise<number> {
    const key = `gestao_emprestimos_charges_${clientId}_${dateStr}`;
    const current = this.getChargeCount(clientId, dateStr);
    const newVal = current + 1;
    localStorage.setItem(key, String(newVal));
    return newVal;
  }
};
