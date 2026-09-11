import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Historial de un gasto recurrente: cada gasto (Expense) generado o registrado
// manualmente para esta plantilla queda como una línea propia, con el precio
// vigente en ese momento — así se ve la evolución mes a mes de un año entero.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 })
    }

    const plantilla = await prisma.recurringExpense.findUnique({ where: { id } })
    if (!plantilla || plantilla.userId !== userId) {
      return NextResponse.json({ error: 'Gasto recurrente no encontrado' }, { status: 404 })
    }

    const historial = await prisma.expense.findMany({
      where: { recurringExpenseId: id },
      select: {
        id: true,
        fechaGasto: true,
        fechaCarga: true,
        monto: true,
        moneda: true,
        importeTotal: true,
        documento: true,
        documentoNombre: true,
      },
      orderBy: { fechaGasto: 'desc' },
    })

    return NextResponse.json({ success: true, historial })
  } catch (error) {
    console.error('Error al obtener historial de gasto recurrente:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
