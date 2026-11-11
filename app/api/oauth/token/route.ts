import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateToken, verifyPkce, ACCESS_TOKEN_TTL_SECONDS } from '@/lib/oauth'

async function parseBody(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return await request.json()
  }
  const text = await request.text()
  return Object.fromEntries(new URLSearchParams(text))
}

async function issueTokenPair(clientId: string, userId: string, scope: string | null) {
  const accessToken = generateToken(32)
  const refreshToken = generateToken(32)

  await prisma.$transaction([
    prisma.oAuthAccessToken.create({
      data: {
        token: accessToken,
        clientId,
        userId,
        scope,
        expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000),
      },
    }),
    prisma.oAuthRefreshToken.create({
      data: { token: refreshToken, clientId, userId, scope },
    }),
  ])

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: scope || undefined,
  })
}

function invalidClient(client: { clientSecret: string | null } | null, providedSecret: string | undefined) {
  if (!client) return true
  if (client.clientSecret && client.clientSecret !== providedSecret) return true
  return false
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request)
    const { grant_type, client_id, client_secret } = body

    const client = client_id ? await prisma.oAuthClient.findUnique({ where: { clientId: client_id } }) : null
    if (invalidClient(client, client_secret)) {
      return NextResponse.json({ error: 'invalid_client' }, { status: 401 })
    }

    if (grant_type === 'authorization_code') {
      const { code, redirect_uri, code_verifier } = body

      const authCode = code ? await prisma.oAuthAuthorizationCode.findUnique({ where: { code } }) : null

      if (
        !authCode ||
        authCode.used ||
        authCode.expiresAt < new Date() ||
        authCode.clientId !== client_id ||
        authCode.redirectUri !== redirect_uri
      ) {
        return NextResponse.json({ error: 'invalid_grant' }, { status: 400 })
      }

      if (!code_verifier || !verifyPkce(code_verifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
        return NextResponse.json({ error: 'invalid_grant', error_description: 'PKCE inválido' }, { status: 400 })
      }

      await prisma.oAuthAuthorizationCode.update({ where: { code }, data: { used: true } })

      return await issueTokenPair(authCode.clientId, authCode.userId, authCode.scope)
    }

    if (grant_type === 'refresh_token') {
      const { refresh_token } = body

      const stored = refresh_token
        ? await prisma.oAuthRefreshToken.findUnique({ where: { token: refresh_token } })
        : null

      if (!stored || stored.revoked || stored.clientId !== client_id) {
        return NextResponse.json({ error: 'invalid_grant' }, { status: 400 })
      }

      // Rotar: el refresh token usado queda revocado, se emite un par nuevo.
      await prisma.oAuthRefreshToken.update({ where: { token: refresh_token }, data: { revoked: true } })

      return await issueTokenPair(stored.clientId, stored.userId, stored.scope)
    }

    return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 })
  } catch (error) {
    console.error('Error en token endpoint:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
