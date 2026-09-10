import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateExpenseForRecurring } from '@/lib/recurring'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
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
      fechaFin,
    } = body

    if (!userId || !motivo || !detalle || !monto || !moneda || !canalPago || !diaDelMes) {
      return NextResponse.json(
        { error: 'Todos los campos obligatorios deben estar presentes' },
        { status: 400 }
      )
    }

    const dia = parseInt(diaDelMes)
    if (isNaN(dia) || dia < 1 || dia > 28) {
      return NextResponse.json(
        { error: 'El día del mes debe estar entre 1 y 28' },
        { status: 400 }
      )
    }

    if (moneda !== 'ARS' && (!tipoCambio || parseFloat(tipoCambio) <= 0)) {
      return NextResponse.json(
        { error: 'Tipo de cambio es obligatorio para monedas diferentes a ARS' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const recurringExpense = await prisma.recurringExpense.create({
      data: {
        userId,
        motivo,
        detalle,
        monto: parseFloat(monto),
        moneda,
        tipoCambio: tipoCambio ? parseFloat(tipoCambio) : null,
        canalPago,
        canalPagoDetalle: canalPagoDetalle || null,
        diaDelMes: dia,
        tarjetaId: tarjetaId || null,
        fechaFin: fechaFin ? new Date(fechaFin) : null,
      },
      include: {
        tarjeta: { select: { id: true, ultimos4: true, descripcion: true } },
      },
    })

    // Generar de inmediato el gasto del período actual, para que se vea
    // en la tabla general sin tener que esperar al día de cobro configurado.
    const today = new Date()
    const currentPeriod = today.toISOString().slice(0, 7)
    const expense = await generateExpenseForRecurring(recurringExpense, today, currentPeriod)

    return NextResponse.json({
      success: true,
      recurringExpense: { ...recurringExpense, ultimoPeriodoGenerado: currentPeriod },
      expense,
    })
  } catch (error) {
    console.error('Error al crear gasto recurrente:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
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

    // Si ya se generó el gasto del período actual, sincronizar los cambios
    // (ej: si cambió el precio) para que la tabla general quede consistente.
    let syncedExpense = null
    const currentPeriod = new Date().toISOString().slice(0, 7)
    if (recurringExpense.ultimoPeriodoGenerado === currentPeriod) {
      const lastExpense = await prisma.expense.findFirst({
        where: { recurringExpenseId: id },
        orderBy: { fechaGasto: 'desc' },
      })

      if (lastExpense) {
        const newMonto = monto !== undefined ? parseFloat(monto) : lastExpense.monto
        const newMoneda = moneda !== undefined ? moneda : lastExpense.moneda
        const newTipoCambio =
          tipoCambio !== undefined ? (tipoCambio ? parseFloat(tipoCambio) : null) : lastExpense.tipoCambio
        const newMontoEnPesos = newMoneda === 'ARS' ? newMonto : newMonto * (newTipoCambio || 0)

        syncedExpense = await prisma.expense.update({
          where: { id: lastExpense.id },
          data: {
            ...(motivo !== undefined && { motivo }),
            ...(detalle !== undefined && { detalle }),
            monto: newMonto,
            montoEnPesos: newMontoEnPesos,
            importeTotal: newMontoEnPesos,
            moneda: newMoneda,
            tipoCambio: newTipoCambio,
            ...(canalPago !== undefined && { canalPago }),
            ...(canalPagoDetalle !== undefined && { canalPagoDetalle: canalPagoDetalle || null }),
            ...(tarjetaId !== undefined && { tarjetaId: tarjetaId || null }),
          },
        })
      }
    }

    return NextResponse.json({ success: true, recurringExpense, syncedExpense })
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
