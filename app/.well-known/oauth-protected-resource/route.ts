import { NextRequest, NextResponse } from 'next/server'
import { getBaseUrl } from '@/lib/oauth'

// Metadata del recurso protegido (el MCP server), apuntando a nuestro propio
// authorization server. Claude lo lee cuando /api/mcp responde 401.
export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request)

  return NextResponse.json({
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [baseUrl],
  })
}
