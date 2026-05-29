"use client"

import { Suspense } from "react"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, LoginInput } from "@/lib/validations/auth"
import Link from "next/link"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginInput) {
    setError(null)
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      setError("Email ou senha incorretos")
      return
    }

    // Verificar role para redirecionar super admin para /admin
    const sessionRes = await fetch("/api/auth/session")
    const sessionData = await sessionRes.json()
    if (sessionData?.user?.role === "SUPER_ADMIN") {
      router.push("/admin")
    } else {
      router.push(callbackUrl)
    }
    router.refresh()
  }

  return (
    <div>
      <div className="mb-10">
        <h1
          className="text-white mb-2"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "2.5rem",
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          Bem-vindo de volta
        </h1>
        <p className="text-zinc-500 text-sm">Acesse o painel da sua barbearia</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
            Email
          </label>
          <input
            type="email"
            placeholder="seu@email.com"
            className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-lg px-4 py-3 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-red-400 text-xs mt-1.5">{errors.email.message}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest">
              Senha
            </label>
            <Link href="/forgot-password" className="text-xs text-zinc-500 hover:text-amber-400 transition-colors">
              Esqueceu?
            </Link>
          </div>
          <input
            type="password"
            placeholder="••••••••"
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
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-zinc-800/60">
        <p className="text-zinc-500 text-sm text-center">
          Não tem conta?{" "}
          <Link
            href="/register"
            className="text-amber-400 hover:text-amber-300 font-semibold transition-colors"
          >
            Cadastrar barbearia
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-zinc-500 text-sm text-center py-8">Carregando...</div>}>
      <LoginForm />
    </Suspense>
  )
}
