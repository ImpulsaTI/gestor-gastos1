import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { issueAuthorizationCode } from '@/lib/oauth'

// Igual que /api/oauth/authorize, pero para usuarios que ya iniciaron sesión
// con Microsoft (NextAuth): no pide contraseña, usa la sesión activa.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'access_denied', error_description: 'Sin sesión de Microsoft activa' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method, scope } = body

    if (!client_id || !redirect_uri || !code_challenge) {
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

    const email = session.user.email
    const nombreMicrosoft = session.user.name || email.split('@')[0]

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          nombre: nombreMicrosoft,
          sector: '',
          tarjetaUltimos4: '0000',
          isAdmin: false,
          isCodeVerified: true,
        },
      })
    } else if (!user.isCodeVerified) {
      user = await prisma.user.update({ where: { id: user.id }, data: { isCodeVerified: true } })
    }

    const redirectTo = await issueAuthorizationCode({
      userId: user.id,
      clientId: client.clientId,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      scope,
      state,
    })

    return NextResponse.json({ success: true, redirectTo })
  } catch (error) {
    console.error('Error en authorize-microsoft:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
