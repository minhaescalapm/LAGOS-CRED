import React, { useState, useEffect, useMemo } from "react";
import { Plus, User, Phone, DollarSign, Calendar, X, Percent, CheckCircle, Pencil, Copy, Send, Repeat } from "lucide-react";
import { ClientWithLoanDetails, Client, PaymentFrequency } from "../types";
import { getTodayStr, addDays, formatFriendlyDate, formatDayMonth, getElapsedDaysExcludingSundays } from "../utils/dateUtils";
import {
  FREQUENCY_LABELS,
  FREQUENCY_UNIT_PLURAL,
  WEEKDAY_NAMES_FULL,
  WEEKDAY_NAMES_SHORT,
  computeDefaultFirstDueDate,
  getLoanFrequency,
  getLoanScheduledDates,
  getRetroactiveStartDateForFrequency
} from "../utils/loanSchedule";
import { dbService } from "../services/dbService";

interface ClientFormProps {
  onClose?: () => void;
  onSubmit: (clientData: {
    name: string;
    phone: string;
    amountInvested: number;
    totalDays: number;
    dailyRate: number;
    startDate: string;
    clientId?: string;
    alreadyPaidCount?: number;
    frequency?: PaymentFrequency;
    paymentWeekday?: number;
    firstDueDate?: string;
  }) => void;
  clientToEdit?: ClientWithLoanDetails | null;
  isEmbeddedInTab?: boolean;
  initialStartDate?: string;
  isCopyMode?: boolean;
  simulationDate?: string;
}

