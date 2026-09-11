import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// La creación de gastos recurrentes ahora se hace desde POST /api/expenses
// (checkbox "¿Recurrente?" en Registrar Gasto). Este endpoint sirve para
// listar, para operaciones puntuales sobre la plantilla (pausar/reactivar,
// reasignar tarjeta) y para borrar.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 })
    }

    const recurringExpenses = await prisma.recurringExpense.findMany({
      where: { userId },
      include: {
        tarjeta: {
          select: { id: true, ultimos4: true, descripcion: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, recurringExpenses })
  } catch (error) {
    console.error('Error al obtener gastos recurrentes:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      userId,
      motivo,
      detalle,
      monto,
      moneda,
      tipoCambio,
      canalPago,
      canalPagoDetalle,
      diaDelMes,
      tarjetaId,
      activo,
      fechaFin,
    } = body

    if (!id || !userId) {
      return NextResponse.json({ error: 'id y userId son requeridos' }, { status: 400 })
    }

    const existing = await prisma.recurringExpense.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Gasto recurrente no encontrado' }, { status: 404 })
    }

    if (moneda && moneda !== 'ARS' && (!tipoCambio || parseFloat(tipoCambio) <= 0)) {
      return NextResponse.json(
        { error: 'Tipo de cambio es obligatorio para monedas diferentes a ARS' },
        { status: 400 }
      )
    }

    const dia = diaDelMes !== undefined ? parseInt(diaDelMes) : undefined
    if (dia !== undefined && (isNaN(dia) || dia < 1 || dia > 28)) {
      return NextResponse.json(
        { error: 'El día del mes debe estar entre 1 y 28' },
        { status: 400 }
      )
    }

    const recurringExpense = await prisma.recurringExpense.update({
      where: { id },
      data: {
        ...(motivo !== undefined && { motivo }),
        ...(detalle !== undefined && { detalle }),
        ...(monto !== undefined && { monto: parseFloat(monto) }),
        ...(moneda !== undefined && { moneda }),
        ...(tipoCambio !== undefined && { tipoCambio: tipoCambio ? parseFloat(tipoCambio) : null }),
        ...(canalPago !== undefined && { canalPago }),
        ...(canalPagoDetalle !== undefined && { canalPagoDetalle: canalPagoDetalle || null }),
        ...(dia !== undefined && { diaDelMes: dia }),
        ...(tarjetaId !== undefined && { tarjetaId: tarjetaId || null }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
        ...(fechaFin !== undefined && { fechaFin: fechaFin ? new Date(fechaFin) : null }),
      },
      include: {
        tarjeta: { select: { id: true, ultimos4: true, descripcion: true } },
      },
    })

    return NextResponse.json({ success: true, recurringExpense })
  } catch (error) {
    console.error('Error al actualizar gasto recurrente:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')

    if (!id || !userId) {
      return NextResponse.json({ error: 'id y userId son requeridos' }, { status: 400 })
    }

    const existing = await prisma.recurringExpense.findUnique({ where: { id } })
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Gasto recurrente no encontrado' }, { status: 404 })
    }

    await prisma.recurringExpense.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al eliminar gasto recurrente:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
