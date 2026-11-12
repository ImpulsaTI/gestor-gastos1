import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface ComprobanteInput {
  nombre: string
  tipo: string
  base64: string // data: URI completo
}

// Sube varios comprobantes de una (fotos de facturas) como gastos "stub":
// sin datos todavía, solo el archivo, a la espera de que el conector MCP
// (Claude procesando uno por uno) complete motivo/monto/fecha/etc.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, comprobantes } = body as { userId: string; comprobantes: ComprobanteInput[] }

    if (!userId || !Array.isArray(comprobantes) || comprobantes.length === 0) {
      return NextResponse.json(
        { error: 'userId y comprobantes son requeridos' },
        { status: 400 }
      )
    }

    if (comprobantes.length > 30) {
      return NextResponse.json(
        { error: 'Máximo 30 comprobantes por tanda' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const hoy = new Date()

    const created = await prisma.$transaction(
      comprobantes.map((c) =>
        prisma.expense.create({
          data: {
            userId,
            fechaGasto: hoy,
            motivo: 'Comprobante sin procesar',
            detalle: 'Subido para que la IA extraiga los datos de la factura',
            monto: 0,
            montoEnPesos: 0,
            importeTotal: 0,
            moneda: 'ARS',
            canalPago: 'otro',
            tieneCuotas: false,
            documento: c.base64,
            documentoNombre: c.nombre,
            documentoTipo: c.tipo,
            pendienteRevision: true,
            pendienteProcesamientoIA: true,
          },
        })
      )
    )

    return NextResponse.json({ success: true, expenses: created })
  } catch (error) {
    console.error('Error en carga masiva de comprobantes:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
