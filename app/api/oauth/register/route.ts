import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateToken } from '@/lib/oauth'

// Registro dinámico de clientes (RFC 7591). claude.ai lo llama solo la
// primera vez que alguien agrega este conector, para obtener un client_id.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { redirect_uris, client_name, token_endpoint_auth_method } = body

    if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return NextResponse.json(
        { error: 'invalid_client_metadata', error_description: 'redirect_uris es requerido' },
        { status: 400 }
      )
    }

    const clientId = generateToken(16)
    const isPublicClient = token_endpoint_auth_method === 'none'
    const clientSecret = isPublicClient ? null : generateToken(32)

    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret,
        clientName: client_name || 'Cliente MCP',
        redirectUris: redirect_uris,
      },
    })

    return NextResponse.json({
      client_id: client.clientId,
      client_secret: client.clientSecret || undefined,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: isPublicClient ? 'none' : 'client_secret_post',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    })
  } catch (error) {
    console.error('Error al registrar cliente OAuth:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
