import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { generateToken, AUTH_CODE_TTL_SECONDS } from '@/lib/oauth'

// Verifica las credenciales del usuario (mismo login que la app) y, si son
// válidas, emite un authorization code para que el cliente MCP (claude.ai)
// lo canjee por un token en /api/oauth/token.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email,
      password,
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method,
      scope,
    } = body

    if (!email || !password || !client_id || !redirect_uri || !code_challenge) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    const client = await prisma.oAuthClient.findUnique({ where: { clientId: client_id } })
    if (!client || !client.redirectUris.includes(redirect_uri)) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Cliente o redirect_uri inválido' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json(
        { error: 'access_denied', error_description: 'Email o contraseña incorrectos' },
        { status: 401 }
      )
    }

    if (!user.isCodeVerified) {
      return NextResponse.json(
        {
          error: 'access_denied',
          error_description: 'Verificá tu cuenta primero ingresando normalmente a GestorGastos',
        },
        { status: 403 }
      )
    }

    const code = generateToken(32)
    await prisma.oAuthAuthorizationCode.create({
      data: {
        code,
        clientId: client.clientId,
        userId: user.id,
        redirectUri: redirect_uri,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method || 'S256',
        scope: scope || null,
        expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
      },
    })

    const redirectUrl = new URL(redirect_uri)
    redirectUrl.searchParams.set('code', code)
    if (state) redirectUrl.searchParams.set('state', state)

    return NextResponse.json({ success: true, redirectTo: redirectUrl.toString() })
  } catch (error) {
    console.error('Error en authorize:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
