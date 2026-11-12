import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 // 1 hora
export const AUTH_CODE_TTL_SECONDS = 10 * 60 // 10 minutos

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Verifica un code_verifier (PKCE) contra el code_challenge guardado al autorizar.
export function verifyPkce(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method === 'plain') {
    return codeVerifier === codeChallenge
  }
  if (method === 'S256') {
    const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
    return computed === codeChallenge
  }
  return false
}

// Emite un authorization code para un usuario ya autenticado (password o Microsoft)
// y arma la URL de retorno hacia el cliente MCP (claude.ai).
export async function issueAuthorizationCode(params: {
  userId: string
  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod?: string | null
  scope?: string | null
  state?: string | null
}): Promise<string> {
  const code = generateToken(32)
  await prisma.oAuthAuthorizationCode.create({
    data: {
      code,
      clientId: params.clientId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod || 'S256',
      scope: params.scope || null,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
    },
  })

  const redirectUrl = new URL(params.redirectUri)
  redirectUrl.searchParams.set('code', code)
  if (params.state) redirectUrl.searchParams.set('state', params.state)
  return redirectUrl.toString()
}

// Base URL pública de la app, para armar las URLs de los endpoints OAuth/MCP.
export function getBaseUrl(request: NextRequest): string {
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes('localhost')) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, '')
  }
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  return `${proto}://${host}`
}
