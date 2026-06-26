import React, { useState, useEffect } from "react";
import { Lock, Phone, Eye, EyeOff, LogIn, ShieldAlert, KeyRound, DollarSign, Wallet } from "lucide-react";

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Apply phone mask as user types: (XX) XXXXX-XXXX
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) {
      value = value.slice(0, 11);
    }

    if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }

    setPhone(value);
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Raw numbers for validation
    const rawPhone = phone.replace(/\D/g, "");
    const targetPhone = "22992040941";
    const targetPassword = "050805";

    setTimeout(() => {
      if (rawPhone === targetPhone && password === targetPassword) {
        // Persist session
        localStorage.setItem("gestao_emprestimos_logged_in", "true");
        onLoginSuccess();
      } else {
        setError("Telefone ou senha inválidos. Por favor, tente novamente.");
        setLoading(false);
      }
    }, 600); // Friendly visual delay
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Decorative ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-8 shadow-2xl relative backdrop-blur-md space-y-6">
        {/* Brand/Logo Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 bg-yellow-500/10 text-yellow-500 rounded-2xl border border-yellow-500/20 shadow-lg mb-1">
            <Wallet className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">FinancEsfera</h1>
          <p className="text-xs text-zinc-500">Sistema Seguro de Gestão de Empréstimos</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Phone input */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider block">
              Telefone de Acesso
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-zinc-550 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="(22) 99204-0941"
                value={phone}
                onChange={handlePhoneChange}
                required
                className="w-full bg-zinc-950/60 border border-zinc-800/80 focus:border-yellow-500/50 focus:outline-none rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-600 transition-colors"
                autoComplete="tel"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider block">
                Senha Numérica
              </label>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-zinc-550 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="******"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                required
                className="w-full bg-zinc-950/60 border border-zinc-800/80 focus:border-yellow-500/50 focus:outline-none rounded-xl py-3 pl-10 pr-12 text-sm text-zinc-100 placeholder-zinc-650 transition-colors tracking-widest"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-550 hover:text-zinc-300 p-1 rounded transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl flex items-start gap-2.5 leading-relaxed animate-fade-in">
              <ShieldAlert className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-zinc-800 text-zinc-950 disabled:text-zinc-500 font-black text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 shadow-lg shadow-yellow-500/10 hover:shadow-yellow-500/20"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Entrar no Painel
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="text-center pt-2">
          <p className="text-[10px] text-zinc-600">
            Acesso restrito ao administrador. Conexão criptografada de alta segurança.
          </p>
        </div>
      </div>
    </div>
  );
}
