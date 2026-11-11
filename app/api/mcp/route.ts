import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getBaseUrl } from '@/lib/oauth'

const SERVER_NAME = 'gestorgastos-mcp'
const SERVER_VERSION = '1.0.0'

const REGISTRAR_GASTO_TOOL = {
  name: 'registrar_gasto',
  description:
    'Registra un gasto a partir de una factura/comprobante que el usuario compartió en el chat. ' +
    'El gasto queda como "pendiente de revisión" en GestorGastos: la persona lo confirma o corrige ' +
    'ahí (tarjeta usada, unidad de negocio, etc.) antes de que cuente como un gasto real. ' +
    'Completá los campos que puedas leer de la factura; lo que no sepas, dejalo sin completar.',
  inputSchema: {
    type: 'object',
    properties: {
      motivo: {
        type: 'string',
        description: 'Motivo breve del gasto (ej: nombre del proveedor o servicio facturado)',
      },
      detalle: {
        type: 'string',
        description: 'Detalle del gasto. Si no hay uno mejor, repetir el motivo.',
      },
      monto: {
        type: 'number',
        description: 'Monto del gasto tal como figura en la factura, sin símbolo de moneda',
      },
      moneda: {
        type: 'string',
        description: 'Moneda en formato ISO (ARS, USD, EUR, BRL, CLP). Si no está clara, usar ARS.',
      },
      tipoCambio: {
        type: 'number',
        description: 'Tipo de cambio a pesos argentinos, solo si la moneda no es ARS y figura en la factura',
      },
      fechaGasto: {
        type: 'string',
        description: 'Fecha del gasto en formato YYYY-MM-DD. Si no figura en la factura, usar la fecha de hoy.',
      },
      canalPago: {
        type: 'string',
        enum: ['web', 'local', 'otro'],
        description: 'Canal de pago. Si no es claro a partir de la factura, usar "otro".',
      },
      canalPagoDetalle: {
        type: 'string',
        description: 'URL si el canal es web, nombre del local si es local, o un comentario si es otro',
      },
      documentoBase64: {
        type: 'string',
        description: 'Contenido del comprobante codificado en base64 (sin el prefijo data:), si está disponible',
      },
      documentoNombre: {
        type: 'string',
        description: 'Nombre de archivo del comprobante',
      },
      documentoTipo: {
        type: 'string',
        description: 'Tipo MIME del comprobante, ej. image/jpeg o application/pdf',
      },
    },
    required: ['motivo', 'monto'],
  },
}

async function authenticate(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  const token = await prisma.oAuthAccessToken.findUnique({ where: { token: match[1] } })
  if (!token || token.expiresAt < new Date()) return null

  return token.userId
}

function unauthorized(request: NextRequest) {
  const baseUrl = getBaseUrl(request)
  return NextResponse.json(
    { error: 'unauthorized' },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
      },
    }
  )
}

async function handleRegistrarGasto(userId: string, args: Record<string, unknown>) {
  const motivo = typeof args.motivo === 'string' ? args.motivo.trim() : ''
  const monto = typeof args.monto === 'number' ? args.monto : parseFloat(String(args.monto))

  if (!motivo || !monto || Number.isNaN(monto)) {
    return { content: [{ type: 'text', text: 'Faltan motivo y/o monto, son obligatorios.' }], isError: true }
  }

  const moneda = typeof args.moneda === 'string' && args.moneda.trim() ? args.moneda.trim().toUpperCase() : 'ARS'
  const tipoCambio = typeof args.tipoCambio === 'number' ? args.tipoCambio : undefined
  const montoEnPesos = moneda === 'ARS' ? monto : tipoCambio ? monto * tipoCambio : monto

  const fechaGastoStr = typeof args.fechaGasto === 'string' && args.fechaGasto ? args.fechaGasto : undefined
  const fechaGasto = fechaGastoStr ? new Date(fechaGastoStr) : new Date()

  const canalPago = ['web', 'local', 'otro'].includes(String(args.canalPago)) ? (args.canalPago as string) : 'otro'

  const documentoBase64 = typeof args.documentoBase64 === 'string' ? args.documentoBase64 : undefined
  const documentoTipo = typeof args.documentoTipo === 'string' ? args.documentoTipo : 'application/octet-stream'
  const documento = documentoBase64 ? `data:${documentoTipo};base64,${documentoBase64}` : undefined

  const expense = await prisma.expense.create({
    data: {
      userId,
      fechaGasto,
      motivo,
      detalle: typeof args.detalle === 'string' && args.detalle ? args.detalle : motivo,
      monto,
      montoEnPesos,
      importeTotal: montoEnPesos,
      moneda,
      tipoCambio: tipoCambio ?? null,
      canalPago,
      canalPagoDetalle: typeof args.canalPagoDetalle === 'string' ? args.canalPagoDetalle : null,
      tieneCuotas: false,
      documento,
      documentoNombre: typeof args.documentoNombre === 'string' ? args.documentoNombre : null,
      documentoTipo: documentoBase64 ? documentoTipo : null,
      pendienteRevision: true,
    },
  })

  return {
    content: [
      {
        type: 'text',
        text:
          `Gasto cargado como pendiente de revisión en GestorGastos: "${expense.motivo}" por ` +
          `${expense.moneda} ${expense.monto}. Entrá a la app, sección "Pendientes de revisar", para ` +
          `confirmarlo o corregirlo antes de que cuente como gasto real.`,
      },
    ],
  }
}

export async function GET() {
  // Sin soporte de stream server-initiated (SSE); el cliente debe usar POST.
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 })
}

export async function POST(request: NextRequest) {
  const userId = await authenticate(request)
  if (!userId) return unauthorized(request)

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 })
  }

  const { id, method, params } = body

  // Notificación JSON-RPC (sin id): no lleva respuesta.
  if (id === undefined) {
    return new NextResponse(null, { status: 202 })
  }

  switch (method) {
    case 'initialize':
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: params?.protocolVersion || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        },
      })

    case 'ping':
      return NextResponse.json({ jsonrpc: '2.0', id, result: {} })

    case 'tools/list':
      return NextResponse.json({ jsonrpc: '2.0', id, result: { tools: [REGISTRAR_GASTO_TOOL] } })

    case 'tools/call': {
      const toolName = params?.name
      const args = params?.arguments || {}

      if (toolName !== 'registrar_gasto') {
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: `Herramienta desconocida: ${toolName}` }], isError: true },
        })
      }

      try {
        const result = await handleRegistrarGasto(userId, args)
        return NextResponse.json({ jsonrpc: '2.0', id, result })
      } catch (error) {
        console.error('Error en tools/call registrar_gasto:', error)
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: 'Error interno al registrar el gasto.' }], isError: true },
        })
      }
    }

    default:
      return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }, { status: 404 })
  }
}
