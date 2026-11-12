import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getBaseUrl } from '@/lib/oauth'

const SERVER_NAME = 'gestorgastos-mcp'
const SERVER_VERSION = '1.0.0'

function normalizeNombre(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

// Intenta matchear la razón social leída de una factura contra las unidades
// de negocio ya cargadas en GestorGastos. Solo asigna si hay una coincidencia
// clara; si no, no inventa nada (queda para que lo elija un humano).
async function matchUnidadPorRazonSocial(razonSocial: string): Promise<{ id: string; nombre: string } | null> {
  const norm = normalizeNombre(razonSocial)
  if (!norm) return null

  const unidades = await prisma.unidad.findMany({ select: { id: true, nombre: true } })

  const exacta = unidades.find((u) => normalizeNombre(u.nombre) === norm)
  if (exacta) return exacta

  const parciales = unidades.filter((u) => {
    const un = normalizeNombre(u.nombre)
    return un.length > 2 && (norm.includes(un) || un.includes(norm))
  })
  return parciales.length === 1 ? parciales[0] : null
}

const REGISTRAR_GASTO_TOOL = {
  name: 'registrar_gasto',
  description:
    'Registra o completa un gasto a partir de una factura/comprobante. El gasto queda como ' +
    '"pendiente de revisión" en GestorGastos: la persona lo confirma o corrige ahí (tarjeta usada, ' +
    'unidad de negocio, etc.) antes de que cuente como un gasto real. Completá los campos que ' +
    'puedas leer de la factura; lo que no sepas, dejalo sin completar. ' +
    'Si venís de procesar un comprobante ya subido (via listar_comprobantes_sin_procesar / ' +
    'obtener_comprobante), pasá su expenseId acá para completarlo en vez de crear uno nuevo. ' +
    'Fijate también si la factura tiene un campo "Razón Social" del COMPRADOR (no del vendedor que ' +
    'está arriba de todo) y pasalo en razonSocialComprador: el sistema intenta asignar automáticamente ' +
    'la unidad de negocio correspondiente.',
  inputSchema: {
    type: 'object',
    properties: {
      expenseId: {
        type: 'string',
        description:
          'Si este gasto corresponde a un comprobante ya subido y obtenido con obtener_comprobante, ' +
          'su id. Dejar vacío si es un gasto nuevo sin comprobante previo.',
      },
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
        description:
          'Solo para gastos SIN comprobante previo (sin expenseId): contenido del comprobante en base64 ' +
          '(sin el prefijo data:), si está disponible. Normalmente no vas a poder generarlo vos mismo ' +
          '— en ese caso dejalo vacío.',
      },
      documentoNombre: { type: 'string', description: 'Nombre de archivo del comprobante' },
      documentoTipo: {
        type: 'string',
        description: 'Tipo MIME del comprobante, ej. image/jpeg o application/pdf',
      },
      razonSocialComprador: {
        type: 'string',
        description:
          'Razón social del COMPRADOR tal como figura en la factura (ej: "Razón Social: ABELAR ' +
          'SERVICIOS S.R.L"), NO la del vendedor/emisor que suele estar arriba de todo. Si la factura ' +
          'no distingue comprador, dejalo vacío.',
      },
    },
    required: ['motivo', 'monto'],
  },
}

const LISTAR_COMPROBANTES_TOOL = {
  name: 'listar_comprobantes_sin_procesar',
  description:
    'Lista los comprobantes que el usuario subió en lote a GestorGastos y todavía no tienen los ' +
    'datos extraídos (motivo, monto, fecha). Usar esto cuando el usuario pida procesar o cargar ' +
    '"los comprobantes pendientes". Para cada uno, llamar a obtener_comprobante para verlo, y ' +
    'después a registrar_gasto (con el mismo expenseId) para completarlo.',
  inputSchema: { type: 'object', properties: {} },
}

