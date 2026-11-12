"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Receipt, ShieldCheck } from "lucide-react"

function AuthorizeForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const clientId = searchParams.get("client_id")
  const redirectUri = searchParams.get("redirect_uri")
  const state = searchParams.get("state")
  const codeChallenge = searchParams.get("code_challenge")
  const codeChallengeMethod = searchParams.get("code_challenge_method")
  const scope = searchParams.get("scope")

  const missingParams = !clientId || !redirectUri || !codeChallenge

  const handleMicrosoftLogin = () => {
    const callbackUrl = `/oauth/authorize/microsoft-callback?${searchParams.toString()}`
    signIn("azure-ad", { callbackUrl })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          scope,
        }),
      })

      const data = await response.json()

      if (data.success) {
        window.location.href = data.redirectTo
      } else {
        setError(data.error_description || "Email o contraseña incorrectos")
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  if (missingParams) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Solicitud inválida</CardTitle>
          <CardDescription>
            Faltan parámetros de la conexión. Volvé a intentarlo desde claude.ai.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          <CardTitle className="text-2xl">GestorGastos</CardTitle>
        </div>
        <CardDescription className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span>
            Un asistente de IA quiere conectarse a tu cuenta para cargar gastos como pendientes
            de revisión. Nunca confirma gastos por sí solo — vos los revisás y editás después.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center gap-3 h-11 text-base font-medium border-2 hover:bg-accent"
          disabled={loading}
          onClick={handleMicrosoftLogin}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" className="h-5 w-5 shrink-0">
            <path fill="#f3f3f3" d="M0 0h23v23H0z" />
            <path fill="#f35325" d="M1 1h10v10H1z" />
            <path fill="#81bc06" d="M12 1h10v10H12z" />
            <path fill="#05a6f0" d="M1 12h10v10H1z" />
            <path fill="#ffba08" d="M12 12h10v10H12z" />
          </svg>
          Autorizar con Microsoft
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">o con contraseña</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@pueblaequipo.com.ar"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full button-elegant" disabled={loading}>
            {loading ? "Conectando..." : "Autorizar acceso"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function OAuthAuthorizePage() {
  return (
    <div className="page-container flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={null}>
        <AuthorizeForm />
      </Suspense>
    </div>
  )
}
