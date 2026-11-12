"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Receipt } from "lucide-react"

function MicrosoftAuthorizeCallback() {
  const { status } = useSession()
  const searchParams = useSearchParams()
  const [error, setError] = useState("")

  useEffect(() => {
    if (status === "loading") return

    if (status === "unauthenticated") {
      setError("No se pudo iniciar sesión con Microsoft")
      return
    }

    if (status === "authenticated") {
      fetch("/api/oauth/authorize-microsoft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: searchParams.get("client_id"),
          redirect_uri: searchParams.get("redirect_uri"),
          state: searchParams.get("state"),
          code_challenge: searchParams.get("code_challenge"),
          code_challenge_method: searchParams.get("code_challenge_method"),
          scope: searchParams.get("scope"),
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            window.location.href = data.redirectTo
          } else {
            setError(data.error_description || "Error al autorizar el acceso")
          }
        })
        .catch(() => setError("Error de conexión"))
    }
  }, [status, searchParams])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <button onClick={() => history.back()} className="text-sm text-primary underline">
            Volver a intentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Receipt className="mx-auto h-12 w-12 animate-pulse" />
        <p className="mt-4 text-muted-foreground">Conectando con Microsoft...</p>
      </div>
    </div>
  )
}

export default function MicrosoftAuthorizeCallbackPage() {
  return (
    <Suspense fallback={null}>
      <MicrosoftAuthorizeCallback />
    </Suspense>
  )
}