export function ClientForm({ onClose, onSubmit, clientToEdit, isEmbeddedInTab, initialStartDate, isCopyMode, simulationDate }: ClientFormProps) {
  const baseToday = simulationDate || getTodayStr();
  const [name, setName] = useState(clientToEdit ? clientToEdit.client.name : "");
  
  // Format initial phone value if editing
  const getInitialPhone = () => {
    if (!clientToEdit) return "";
    const clean = clientToEdit.client.phone.replace(/\D/g, "");
    if (clean.length > 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    } else if (clean.length > 6) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    } else if (clean.length > 2) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
    } else if (clean.length > 0) {
      return `(${clean}`;
    }
    return clean;
  };

  const [phone, setPhone] = useState(getInitialPhone);
  const [amountInvested, setAmountInvested] = useState<number | "">(
    clientToEdit && clientToEdit.activeLoan ? clientToEdit.activeLoan.amountInvested : ""
  );
  const [totalDays, setTotalDays] = useState<number | "">(
    clientToEdit && clientToEdit.activeLoan ? clientToEdit.activeLoan.totalDays : 26
  ); 
  const [dailyRate, setDailyRate] = useState<number | "">(
    clientToEdit && clientToEdit.activeLoan ? clientToEdit.activeLoan.dailyRate : ""
  );
  const [startDate, setStartDate] = useState(() => {
    if (isCopyMode) {
      return baseToday;
    }
    if (clientToEdit && clientToEdit.activeLoan) {
      return clientToEdit.activeLoan.startDate;
    }
    if (initialStartDate) {
      return initialStartDate;
    }
    return baseToday;
  });

  const [frequency, setFrequency] = useState<PaymentFrequency>(() => {
    if (clientToEdit && clientToEdit.activeLoan) {
      return getLoanFrequency(clientToEdit.activeLoan);
    }
    return "daily";
  });
  const [paymentWeekday, setPaymentWeekday] = useState<number>(() => {
    if (clientToEdit && clientToEdit.activeLoan && clientToEdit.activeLoan.paymentWeekday !== undefined) {
      return clientToEdit.activeLoan.paymentWeekday;
    }
    return 5; // Sexta-feira padrão para semanal
  });
  const [useFixedWeekdayForBiweekly, setUseFixedWeekdayForBiweekly] = useState<boolean>(() => {
    return Boolean(
      clientToEdit?.activeLoan?.frequency === "biweekly" &&
      clientToEdit?.activeLoan?.paymentWeekday !== undefined
    );
  });
  const [firstDueDate, setFirstDueDate] = useState<string>(() => {
    if (!isCopyMode && clientToEdit && clientToEdit.activeLoan && clientToEdit.activeLoan.firstDueDate) {
      return clientToEdit.activeLoan.firstDueDate;
    }
    const initFreq = clientToEdit?.activeLoan ? getLoanFrequency(clientToEdit.activeLoan) : "daily";
    const initStart = isCopyMode
      ? baseToday
      : (clientToEdit?.activeLoan?.startDate || initialStartDate || baseToday);
    const initWd = clientToEdit?.activeLoan?.paymentWeekday ?? 5;
    return computeDefaultFirstDueDate(initStart, initFreq, true, initFreq === "weekly" ? initWd : undefined);
  });
  const [isFirstDueManuallyEdited, setIsFirstDueManuallyEdited] = useState<boolean>(() => {
    return Boolean(!isCopyMode && clientToEdit?.activeLoan?.firstDueDate);
  });

  const [alreadyPaidCount, setAlreadyPaidCount] = useState<number>(() => {
    if (clientToEdit && !isCopyMode) {
      return clientToEdit.paidCount;
    }
    return 0;
  });
  const [simClosingDate, setSimClosingDate] = useState(() => baseToday);
  const [simExcludeSundays, setSimExcludeSundays] = useState(() => {
    if (clientToEdit?.activeLoan) {
      return clientToEdit.activeLoan.excludeSundays !== false;
    }
    return true;
  });

  // Synchronize when simulationDate changes
  useEffect(() => {
    setSimClosingDate(simulationDate || getTodayStr());
  }, [simulationDate]);

  // Keep default firstDueDate synced when startDate, frequency or weekday changes (unless manually edited)
  useEffect(() => {
    if (!isFirstDueManuallyEdited) {
      const effectiveWd =
        frequency === "weekly" || (frequency === "biweekly" && useFixedWeekdayForBiweekly)
          ? paymentWeekday
          : undefined;
      setFirstDueDate(computeDefaultFirstDueDate(startDate, frequency, simExcludeSundays, effectiveWd));
    }
  }, [startDate, frequency, paymentWeekday, useFixedWeekdayForBiweekly, simExcludeSundays, isFirstDueManuallyEdited]);

  const recalculateRetroStartDate = (
    count: number,
    closingDate: string,
    exclude: boolean,
    freq: PaymentFrequency = frequency,
    wd?: number
  ) => {
    const validCount = Math.max(0, count);
    if (validCount > 0) {
      const calculated = getRetroactiveStartDateForFrequency(closingDate, validCount, freq, exclude, wd);
      setStartDate(calculated);
    } else {
      setStartDate(closingDate);
    }
  };

  const handleAlreadyPaidCountChange = (count: number) => {
    const validCount = Math.max(0, count);
    setAlreadyPaidCount(validCount);
    const effectiveWd =
      frequency === "weekly" || (frequency === "biweekly" && useFixedWeekdayForBiweekly)
        ? paymentWeekday
        : undefined;
    setIsFirstDueManuallyEdited(false);
    recalculateRetroStartDate(validCount, simClosingDate, simExcludeSundays, frequency, effectiveWd);
  };

  const handleSimClosingDateChange = (dateVal: string) => {
    setSimClosingDate(dateVal);
    const effectiveWd =
      frequency === "weekly" || (frequency === "biweekly" && useFixedWeekdayForBiweekly)
        ? paymentWeekday
        : undefined;
    setIsFirstDueManuallyEdited(false);
    recalculateRetroStartDate(alreadyPaidCount, dateVal, simExcludeSundays, frequency, effectiveWd);
  };

  const handleStartDateChangeDirect = (newStart: string) => {
    setStartDate(newStart);
    setIsFirstDueManuallyEdited(false);
    if (!clientToEdit || isCopyMode) {
      if (frequency === "daily") {
        const elapsed = getElapsedDaysExcludingSundays(addDays(newStart, 1), simClosingDate, simExcludeSundays);
        setAlreadyPaidCount(Math.max(0, Math.min(elapsed, Number(totalDays) || 0)));
      } else {
        const effectiveWd =
          frequency === "weekly" || (frequency === "biweekly" && useFixedWeekdayForBiweekly)
            ? paymentWeekday
            : undefined;
        const sched = getLoanScheduledDates({
          startDate: newStart,
          totalDays: Number(totalDays) || 0,
          excludeSundays: simExcludeSundays,
          frequency,
          paymentWeekday: effectiveWd
        });
        const dueCount = sched.filter(d => d <= simClosingDate).length;
        setAlreadyPaidCount(Math.max(0, Math.min(dueCount, Number(totalDays) || 0)));
      }
    }
  };

  const handleSimExcludeSundaysChange = (checked: boolean) => {
    setSimExcludeSundays(checked);
    recalculateRetroStartDate(alreadyPaidCount, simClosingDate, checked, frequency);
  };

  const [error, setError] = useState("");
  const [isCustomizingParams, setIsCustomizingParams] = useState(false);

  // States for search and autocompleting existing clients in database
  const [existingClients, setExistingClients] = useState<Client[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Client[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    (clientToEdit && !isCopyMode) ? clientToEdit.client.id : null
  );

  // Load registered clients on mount
  useEffect(() => {
    const loadRegisteredClients = async () => {
      try {
        const clients = await dbService.getClients();
        setExistingClients(clients);
      } catch (err) {
        console.error("Erro ao carregar clientes cadastrados para sugestão:", err);
      }
    };
    loadRegisteredClients();
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    setSelectedClientId(null); // Clear ID link on typed changes
    
    if (val.trim().length >= 2) {
      const filtered = existingClients.filter(c => 
        c.name.toLowerCase().includes(val.toLowerCase())
      );
      const seenIds = new Set<string>();
      const uniqueFiltered = filtered.filter(c => {
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
      });
      setFilteredSuggestions(uniqueFiltered);
      setShowSuggestions(true);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (client: Client) => {
    setName(client.name);
    
    // Mask structure for Brazilian phone: (99) 99999-9999
    let raw = client.phone.replace(/\D/g, "");
    if (raw.length > 10) {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`);
    } else if (raw.length > 6) {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`);
    } else if (raw.length > 2) {
      setPhone(`(${raw.slice(0, 2)}) ${raw.slice(2)}`);
    } else {
      setPhone(raw);
    }
    
    setSelectedClientId(client.id);
    setShowSuggestions(false);

    // Fetch this client's most recent loan to auto-populate previous details
    try {
      const loans = await dbService.getLoans();
      const clientLoans = loans
        .filter(l => l.clientId === client.id)
        .sort((a, b) => b.startDate.localeCompare(a.startDate));
      
      if (clientLoans.length > 0) {
        const lastLoan = clientLoans[0];
        const lastFreq = getLoanFrequency(lastLoan);
        setAmountInvested(lastLoan.amountInvested);
        setTotalDays(lastLoan.totalDays);
        setDailyRate(lastLoan.dailyRate);
        setSimExcludeSundays(lastLoan.excludeSundays !== false);
        setFrequency(lastFreq);
        if (lastLoan.paymentWeekday !== undefined) {
          setPaymentWeekday(lastLoan.paymentWeekday);
          setUseFixedWeekdayForBiweekly(lastFreq === "biweekly");
        }
        setIsFirstDueManuallyEdited(false);
        
        // Recalculate interest rate
        const principal = lastLoan.amountInvested;
        const total = lastLoan.dailyRate * lastLoan.totalDays;
        const profit = total - principal;
        const interest = principal > 0 ? Math.round((profit / principal) * 100) : 42;
        setInterestRate(interest);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do último contrato:", err);
    }
  };

  // Interest State (default to 42% standard layout)
  const [interestRate, setInterestRate] = useState<number>(() => {
    if (clientToEdit && clientToEdit.activeLoan) {
      const principal = clientToEdit.activeLoan.amountInvested;
      const total = clientToEdit.activeLoan.dailyRate * clientToEdit.activeLoan.totalDays;
      const profit = total - principal;
      return principal > 0 ? Math.round((profit / principal) * 100) : 42;
    }
    return 42;
  });

  // Helper: update daily rate from principal, interest rate, and total days
  const updateDailyRateFromInterest = (principal: number, interest: number, days: number) => {
    if (principal > 0 && days > 0) {
      const total = principal * (1 + interest / 100);
      const rate = total / days;
      setDailyRate(Number(rate.toFixed(2)));
    }
  };

  // State handlers to ensure bi-directional synchronization
  const handleAmountChange = (val: number | "") => {
    setAmountInvested(val);
    if (val !== "") {
      const days = Number(totalDays) || 0;
      updateDailyRateFromInterest(Number(val), interestRate, days);
    } else {
      setDailyRate("");
    }
  };

  const handleInterestChange = (newInterest: number) => {
    setInterestRate(newInterest);
    const principal = Number(amountInvested) || 0;
    const days = Number(totalDays) || 0;
    if (principal > 0 && days > 0) {
      updateDailyRateFromInterest(principal, newInterest, days);
    }
  };

  const handleDaysChange = (newDays: number | "") => {
    setTotalDays(newDays);
    const principal = Number(amountInvested) || 0;
    const days = Number(newDays) || 0;
    if (principal > 0 && days > 0) {
      updateDailyRateFromInterest(principal, interestRate, days);
    }
  };

  const handleDailyRateChange = (newRate: number | "") => {
    setDailyRate(newRate);
    if (newRate !== "") {
      const principal = Number(amountInvested) || 0;
      const days = Number(totalDays) || 0;
      if (principal > 0 && days > 0) {
        const total = newRate * days;
        const profit = total - principal;
        const interest = (profit / principal) * 100;
        setInterestRate(Math.round(interest));
      }
    }
  };

  // Auto-calculated fields for preview section
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [calculatedProfit, setCalculatedProfit] = useState(0);
  const [calculatedInterest, setCalculatedInterest] = useState(0);

  useEffect(() => {
    const principal = Number(amountInvested) || 0;
    const rate = Number(dailyRate) || 0;
    const days = Number(totalDays) || 0;

    const total = rate * days;
    const profit = total - principal;
    const interest = principal > 0 ? (profit / principal) * 100 : 0;

    setCalculatedTotal(total);
    setCalculatedProfit(profit);
    setCalculatedInterest(interest);
  }, [amountInvested, dailyRate, totalDays]);

  // Mask for mobile number (BR Format)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    // Mask structure: (99) 99999-9999
    if (value.length > 10) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    setPhone(value);
  };

  const handleFrequencyChange = (newFreq: PaymentFrequency) => {
    setFrequency(newFreq);
    setIsFirstDueManuallyEdited(false);

    if (newFreq !== "daily") {
      setIsCustomizingParams(true);
    }

    // Apply smart default installment count for new/copied contracts
    if (!clientToEdit || isCopyMode) {
      const defaultInstallments: Record<PaymentFrequency, number> = {
        daily: 26,
        weekly: 4,
        biweekly: 2,
        monthly: 3
      };
      const nextCount = defaultInstallments[newFreq];
      setTotalDays(nextCount);
      const principal = Number(amountInvested) || 0;
      if (principal > 0) {
        updateDailyRateFromInterest(principal, interestRate, nextCount);
      }
    }
  };

  const effectivePaymentWeekday =
    frequency === "weekly" || (frequency === "biweekly" && useFixedWeekdayForBiweekly)
      ? paymentWeekday
      : undefined;

  const previewSchedule = useMemo(() => {
    const count = Math.min(6, Math.max(0, Number(totalDays) || 0));
    if (!startDate || count === 0) return [];
    return getLoanScheduledDates(
      {
        startDate,
        totalDays: count,
        excludeSundays: simExcludeSundays,
        frequency,
        paymentWeekday: effectivePaymentWeekday,
        firstDueDate: frequency !== "daily" ? firstDueDate : undefined
      },
      count
    );
  }, [startDate, totalDays, simExcludeSundays, frequency, effectivePaymentWeekday, firstDueDate]);

  const handleSendSimulation = () => {
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone ? `55${cleanPhone}` : "";
    
    const principalVal = Number(amountInvested) || 0;
    const rateVal = Number(dailyRate) || 0;
    const daysVal = Number(totalDays) || 0;

    const unitText =
      frequency === "weekly"
        ? `parcelas semanais (toda ${WEEKDAY_NAMES_FULL[paymentWeekday]})`
        : frequency === "biweekly"
          ? "parcelas quinzenais"
          : frequency === "monthly"
            ? "parcelas mensais"
            : "diárias";

    const ruleNote =
      frequency === "weekly"
        ? `⚠️ *Pagamentos semanais toda ${WEEKDAY_NAMES_FULL[paymentWeekday]}.*`
        : frequency === "biweekly"
          ? "⚠️ *Pagamentos quinzenais.*"
          : frequency === "monthly"
            ? "⚠️ *Pagamentos mensais.*"
            : "⚠️ *Pagamentos de segunda a sábado.*";

    const message = `Olá, essa é a simulação de seu valor solicitado.

💵 *Valor solicitado:* R$ ${principalVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
🗓️ *Parcelas:* ${daysVal} ${unitText} de R$ ${rateVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

*Está de acordo?* Envie seu documento com foto, selfie, comprovante de residência.

${ruleNote}

🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨


`;

    const url = formattedPhone 
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
      
    window.open(url, "_blank");
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Insira o nome do cliente.");
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setError("Insira um telefone e WhatsApp válido.");
      return;
    }

    const principal = Number(amountInvested);
    if (!principal || principal <= 0) {
      setError("Insira um valor investido válido.");
      return;
    }

    const days = Number(totalDays);
    if (!days || days <= 0) {
      setError("Insira a quantidade de parcelas válida.");
      return;
    }

    const rate = Number(dailyRate);
    if (!rate || rate <= 0) {
      setError("Insira o valor da parcela válido.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name,
        phone: cleanPhone,
        amountInvested: principal,
        totalDays: days,
        dailyRate: rate,
        startDate,
        clientId: selectedClientId || undefined,
        alreadyPaidCount: (clientToEdit && !isCopyMode)
          ? alreadyPaidCount
          : (alreadyPaidCount > 0 ? alreadyPaidCount : undefined),
        frequency,
        paymentWeekday: effectivePaymentWeekday,
        firstDueDate: frequency !== "daily" ? firstDueDate : undefined
      });
    } catch (err: any) {
      console.error("Erro ao registrar cliente/empréstimo:", err);
      // Give a highly descriptive error for the user to understand if their Supabase setup is incomplete!
      setError(err?.message || "Ocorreu um erro ao salvar os dados no banco de dados. Se estiver usando o Supabase, certifique-se de executar o script de Tabelas SQL fornecido nas configurações.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={isEmbeddedInTab ? "w-full select-none" : "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/84 backdrop-blur-sm animate-fade-in select-none"}>
      <div 
        id={isEmbeddedInTab ? "client-form-embedded" : "client-form-modal"}
        className={isEmbeddedInTab ? "" : "w-full max-w-lg bg-zinc-900 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col"}
      >
        {/* Header */}
        {!isEmbeddedInTab && (
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-zinc-505/20 bg-zinc-950/40">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-tr from-amber-500 to-yellow-400 text-black rounded-lg">
                {isCopyMode ? <Copy className="w-4 h-4 font-bold" /> : clientToEdit ? <Pencil className="w-4 h-4 font-bold" /> : <Plus className="w-4 h-4 font-bold" />}
              </div>
              <div>
                <h3 className="font-semibold text-zinc-100 text-sm md:text-base">
                  {isCopyMode ? "Copiar e Novo Contrato" : clientToEdit ? "Editar Cliente & Contrato" : "Novo Cliente & Empréstimo"}
                </h3>
                <p className="text-[10px] text-zinc-500">
                  {isCopyMode ? "Abra um novo contrato para este cliente duplicando os dados anteriores como modelo" : clientToEdit ? "Atualize as informações de cadastro e os termos financeiros" : "Crie o cliente e o contrato de empréstimo ativo"}
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="p-1 px-2.5 hover:bg-zinc-805 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer text-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className={isEmbeddedInTab ? "space-y-4" : "flex-1 overflow-y-auto max-h-[75vh] p-4 md:p-6 space-y-4"}>
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center font-medium">
              {error}
            </div>
          )}

          {/* DADOS CADASTRAIS DO CLIENTE */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block">Dados de Contato</span>
            
            {/* Nome */}
            <div className="relative">
              <label className="text-[10px] text-zinc-400 font-medium block mb-1">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="text"
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  onFocus={() => {
                    if (name.trim().length >= 2 && filteredSuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Pequeno timeout para permitir que o clique no botão de sugestão de dados seja processado antes do blur ocultar o container
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-amber-400 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-650 transition-colors"
                  required
                  autoComplete="off"
                />
              </div>

              {/* Box de Sugestões de Auto-complete para o Usuário */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 divide-y divide-zinc-850/45">
                  <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-wider block p-2 select-none bg-zinc-950/60 rounded-t-lg">
                    Clientes Cadastrados no Banco (Sugestão)
                  </span>
                  {filteredSuggestions.map(client => (
                    <button
                      key={client.id}
                      type="button"
                      onMouseDown={() => handleSelectSuggestion(client)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 text-zinc-200 hover:text-yellow-400 font-medium flex items-center justify-between transition-colors first:rounded-xl last:rounded-xl cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">{client.name}</span>
                        <span className="text-[9px] text-zinc-500 font-mono">
                          {client.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
                        </span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 bg-yellow-400/15 text-yellow-400 rounded-md font-bold uppercase tracking-wider select-none shrink-0 border border-yellow-400/20">
                        Selecionar
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Alerta de Cliente de sugestão preenchido */}
              {selectedClientId && (
                <div className="flex items-center justify-between mt-1 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg select-none text-[10px] text-emerald-400 animate-fade-in font-medium">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Vinculado ao cliente cadastrado no banco.</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientId(null);
                      setName("");
                      setPhone("");
                    }}
                    className="text-[9px] hover:text-red-400 font-extrabold uppercase hover:underline cursor-pointer tracking-wider"
                  >
                    Desvincular
                  </button>
                </div>
              )}
            </div>

            {/* Whatsapp */}
            <div>
              <label className="text-[10px] text-zinc-400 font-medium block mb-1">Telefone / WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="text"
                  placeholder="Ex: (11) 99999-9999"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-amber-400 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-650 transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          <hr className="border-zinc-800" />

          {/* DADOS FINANCEIROS DO EMPRÉSTIMO */}
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block">Parametrização do Contrato</span>

            {/* SELETOR DE MODALIDADE DE COBRANÇA */}
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-yellow-500" />
                Modalidade de Pagamento
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["daily", "weekly", "biweekly", "monthly"] as PaymentFrequency[]).map(freqOption => (
                  <button
                    key={freqOption}
                    type="button"
                    onClick={() => handleFrequencyChange(freqOption)}
                    className={`py-2 px-2 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer ${
                      frequency === freqOption
                        ? "bg-yellow-500 text-zinc-950 border-yellow-500 shadow-md shadow-yellow-500/15"
                        : "bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    {FREQUENCY_LABELS[freqOption]}
                  </button>
                ))}
              </div>
            </div>

            {/* SELETOR DE DIA DA SEMANA (SEMANAL OU QUINZENAL FIXA) */}
            {(frequency === "weekly" || frequency === "biweekly") && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-yellow-500">
                    {frequency === "weekly" ? "Dia Fixo da Semana (Ex: Toda Sexta)" : "Regra da Quinzena"}
                  </span>
                  {frequency === "biweekly" && (
                    <button
                      type="button"
                      onClick={() => {
                        setUseFixedWeekdayForBiweekly(prev => !prev);
                        setIsFirstDueManuallyEdited(false);
                      }}
                      className={`text-[9px] px-2 py-0.5 rounded-lg border font-bold cursor-pointer transition-colors ${
                        useFixedWeekdayForBiweekly
                          ? "bg-yellow-500 text-zinc-950 border-yellow-500"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800"
                      }`}
                    >
                      {useFixedWeekdayForBiweekly ? "Dia fixo (14d)" : "Corrida (15d)"}
                    </button>
                  )}
                </div>

                {(frequency === "weekly" || useFixedWeekdayForBiweekly) && (
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAY_NAMES_SHORT.map((label, idx) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setPaymentWeekday(idx);
                          setIsFirstDueManuallyEdited(false);
                        }}
                        className={`py-1.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer ${
                          paymentWeekday === idx
                            ? "bg-amber-400 text-zinc-950 border-amber-400 shadow-sm"
                            : "bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                      1ª Cobrança / Vencimento
                    </label>
                    <input
                      type="date"
                      value={firstDueDate}
                      onChange={e => {
                        setFirstDueDate(e.target.value);
                        setIsFirstDueManuallyEdited(true);
                      }}
                      className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-amber-400 focus:outline-none rounded-lg py-1.5 px-2.5 text-xs text-white font-mono font-bold cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="text-[10px] font-mono text-zinc-300 bg-zinc-950/60 border border-zinc-800/80 rounded-lg px-2.5 py-1.5">
                      <span className="text-zinc-500 block text-[8px] uppercase font-bold">Regra Ativa</span>
                      <strong className="text-yellow-500">
                        {frequency === "weekly"
                          ? `Toda ${WEEKDAY_NAMES_FULL[paymentWeekday]}`
                          : useFixedWeekdayForBiweekly
                            ? `${WEEKDAY_NAMES_FULL[paymentWeekday]} a cada 14 dias`
                            : "A cada 15 dias corridos"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DATA DA 1ª PARCELA PARA MENSAL */}
            {frequency === "monthly" && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-fade-in">
                <div>
                  <label className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                    Data da 1ª Mensalidade
                  </label>
                  <input
                    type="date"
                    value={firstDueDate}
                    onChange={e => {
                      setFirstDueDate(e.target.value);
                      setIsFirstDueManuallyEdited(true);
                    }}
                    className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-amber-400 focus:outline-none rounded-lg py-1.5 px-2.5 text-xs text-white font-mono font-bold cursor-pointer"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="text-[10px] font-mono text-zinc-300 bg-zinc-950/60 border border-zinc-800/80 rounded-lg px-2.5 py-1.5">
                    <span className="text-zinc-500 block text-[8px] uppercase font-bold">Regra Ativa</span>
                    <strong className="text-yellow-500">
                      Todo mês no dia {firstDueDate ? firstDueDate.split("-")[2] : "--"}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Valor Emprestado (Investido) */}
              <div>
                <label className="text-[10px] text-zinc-400 font-medium block mb-1">Capital Emprestado (R$)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input 
                    type="number"
                    placeholder="Ex: 1000"
                    value={amountInvested}
                    onChange={e => handleAmountChange(e.target.value !== "" ? Number(e.target.value) : "")}
                    className="w-full bg-zinc-950/60 border border-zinc-850 focus:border-amber-400 focus:outline-none rounded-xl py-2.5 pl-8 pr-3 text-sm text-zinc-100 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    required
                  />
                </div>
              </div>

              {/* Valor da Parcela */}
              <div>
                <label className="text-[10px] text-zinc-400 font-medium block mb-1">
                  {frequency === "daily"
                    ? "Valor da Diária (R$)"
                    : frequency === "weekly"
                      ? "Valor Semanal (R$)"
                      : frequency === "biweekly"
                        ? "Valor Quinzenal (R$)"
                        : "Valor Mensal (R$)"}
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="Ex: 50"
                    value={dailyRate}
                    onChange={e => handleDailyRateChange(e.target.value !== "" ? Number(e.target.value) : "")}
                    className="w-full bg-zinc-950/60 border border-zinc-855 focus:border-amber-400 focus:outline-none rounded-xl py-2.5 pl-8 pr-3 text-sm text-zinc-100 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    required
                  />
                </div>
              </div>
            </div>
                  {/* CUSTOMIZATION OF TERMS (TOGGLE PATTERN) */}
            {(!isCustomizingParams && !clientToEdit && frequency === "daily") ? (
              <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 select-none">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider block">Parâmetros Ativos de Liberação</span>
                  <p className="text-xs text-zinc-300 font-semibold font-mono">
                    <span className="text-amber-400">42%</span> de Juros • <span className="text-amber-400">26</span> Dias • Inicia Hoje
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomizingParams(true)}
                  className="py-1.5 px-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs text-yellow-400 font-bold hover:text-yellow-300 rounded-lg cursor-pointer transition-colors shrink-0"
                >
                  ⚙️ Editar Juros / Dias / Data
                </button>
              </div>
            ) : (
              <div className="space-y-4 p-4 border border-zinc-800/80 bg-zinc-950/20 rounded-2xl animate-fade-in relative">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Ajustes do Contrato</span>
                  {!clientToEdit && frequency === "daily" && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomizingParams(false);
                        handleInterestChange(42);
                        handleDaysChange(26);
                        setStartDate(baseToday);
                      }}
                      className="text-[10px] text-amber-500 hover:text-amber-400 cursor-pointer font-bold"
                    >
                      Restaurar Padrão (42% / 26 dias)
                    </button>
                  )}
                </div>

                {/* BARRA DE JUROS EDITÁVEL */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center select-none">
                    <div className="flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-amber-400" />
                      <label className="text-xs font-semibold text-zinc-200">Taxa de Juros do Empréstimo</label>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={interestRate}
                        onChange={e => handleInterestChange(Math.max(0, Number(e.target.value) || 0))}
                        className="w-14 bg-zinc-900 border border-zinc-800 focus:outline-none rounded-lg px-1.5 py-0.5 text-center text-xs font-mono font-bold text-amber-400"
                      />
                      <span className="text-xs text-zinc-500 font-bold">%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 font-mono">0%</span>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={interestRate > 100 ? 100 : interestRate}
                      onChange={e => handleInterestChange(Number(e.target.value))}
                      className="flex-1 accent-amber-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer appearance-none"
                    />
                    <span className="text-[10px] text-zinc-500 font-mono">100%</span>
                  </div>

                  {/* Quick shortcut buttons */}
                  <div className="flex flex-wrap gap-1.5 justify-between">
                    {[15, 20, 26, 30, 42, 50].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleInterestChange(pct)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                          interestRate === pct
                            ? "bg-amber-400 text-zinc-950 border-amber-400"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {pct}% {pct === 42 ? "(Padrão)" : ""}
                      </button>
                    ))}
                  </div>

                  {/* Dynamic formula calculation preview */}
                  {Number(amountInvested) > 0 && (
                    <div className="text-[10px] text-zinc-400 font-mono bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-800/40 leading-relaxed">
                      <span className="text-amber-400 font-bold">Cálculo:</span> R$ {Number(amountInvested).toLocaleString("pt-BR")} + {interestRate}% = <strong className="text-zinc-200">R$ {((Number(amountInvested) || 0) * (1 + interestRate / 100)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong> dividido por <strong className="text-zinc-200">{totalDays} {FREQUENCY_UNIT_PLURAL[frequency]}</strong> ➔ <strong className="text-amber-400">R$ {dailyRate || "0"} / parcela</strong>
                    </div>
                  )}
                </div>

                <div className={`grid gap-3 pt-1 ${clientToEdit && !isCopyMode ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
                  {/* Quantidade de Parcelas */}
                  <div>
                    <label className="text-[10px] text-zinc-400 font-medium block mb-1">
                      {frequency === "daily"
                        ? "Tempo de Prazo (Dias)"
                        : frequency === "weekly"
                          ? "Qtd. de Semanas"
                          : frequency === "biweekly"
                            ? "Qtd. de Quinzenas"
                            : "Qtd. de Meses"}
                    </label>
                    <input 
                      type="number"
                      min="1"
                      max="365"
                      placeholder="Ex: 26"
                      value={totalDays}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === "") {
                          handleDaysChange("");
                        } else {
                          handleDaysChange(Number(val));
                        }
                      }}
                      onBlur={() => {
                        if (totalDays === "" || Number(totalDays) < 1) {
                          handleDaysChange(frequency === "daily" ? 26 : frequency === "weekly" ? 4 : frequency === "biweekly" ? 2 : 3);
                        }
                      }}
                      className="w-full bg-zinc-950/60 border border-zinc-855 focus:border-amber-400 focus:outline-none rounded-xl py-2 px-3 text-sm text-zinc-100 transition-colors font-mono font-bold h-[42px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      required
                    />
                  </div>

                  {/* Parcelas Já Pagas (somente na edição direta do contrato) */}
                  {clientToEdit && !isCopyMode && (
                    <div>
                      <label className="text-[10px] text-zinc-400 font-medium block mb-1">Parcelas Já Pagas</label>
                      <input
                        type="number"
                        min="0"
                        max={Number(totalDays) || 365}
                        value={alreadyPaidCount}
                        onChange={e => {
                          const maxVal = Math.max(0, Number(totalDays) || 365);
                          const next = Math.min(maxVal, Math.max(0, Number(e.target.value) || 0));
                          setAlreadyPaidCount(next);
                        }}
                        className="w-full bg-zinc-950/60 border border-zinc-855 focus:border-amber-400 focus:outline-none rounded-xl py-2 px-3 text-sm text-amber-400 transition-colors font-mono font-bold h-[42px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  )}

                  {/* Data Inicial */}
                  <div>
                    <label className="text-[10px] text-zinc-400 font-medium block mb-1">Data do Empréstimo (Liberação)</label>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={e => handleStartDateChangeDirect(e.target.value)}
                      className="w-full bg-zinc-950/60 border border-zinc-855 focus:border-amber-400 focus:outline-none rounded-xl py-2 px-3 text-sm text-zinc-100 transition-colors cursor-pointer h-[42px]"
                      required
                    />
                  </div>
                </div>

                {/* Quick Installment Count Shortcuts */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[9px] text-zinc-405 font-bold block uppercase tracking-widest">
                    Prazos Padrões ({FREQUENCY_LABELS[frequency]}):
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(frequency === "daily"
                      ? [26, 31, 62, 93, 124]
                      : frequency === "weekly"
                        ? [4, 6, 8, 10, 12]
                        : frequency === "biweekly"
                          ? [2, 4, 6, 8, 12]
                          : [1, 2, 3, 6, 12]
                    ).map(count => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => handleDaysChange(count)}
                        className={`text-center py-2 text-[11px] font-mono font-extrabold rounded-lg transition-all border cursor-pointer ${
                          totalDays === count
                            ? "bg-yellow-500 border-yellow-500 text-zinc-950 font-black shadow-md shadow-yellow-500/10"
                            : "bg-zinc-900/60 border-zinc-800 text-zinc-405 hover:text-zinc-205 hover:border-zinc-700"
                        }`}
                      >
                        {count}{frequency === "daily" ? "d" : "x"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview das próximas datas de vencimento */}
                {previewSchedule.length > 0 && (
                  <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-2.5 space-y-1">
                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block">
                      Prévia das Próximas Parcelas ({FREQUENCY_LABELS[frequency]}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {previewSchedule.map((dateStr, idx) => (
                        <span
                          key={`${dateStr}-${idx}`}
                          className="text-[10px] font-mono bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded text-zinc-200"
                        >
                          <strong className="text-yellow-500">{idx + 1}ª</strong> {formatDayMonth(dateStr)}
                        </span>
                      ))}
                      {Number(totalDays) > previewSchedule.length && (
                        <span className="text-[10px] font-mono text-zinc-500 self-center">
                          +{Number(totalDays) - previewSchedule.length} mais
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SIMULADOR DE PRESTAÇÕES JÁ PAGAS - ALWAYS VISIBLE FOR NEW CLIENTS */}
          {(!clientToEdit || isCopyMode) && (
            <div className="bg-amber-400/5 border border-amber-400/20 p-4 rounded-2xl space-y-4 animate-fade-in">
              <div className="flex justify-between items-center select-none">
                <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest block flex items-center gap-1.5">
                  🔄 Simulador de Prestações Já Pagas
                </span>
                <span className="text-[9px] text-amber-500/80 font-mono font-extrabold uppercase tracking-widest">
                  Bidirecional Inteligente
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                {/* Parcelas Já Pagas */}
                <div>
                  <label className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-wider block mb-1">
                    Parcelas Já Pagas (Diárias)
                  </label>
                  <div className="flex items-center bg-zinc-950/80 border border-zinc-800 focus-within:border-amber-400/50 rounded-xl overflow-hidden h-[34px]">
                    <button
                      type="button"
                      onClick={() => handleAlreadyPaidCountChange(Math.max(0, alreadyPaidCount - 1))}
                      className="px-2.5 py-1 hover:bg-zinc-900 text-zinc-400 hover:text-white font-black cursor-pointer text-xs animate-none select-none"
                    >
                      -
                    </button>
                    <input 
                      type="number"
                      min="0"
                      max={totalDays}
                      placeholder="0"
                      value={alreadyPaidCount}
                      onChange={e => handleAlreadyPaidCountChange(Number(e.target.value) || 0)}
                      className="w-full bg-transparent text-center text-xs font-mono font-extrabold text-amber-400 border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAlreadyPaidCountChange(Math.min(totalDays, alreadyPaidCount + 1))}
                      className="px-2.5 py-1 hover:bg-zinc-900 text-zinc-400 hover:text-white font-black cursor-pointer text-xs animate-none select-none"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Excluir domingos check */}
                <div className="flex flex-col justify-end">
                  <label className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-wider block mb-1">
                    Isenção de Domingos
                  </label>
                  <button
                    type="button"
                    onClick={() => handleSimExcludeSundaysChange(!simExcludeSundays)}
                    className={`w-full h-[34px] rounded-xl border font-bold text-[10px] uppercase transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                      simExcludeSundays 
                        ? "bg-amber-400/10 border-amber-400/30 text-amber-400" 
                        : "bg-zinc-950/40 border-zinc-850 text-zinc-500 hover:text-zinc-400 hover:border-zinc-800"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${simExcludeSundays ? "bg-amber-400 animate-pulse" : "bg-zinc-650"}`} />
                    {simExcludeSundays ? "Domingos Isentos" : "Domingos Cobrados"}
                  </button>
                </div>

                {/* Data de Início (Liberação) */}
                <div>
                  <label className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-wider block mb-1">
                    📅 Início (Liberação)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => handleStartDateChangeDirect(e.target.value)}
                    className="w-full h-[34px] bg-zinc-950/80 border border-zinc-800 focus:border-amber-400/50 focus:outline-none rounded-xl px-2.5 text-xs text-white font-mono font-bold cursor-pointer"
                  />
                </div>

                {/* Data de Referência (Fechamento/Fim) */}
                <div>
                  <label className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-wider block mb-1">
                    📅 Fechamento (Fim)
                  </label>
                  <input
                    type="date"
                    value={simClosingDate}
                    onChange={e => handleSimClosingDateChange(e.target.value)}
                    className="w-full h-[34px] bg-zinc-950/80 border border-zinc-800 focus:border-amber-400/50 focus:outline-none rounded-xl px-2.5 text-xs text-white font-mono font-bold cursor-pointer"
                  />
                </div>
              </div>

              {/* Explicação Inteligente em tempo real */}
              <div className="text-[10px] text-zinc-350 bg-zinc-950/40 border border-zinc-800/40 rounded-xl p-2.5 leading-relaxed font-mono select-none">
                <span className="text-amber-400 font-black uppercase text-[8px] tracking-wider block mb-1">Resumo do cálculo inteligente:</span>
                Se o cliente já pagou <strong className="text-white font-extrabold underline decoration-amber-400">{alreadyPaidCount} parcelas</strong> para ficar em dia até <span className="text-amber-400 font-bold">{formatFriendlyDate(simClosingDate)}</span>, o contrato precisa iniciar em <span className="text-amber-400 font-bold underline">{formatFriendlyDate(startDate)}</span>.
                <div className="text-[9px] text-zinc-500 mt-1 italic">
                  {simExcludeSundays 
                    ? "ℹ️ Domingos são pulados (isentos) na contagem dos dias para trás." 
                    : "ℹ️ Domingos são cobrados (inclusos) na contagem dos dias para trás."}
                </div>
              </div>
            </div>
          )}

          {/* SIMULADOR PREVIEW */}
          <div className="bg-zinc-950/80 border border-zinc-805 rounded-xl p-4 space-y-2.5 select-none">
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-amber-400" />
              Resumo do Retorno do Contrato
            </span>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800/40">
                <span className="text-[9px] text-zinc-500 block mb-0.5">Total a Receber</span>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  R$ {calculatedTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800/40">
                <span className="text-[9px] text-zinc-500 block mb-0.5">Lucro Bruto</span>
                <span className={`font-mono text-sm font-bold ${calculatedProfit >= 0 ? "text-amber-400" : "text-red-400"}`}>
                  R$ {calculatedProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800/40">
                <span className="text-[9px] text-zinc-500 block mb-0.5">Retorno %</span>
                <span className="font-mono text-xs font-bold text-zinc-200 flex items-center justify-center gap-0.5">
                  <Percent className="w-3 h-3 text-yellow-400" />
                  +{calculatedInterest.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Enviar Simulação via WhatsApp */}
          <button
            type="button"
            onClick={handleSendSimulation}
            disabled={!amountInvested || !dailyRate || !totalDays}
            className={`w-full py-2.5 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg select-none ${
              (!amountInvested || !dailyRate || !totalDays)
                ? "bg-zinc-800 text-zinc-500 border border-zinc-700/60 cursor-not-allowed shadow-none"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/20 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            }`}
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span>Enviar Simulação via WhatsApp</span>
          </button>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 border border-zinc-705 text-zinc-300 font-semibold hover:bg-zinc-805 hover:text-zinc-100 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-3 font-extrabold rounded-xl text-xs transition-all cursor-pointer ${
                isSubmitting
                  ? "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black shadow-lg shadow-amber-500/10 hover:shadow-amber-500/15 animate-pulse-subtle"
              }`}
            >
              {isSubmitting ? (isCopyMode ? "Criando contrato..." : "Cadastrando...") : isCopyMode ? "Confirmar Novo Contrato" : clientToEdit ? "Salvar Alterações" : "Iniciar Operação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