const OBTENER_COMPROBANTE_TOOL = {
  name: 'obtener_comprobante',
  description:
    'Devuelve la imagen de un comprobante subido (por su expenseId, de listar_comprobantes_sin_procesar) ' +
    'para que puedas leerlo y extraer motivo, monto, moneda y fecha. Solo funciona con imágenes; si es ' +
    'un PDF, avisá al usuario que ese no se puede leer automáticamente por ahora.',
  inputSchema: {
    type: 'object',
    properties: {
      expenseId: { type: 'string', description: 'Id del comprobante, obtenido de listar_comprobantes_sin_procesar' },
    },
    required: ['expenseId'],
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

async function handleListarComprobantes(userId: string) {
  const pendientes = await prisma.expense.findMany({
    where: { userId, pendienteProcesamientoIA: true },
    select: { id: true, documentoNombre: true, documentoTipo: true, fechaCarga: true },
    orderBy: { fechaCarga: 'asc' },
  })

  if (pendientes.length === 0) {
    return { content: [{ type: 'text', text: 'No hay comprobantes pendientes de procesar.' }] }
  }

  const lista = pendientes
    .map((p) => `- expenseId: ${p.id} | archivo: ${p.documentoNombre || 'sin nombre'} (${p.documentoTipo || 'desconocido'})`)
    .join('\n')

  return {
    content: [
      {
        type: 'text',
        text: `Hay ${pendientes.length} comprobante(s) pendientes de procesar:\n${lista}\n\nUsá obtener_comprobante con cada expenseId para leerlo, y registrar_gasto (con ese mismo expenseId) para completarlo.`,
      },
    ],
  }
}

async function handleObtenerComprobante(userId: string, args: Record<string, unknown>) {
  const expenseId = typeof args.expenseId === 'string' ? args.expenseId : ''
  if (!expenseId) {
    return { content: [{ type: 'text', text: 'Falta expenseId.' }], isError: true }
  }

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } })
  if (!expense || expense.userId !== userId) {
    return { content: [{ type: 'text', text: 'Comprobante no encontrado.' }], isError: true }
  }

  if (!expense.documento || !expense.documentoTipo) {
    return { content: [{ type: 'text', text: 'Este gasto no tiene un comprobante adjunto.' }], isError: true }
  }

  if (!expense.documentoTipo.startsWith('image/')) {
    return {
      content: [
        {
          type: 'text',
          text: `El comprobante "${expense.documentoNombre}" es de tipo ${expense.documentoTipo}, no se puede leer automáticamente (solo imágenes). Pedile al usuario que te pase los datos a mano, o completalo él directamente en "Pendientes de revisar".`,
        },
      ],
      isError: true,
    }
  }

  const base64 = expense.documento.split(',')[1] || expense.documento

  return {
    content: [
      { type: 'text', text: `Comprobante ${expense.documentoNombre || expenseId} (expenseId: ${expense.id}):` },
      { type: 'image', data: base64, mimeType: expense.documentoTipo },
    ],
  }
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
  const detalle = typeof args.detalle === 'string' && args.detalle ? args.detalle : motivo
  const canalPagoDetalle = typeof args.canalPagoDetalle === 'string' ? args.canalPagoDetalle : null

  const expenseId = typeof args.expenseId === 'string' && args.expenseId ? args.expenseId : null

  const razonSocialComprador =
    typeof args.razonSocialComprador === 'string' ? args.razonSocialComprador.trim() : ''
  let unidadDestinoId: string | null = null
  let razonSocialDetectada: string | null = null
  let unidadDetectadaNombre: string | null = null
  if (razonSocialComprador) {
    const match = await matchUnidadPorRazonSocial(razonSocialComprador)
    if (match) {
      unidadDestinoId = match.id
      unidadDetectadaNombre = match.nombre
    } else {
      razonSocialDetectada = razonSocialComprador
    }
  }

  // Completa un comprobante ya subido en lote (conserva el archivo, llena los datos)
  if (expenseId) {
    const existing = await prisma.expense.findUnique({ where: { id: expenseId } })
    if (!existing || existing.userId !== userId) {
      return { content: [{ type: 'text', text: 'Ese expenseId no existe o no te pertenece.' }], isError: true }
    }

    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        fechaGasto,
        motivo,
        detalle,
        monto,
        montoEnPesos,
        importeTotal: montoEnPesos,
        moneda,
        tipoCambio: tipoCambio ?? null,
        canalPago,
        canalPagoDetalle,
        unidadDestinoId,
        razonSocialDetectada,
        pendienteProcesamientoIA: false,
      },
    })

    const unidadMsg = unidadDetectadaNombre
      ? ` Unidad asignada automáticamente: ${unidadDetectadaNombre}.`
      : razonSocialDetectada
        ? ` Detecté la razón social "${razonSocialDetectada}" pero no coincide con ninguna unidad existente; quedó para elegirla a mano.`
        : ''

    return {
      content: [
        {
          type: 'text',
          text:
            `Comprobante completado: "${expense.motivo}" por ${expense.moneda} ${expense.monto}.${unidadMsg} ` +
            `Sigue pendiente de revisión en la app hasta que lo confirmes.`,
        },
      ],
    }
  }

  // Gasto nuevo, sin comprobante previamente subido
  const documentoBase64 = typeof args.documentoBase64 === 'string' ? args.documentoBase64 : undefined
  const documentoTipo = typeof args.documentoTipo === 'string' ? args.documentoTipo : 'application/octet-stream'
  const documento = documentoBase64 ? `data:${documentoTipo};base64,${documentoBase64}` : undefined

  const expense = await prisma.expense.create({
    data: {
      userId,
      fechaGasto,
      motivo,
      detalle,
      monto,
      montoEnPesos,
      importeTotal: montoEnPesos,
      moneda,
      tipoCambio: tipoCambio ?? null,
      canalPago,
      canalPagoDetalle,
      tieneCuotas: false,
      documento,
      documentoNombre: typeof args.documentoNombre === 'string' ? args.documentoNombre : null,
      documentoTipo: documentoBase64 ? documentoTipo : null,
      unidadDestinoId,
      razonSocialDetectada,
      pendienteRevision: true,
    },
  })

  const unidadMsg = unidadDetectadaNombre
    ? ` Unidad asignada automáticamente: ${unidadDetectadaNombre}.`
    : razonSocialDetectada
      ? ` Detecté la razón social "${razonSocialDetectada}" pero no coincide con ninguna unidad existente; quedó para elegirla a mano.`
      : ''

  return {
    content: [
      {
        type: 'text',
        text:
          `Gasto cargado como pendiente de revisión en GestorGastos: "${expense.motivo}" por ` +
          `${expense.moneda} ${expense.monto}.${unidadMsg} Entrá a la app, sección "Pendientes de revisar", ` +
          `para confirmarlo o corregirlo antes de que cuente como gasto real.`,
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
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: { tools: [REGISTRAR_GASTO_TOOL, LISTAR_COMPROBANTES_TOOL, OBTENER_COMPROBANTE_TOOL] },
      })

    case 'tools/call': {
      const toolName = params?.name
      const args = params?.arguments || {}

      try {
        let result
        if (toolName === 'registrar_gasto') {
          result = await handleRegistrarGasto(userId, args)
        } else if (toolName === 'listar_comprobantes_sin_procesar') {
          result = await handleListarComprobantes(userId)
        } else if (toolName === 'obtener_comprobante') {
          result = await handleObtenerComprobante(userId, args)
        } else {
          result = { content: [{ type: 'text', text: `Herramienta desconocida: ${toolName}` }], isError: true }
        }
        return NextResponse.json({ jsonrpc: '2.0', id, result })
      } catch (error) {
        console.error(`Error en tools/call ${toolName}:`, error)
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: 'Error interno al procesar la solicitud.' }], isError: true },
        })
      }
    }

    default:
      return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }, { status: 404 })
  }
}
