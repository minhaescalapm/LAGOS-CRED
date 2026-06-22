import { Client, Loan, Payment, ClientWithLoanDetails, FinancialStats } from "../types";
import { 
  addDays, 
  differenceInDays, 
  getTodayStr, 
  getFinancialCycle, 
  isInSameFinancialCycle, 
  getLastNFinancialCycles,
  isSunday,
  isSaturday,
  getElapsedDaysExcludingSundays
} from "../utils/dateUtils";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

// Keys for LocalStorage fallback
const CLIENTS_KEY = "gestao_emprestimos_clients";
const LOANS_KEY = "gestao_emprestimos_loans";
const PAYMENTS_KEY = "gestao_emprestimos_payments";

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
    phone: String(c.phone || "")
  }));
}

function mapLoans(supabaseLoans: any[]): Loan[] {
  return supabaseLoans.map(l => ({
    id: String(l.id),
    clientId: String(l.client_id || l.clientId || ""),
    amountInvested: Number(l.amount_invested ?? l.amountInvested ?? 0),
    totalAmount: Number(l.total_amount ?? l.totalAmount ?? 0),
    dailyRate: Number(l.daily_rate ?? l.dailyRate ?? 0),
    totalDays: Number(l.total_days ?? l.totalDays ?? 0),
    startDate: String(l.start_date || l.startDate || ""),
    excludeSundays: l.exclude_sundays !== undefined ? Boolean(l.exclude_sundays) : (l.excludeSundays !== undefined ? Boolean(l.excludeSundays) : true)
  }));
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

export const dbService = {
  // SUPABASE CONFIGURATION FLAG LISTENER
  isUsingSupabase(): boolean {
    return isSupabaseConfigured();
  },

  // GET ALL REQUIRING RECORDS
  async getClients(): Promise<Client[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from("clients").select("*").order("name");
        if (error) throw error;
        if (data) return mapClients(data);
      } catch (err) {
        console.warn("Supabase Error, falling back to localStorage:", err);
      }
    }
    const data = localStorage.getItem(CLIENTS_KEY);
    const list: Client[] = data ? JSON.parse(data) : [];
    return list.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getLoans(): Promise<Loan[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from("loans").select("*");
        if (error) throw error;
        if (data) return mapLoans(data);
      } catch (err) {
        console.warn("Supabase Error, falling back to localStorage:", err);
      }
    }
    const data = localStorage.getItem(LOANS_KEY);
    return data ? JSON.parse(data) : [];
  },

  async getPayments(): Promise<Payment[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from("payments").select("*");
        if (error) throw error;
        if (data) return mapPayments(data);
      } catch (err) {
        console.warn("Supabase Error, falling back to localStorage:", err);
      }
    }
    const data = localStorage.getItem(PAYMENTS_KEY);
    return data ? JSON.parse(data) : [];
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

  // ADD NEW LOAN
  async addLoan(
    clientId: string, 
    amountInvested: number, 
    totalDays: number, 
    dailyRate: number, 
    startDate: string
  ): Promise<Loan> {
    const newLoan: Loan = {
      id: generateUUID(),
      clientId,
      amountInvested,
      totalAmount: Math.round(dailyRate * totalDays),
      dailyRate,
      totalDays,
      startDate
    };

    if (supabase) {
      try {
        const { error } = await supabase.from("loans").insert({
          id: newLoan.id,
          client_id: newLoan.clientId,
          amount_invested: newLoan.amountInvested,
          total_amount: newLoan.totalAmount,
          daily_rate: newLoan.dailyRate,
          total_days: newLoan.totalDays,
          start_date: newLoan.startDate
        });
        if (error) {
          throw new Error(`Erro ao salvar empréstimo no Supabase: ${error.message}.`);
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
    startDate: string
  ): Promise<Loan> {
    const totalAmount = Math.round(dailyRate * totalDays);

    if (supabase) {
      try {
        const { error } = await supabase.from("loans").update({
          amount_invested: amountInvested,
          total_days: totalDays,
          daily_rate: dailyRate,
          total_amount: totalAmount,
          start_date: startDate
        }).eq("id", id);
        if (error) {
          throw new Error(`Erro ao atualizar contrato no Supabase: ${error.message}`);
        }
        
        // Fetch loan to get client_id
        const currentLoans = await this.getLoans();
        const oldLoan = currentLoans.find(l => l.id === id);
        return {
          id,
          clientId: oldLoan ? oldLoan.clientId : "",
          amountInvested,
          totalDays,
          dailyRate,
          totalAmount,
          startDate
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
        updatedLoan = l;
      }
    });
    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
    return updatedLoan || { id, clientId: "", amountInvested, totalDays, dailyRate, totalAmount, startDate };
  },

  // TOGGLE EXCLUDE SUNDAYS FOR A LOAN
  async toggleExcludeSundays(loanId: string): Promise<boolean> {
    const loans = await this.getLoans();
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return false;

    const newToggle = !(loan.excludeSundays !== false); // default to true, so toggles to false
    loan.excludeSundays = newToggle;

    if (supabase) {
      try {
        await supabase.from("loans").update({
          exclude_sundays: newToggle
        }).eq("id", loanId);
      } catch (err) {
        console.warn("Supabase toggle Sunday error:", err);
      }
    }

    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
    
    // Also, we must reconstruct payments for this loan to apply the Sunday rule shifts!
    const payments = await this.getPayments();
    const loanPayments = payments
      .filter(p => p.loanId === loanId)
      .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
      
    const paidCount = loanPayments.length;
    if (paidCount > 0) {
      await this.adjustLoan(loanId, paidCount, loan.startDate);
    }
    
    return newToggle;
  },

  // REGISTER PAYMENTS (DATA + 1 LOGIC)
  async registerPayment(loanId: string, dailyCount: number, paymentDate: string): Promise<Payment[]> {
    const loans = await this.getLoans();
    const payments = await this.getPayments();
    const loan = loans.find(l => l.id === loanId);
    
    if (!loan) {
      throw new Error("Contrato de empréstimo não encontrado.");
    }

    // Get all current payments for this loan to sort and find the last covered date
    const loanPayments = payments
      .filter(p => p.loanId === loanId)
      .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
    
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

    // Allocate the actual count to register (cannot exceed remaining days)
    // If client pays on Saturday, add an extra day of credit
    let extraCount = 0;
    if (isSaturday(paymentDate)) {
      extraCount = 1;
    }

    const daysToRegister = Math.min(dailyCount + extraCount, loan.totalDays - countAlreadyPaid);
    const newPayments: Payment[] = [];

    let currentRef = startingRefDate;
    const isExcluding = loan.excludeSundays !== false;
    for (let i = 0; i < daysToRegister; i++) {
      currentRef = addDays(currentRef, 1);
      // Skip Sundays! If currentRef is Sunday and excludeSundays is true, shift it to Monday
      if (isExcluding && isSunday(currentRef)) {
        currentRef = addDays(currentRef, 1);
      }
      const newPayment: Payment = {
        id: generateUUID(),
        loanId,
        paymentDate, // The day the money was actually received
        referenceDate: currentRef, // The target reference date being cleared
        amount: loan.dailyRate
      };
      newPayments.push(newPayment);
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
        
        const { error } = await supabase.from("payments").insert(formattedPayments);
        if (error) {
          throw new Error(`Erro ao registrar pagamentos no Supabase: ${error.message}`);
        }
        return newPayments;
      } catch (err: any) {
        console.error("Supabase payment registration error:", err);
        throw err;
      }
    }

    // Fallback local storage
    const updatedPayments = [...payments, ...newPayments];
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(updatedPayments));
    return newPayments;
  },

  // DELETE CLIENT AND THEIR DATA
  async deleteClient(clientId: string): Promise<void> {
    if (supabase) {
      try {
        // Query loans to delete their payments first
        const { data: userLoans, error: lErr } = await supabase
          .from("loans")
          .select("id")
          .eq("client_id", clientId);
        
        if (lErr) {
          console.error("Erro ao buscar empréstimos no Supabase:", lErr);
          throw new Error(lErr.message);
        }
        
        if (userLoans && userLoans.length > 0) {
          const loanIds = userLoans.map(l => l.id);
          
          const { error: pErr } = await supabase
            .from("payments")
            .delete()
            .in("loan_id", loanIds);
            
          if (pErr) {
            console.error("Erro ao deletar pagamentos no Supabase:", pErr);
            throw new Error(pErr.message);
          }

          const { error: loanDelErr } = await supabase
            .from("loans")
            .delete()
            .in("id", loanIds);

          if (loanDelErr) {
            console.error("Erro ao deletar empréstimos no Supabase:", loanDelErr);
            throw new Error(loanDelErr.message);
          }
        }
        
        const { error: cliErr } = await supabase
          .from("clients")
          .delete()
          .eq("id", clientId);
          
        if (cliErr) {
          console.error("Erro ao deletar cliente no Supabase:", cliErr);
          throw new Error(cliErr.message);
        }
      } catch (err: any) {
        console.warn("Erro ao sincronizar deleção no Supabase, limpando localmente:", err);
        throw err;
      }
    }

    // Fallback/Sync local
    let clients = await this.getClients();
    let loans = await this.getLoans();
    let payments = await this.getPayments();

    const clientLoans = loans.filter(l => l.clientId === clientId);
    const loanIds = clientLoans.map(l => l.id);

    clients = clients.filter(c => c.id !== clientId);
    loans = loans.filter(l => l.clientId !== clientId);
    payments = payments.filter(p => !loanIds.includes(p.loanId));

    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
  },

  // ADJUST LOAN PAYMENTS AND START DATE (FLEXIBLE ADJUSTMENT)
  async adjustLoanPaymentsAndStartDate(
    loanId: string, 
    targetPaidCount: number, 
    targetStartDate: string
  ): Promise<void> {
    const loans = await this.getLoans();
    const loan = loans.find(l => l.id === loanId);
    if (!loan) {
      throw new Error("Contrato não encontrado para reajuste.");
    }

    const validatedPaidCount = Math.min(loan.totalDays, Math.max(0, targetPaidCount));

    // Supabase synchronization
    if (supabase) {
      try {
        const { error: loanErr } = await supabase
          .from("loans")
          .update({
            start_date: targetStartDate
          })
          .eq("id", loanId);
          
        if (loanErr) throw loanErr;

        // Delete previous payments for this loan
        const { error: delErr } = await supabase
          .from("payments")
          .delete()
          .eq("loan_id", loanId);

        if (delErr) throw delErr;

        // Insert new reconstructed payments
        if (validatedPaidCount > 0) {
          const newPayments = [];
          let currentRef = targetStartDate;
          const isExcluding = loan.excludeSundays !== false;
          for (let i = 0; i < validatedPaidCount; i++) {
            currentRef = addDays(currentRef, 1);
            if (isExcluding && isSunday(currentRef)) {
              currentRef = addDays(currentRef, 1);
            }
            newPayments.push({
              id: generateUUID(),
              loan_id: loanId,
              payment_date: getTodayStr(),
              reference_date: currentRef,
              amount: loan.dailyRate
            });
          }
          const { error: insErr } = await supabase
            .from("payments")
            .insert(newPayments);

          if (insErr) throw insErr;
        }
      } catch (err: any) {
        console.warn("Error updating in Supabase, continuing locally:", err);
      }
    }

    // Local Storage synchronization
    // 1. Update loan start date
    loans.forEach(l => {
      if (l.id === loanId) {
        l.startDate = targetStartDate;
      }
    });
    localStorage.setItem(LOANS_KEY, JSON.stringify(loans));

    // 2. Reconstruct payments
    let payments = await this.getPayments();
    payments = payments.filter(p => p.loanId !== loanId);

    if (validatedPaidCount > 0) {
      let currentRef = targetStartDate;
      const isExcluding = loan.excludeSundays !== false;
      for (let i = 0; i < validatedPaidCount; i++) {
        currentRef = addDays(currentRef, 1);
        if (isExcluding && isSunday(currentRef)) {
          currentRef = addDays(currentRef, 1);
        }
        payments.push({
          id: generateUUID(),
          loanId,
          paymentDate: getTodayStr(),
          referenceDate: currentRef,
          amount: loan.dailyRate
        });
      }
    }
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
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

  // EXTRACT DENSE RECONCILIATION DATA FOR MAIN DISPLAY
  async getClientDetailsList(simulationDate: string = getTodayStr()): Promise<ClientWithLoanDetails[]> {
    const clients = await this.getClients();
    const loans = await this.getLoans();
    const payments = await this.getPayments();

    return clients.flatMap(client => {
      // Find all loans for this client, sorted newest first
      const clientLoans = loans
        .filter(l => l.clientId === client.id)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));

      if (clientLoans.length === 0) {
        return [{
          client,
          activeLoan: null,
          payments: [],
          paidCount: 0,
          totalDays: 0,
          referenceDate: "",
          isDelayed: false,
          daysBehind: 0
        }];
      }

      return clientLoans.map(loan => {
        // Payments for this loan
        const loanPayments = payments
          .filter(p => p.loanId === loan.id)
          .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
        
        const paidCount = loanPayments.length;
        const totalDays = loan.totalDays;
        
        // Find reference coverage date
        let referenceDate = "";
        if (paidCount > 0) {
          referenceDate = loanPayments[paidCount - 1].referenceDate;
        } else {
          referenceDate = loan.startDate;
        }

        // Calculate atrasos (Delay) - Sundays are skipped if excludeSundays is true
        const isExcluding = loan.excludeSundays !== false;
        const elapsedDays = getElapsedDaysExcludingSundays(addDays(loan.startDate, 1), simulationDate, isExcluding); 
        const expectedDaysToPay = Math.max(0, Math.min(elapsedDays, totalDays));
        const daysBehind = Math.max(0, expectedDaysToPay - paidCount);
        const isDelayed = daysBehind >= 1;

        return {
          client,
          activeLoan: loan,
          payments: loanPayments,
          paidCount,
          totalDays,
          referenceDate,
          isDelayed: isDelayed && (paidCount < totalDays),
          daysBehind: paidCount >= totalDays ? 0 : daysBehind
        };
      });
    });
  },

  // CALCULATE FINANCIAL SCORES (MONTH SPLICED AT DAY 02)
  async getFinancialStats(simulationDate: string = getTodayStr()): Promise<FinancialStats> {
    const loans = await this.getLoans();
    const payments = await this.getPayments();
    
    // 1. Dinheiro Investido (Soma total do valor principal emprestado de contratos ativos)
    const activeLoans = loans.filter(loan => {
      const loanPaymentsCount = payments.filter(p => p.loanId === loan.id).length;
      return loanPaymentsCount < loan.totalDays;
    });
    
    const moneyInvested = activeLoans.reduce((sum, l) => sum + l.amountInvested, 0);

    // 2. Lucro: Diferença entre o total a receber (com juros) e o investido nos contratos ativos
    const totalProfit = activeLoans.reduce((sum, l) => sum + (l.totalAmount - l.amountInvested), 0);

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
      const remainingPayments = loan.totalDays - loanPayments.length;
      return sum + (remainingPayments * loan.dailyRate);
    }, 0);

    return {
      moneyInvested,
      receivedThisMonth,
      receivedThisWeek,
      totalProfit,
      pastReceived,
      futureProjections
    };
  }
};
