"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { registerSchema, RegisterInput } from "@/lib/validations/auth"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterInput) {
    setError(null)
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? "Erro ao criar conta")
      return
    }

    await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    router.push("/onboarding")
    router.refresh()
  }

  return (
    <div>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-400 text-xs font-semibold tracking-wide uppercase">
            14 dias grátis — sem cartão
          </span>
        </div>
        <h1
          className="text-white mb-2"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "2.5rem",
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          Cadastre sua barbearia
        </h1>
        <p className="text-zinc-500 text-sm">
          Comece grátis e profissionalize seus agendamentos hoje.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
            Nome da barbearia
          </label>
          <input
            placeholder="Barbearia do João"
            className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-lg px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
            {...register("shopName")}
          />
          {errors.shopName && (
            <p className="text-red-400 text-xs mt-1.5">{errors.shopName.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
            Seu nome
          </label>
          <input
            placeholder="João Silva"
            className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-lg px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-red-400 text-xs mt-1.5">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
            Email
          </label>
          <input
            type="email"
            placeholder="joao@barbearia.com"
            className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-lg px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
            Senha
          </label>
          <input
            type="password"
            placeholder="Mínimo 8 caracteres"
            className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-lg px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-red-400 text-xs mt-1.5">{errors.password.message}</p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/50 border border-red-800/50 px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-semibold rounded-lg py-3 text-sm tracking-wide transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {isSubmitting ? "Criando conta..." : "Começar gratuitamente →"}
        </button>

        <p className="text-zinc-600 text-xs text-center leading-relaxed">
          Ao criar uma conta você concorda com os{" "}
          <span className="text-zinc-500 underline underline-offset-2 cursor-pointer hover:text-zinc-300">
            Termos de Uso
          </span>
        </p>
      </form>

      <div className="mt-6 pt-6 border-t border-zinc-800/60">
        <p className="text-zinc-500 text-sm text-center">
          Já tem conta?{" "}
          <Link
            href="/login"
            className="text-amber-400 hover:text-amber-300 font-semibold transition-colors"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
