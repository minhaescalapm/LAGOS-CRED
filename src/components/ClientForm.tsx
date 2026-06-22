import React, { useState, useEffect } from "react";
import { Plus, User, Phone, DollarSign, Calendar, X, Percent, CheckCircle, Pencil } from "lucide-react";
import { ClientWithLoanDetails } from "../types";
import { getTodayStr } from "../utils/dateUtils";

interface ClientFormProps {
  onClose?: () => void;
  onSubmit: (clientData: {
    name: string;
    phone: string;
    amountInvested: number;
    totalDays: number;
    dailyRate: number;
    startDate: string;
  }) => void;
  clientToEdit?: ClientWithLoanDetails | null;
  isEmbeddedInTab?: boolean;
}

export function ClientForm({ onClose, onSubmit, clientToEdit, isEmbeddedInTab }: ClientFormProps) {
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
  const [totalDays, setTotalDays] = useState<number>(
    clientToEdit && clientToEdit.activeLoan ? clientToEdit.activeLoan.totalDays : 26
  ); 
  const [dailyRate, setDailyRate] = useState<number | "">(
    clientToEdit && clientToEdit.activeLoan ? clientToEdit.activeLoan.dailyRate : ""
  );
  const [startDate, setStartDate] = useState(() => {
    if (clientToEdit && clientToEdit.activeLoan) {
      return clientToEdit.activeLoan.startDate;
    }
    return getTodayStr();
  });

  const [error, setError] = useState("");
  const [isCustomizingParams, setIsCustomizingParams] = useState(false);

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
      updateDailyRateFromInterest(val, interestRate, totalDays);
    } else {
      setDailyRate("");
    }
  };

  const handleInterestChange = (newInterest: number) => {
    setInterestRate(newInterest);
    const principal = Number(amountInvested) || 0;
    if (principal > 0) {
      updateDailyRateFromInterest(principal, newInterest, totalDays);
    }
  };

  const handleDaysChange = (newDays: number) => {
    setTotalDays(newDays);
    const principal = Number(amountInvested) || 0;
    if (principal > 0) {
      updateDailyRateFromInterest(principal, interestRate, newDays);
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

  const handleSubmit = (e: React.FormEvent) => {
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
      setError("Insira a quantidade de dias válida.");
      return;
    }

    const rate = Number(dailyRate);
    if (!rate || rate <= 0) {
      setError("Insira o valor da diária válido.");
      return;
    }

    // Submit
    onSubmit({
      name,
      phone: cleanPhone,
      amountInvested: principal,
      totalDays: days,
      dailyRate: rate,
      startDate
    });
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
                {clientToEdit ? <Pencil className="w-4 h-4 font-bold" /> : <Plus className="w-4 h-4 font-bold" />}
              </div>
              <div>
                <h3 className="font-semibold text-zinc-100 text-sm md:text-base">
                  {clientToEdit ? "Editar Cliente & Contrato" : "Novo Cliente & Empréstimo"}
                </h3>
                <p className="text-[10px] text-zinc-500">
                  {clientToEdit ? "Atualize as informações de cadastro e os termos financeiros" : "Crie o cliente e o contrato de empréstimo ativo"}
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
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800 focus:border-amber-400 focus:outline-none rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-650 transition-colors"
                  required
                />
              </div>
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

              {/* Valor da Diária */}
              <div>
                <label className="text-[10px] text-zinc-400 font-medium block mb-1">Valor da Diária (R$)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input 
                    type="number"
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
            {(!isCustomizingParams && !clientToEdit) ? (
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
                  {!clientToEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomizingParams(false);
                        handleInterestChange(42);
                        handleDaysChange(26);
                        setStartDate(getTodayStr());
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
                        max="150"
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
                      <span className="text-amber-400 font-bold">Cálculo:</span> R$ {Number(amountInvested).toLocaleString("pt-BR")} + {interestRate}% = <strong className="text-zinc-200">R$ {((Number(amountInvested) || 0) * (1 + interestRate / 100)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong> dividido por <strong className="text-zinc-200">{totalDays} dias</strong> ➔ <strong className="text-amber-400">R$ {dailyRate || "0"} / dia</strong>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Tempo do Empréstimo (Dias) */}
                  <div>
                    <label className="text-[10px] text-zinc-400 font-medium block mb-1">Tempo de Prazo (Dias)</label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input 
                        type="number"
                        min="1"
                        max="365"
                        placeholder="Ex: 26"
                        value={totalDays}
                        onChange={e => handleDaysChange(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full bg-zinc-950/60 border border-zinc-855 focus:border-amber-400 focus:outline-none rounded-xl py-2.5 pl-10 pr-3 text-sm text-zinc-100 transition-colors font-mono font-bold"
                        required
                      />
                    </div>
                  </div>

                  {/* Data Inicial */}
                  <div>
                    <label className="text-[10px] text-zinc-400 font-medium block mb-1">Data Inicial (Cobrança)</label>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-zinc-950/60 border border-zinc-855 focus:border-amber-400 focus:outline-none rounded-xl py-2 px-3 text-sm text-zinc-100 transition-colors cursor-pointer h-[42px]"
                      required
                    />
                  </div>
                </div>

                {/* Quick Days Shortcuts */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[9px] text-zinc-500 font-bold block uppercase tracking-widest">Atalhos rápidos para o prazo de dias:</span>
                  <div className="flex flex-wrap gap-1">
                    {[10, 15, 20, 26, 30, 45, 60].map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDaysChange(day)}
                        className={`flex-1 text-center py-1.5 text-[10px] font-mono font-extrabold rounded-lg transition-all border cursor-pointer ${
                          totalDays === day
                            ? "bg-yellow-500 border-yellow-500 text-zinc-950 font-black shadow-md shadow-yellow-500/10"
                            : "bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {day}d {day === 26 ? "(Padrão)" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

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
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-extrabold rounded-xl text-xs shadow-lg shadow-amber-500/10 hover:shadow-amber-500/15 transition-all cursor-pointer"
            >
              {clientToEdit ? "Salvar Alterações" : "Iniciar Operação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
