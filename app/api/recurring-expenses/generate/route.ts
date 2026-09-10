import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateExpenseForRecurring } from '@/lib/recurring'

// Genera los gastos del mes para cada plantilla recurrente activa cuyo
// "día del mes" ya llegó y que todavía no se generó en el período actual.
// Pensado para ser invocado por un cron (ver vercel.json) una vez al día.
export async function GET(request: NextRequest) {
  return handleGenerate(request)
}

export async function POST(request: NextRequest) {
  return handleGenerate(request)
}

async function handleGenerate(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }

  try {
    const today = new Date()
    const currentDay = today.getUTCDate()
    const currentPeriod = today.toISOString().slice(0, 7) // "YYYY-MM"

    const candidates = await prisma.recurringExpense.findMany({
      where: {
        activo: true,
        diaDelMes: { lte: currentDay },
        fechaInicio: { lte: today },
        OR: [{ fechaFin: null }, { fechaFin: { gte: today } }],
        NOT: { ultimoPeriodoGenerado: currentPeriod },
      },
    })

    const generados: string[] = []

    for (const plantilla of candidates) {
      const fechaGasto = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), plantilla.diaDelMes))
      await generateExpenseForRecurring(plantilla, fechaGasto, currentPeriod)
      generados.push(plantilla.id)
    }

    return NextResponse.json({ success: true, periodo: currentPeriod, generados: generados.length })
  } catch (error) {
    console.error('Error al generar gastos recurrentes:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
