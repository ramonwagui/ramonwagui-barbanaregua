import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"

// Configuração leve para Edge Runtime (usada apenas no middleware)
// Não importa Prisma nem módulos nativos Node.js
export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      // authorize não é chamado no middleware, só no login
      authorize: async () => null,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
        token.tenantId = (user as { tenantId: string | null }).tenantId
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as "SUPER_ADMIN" | "TENANT_OWNER" | "BARBER" | "CLIENT"
        session.user.tenantId = token.tenantId as string | null
      }
      return session
    },
  },
}
