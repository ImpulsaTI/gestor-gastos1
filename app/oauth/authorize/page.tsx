"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
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
      <CardContent>
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
