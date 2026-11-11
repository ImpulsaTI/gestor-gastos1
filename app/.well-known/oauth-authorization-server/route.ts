import { NextRequest, NextResponse } from 'next/server'
import { getBaseUrl } from '@/lib/oauth'

// Metadata del authorization server (RFC 8414), para que claude.ai descubra
// solo los endpoints de /authorize, /token y /register al agregar el conector.
export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request)

  return NextResponse.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/oauth/token`,
    registration_endpoint: `${baseUrl}/api/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    scopes_supported: ['gastos'],
  })
}
