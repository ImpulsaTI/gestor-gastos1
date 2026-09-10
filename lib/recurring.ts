import { prisma } from '@/lib/db'

interface PlantillaRecurrente {
  id: string
  userId: string
  motivo: string
  detalle: string
  monto: number
  moneda: string
  tipoCambio: number | null
  canalPago: string
  canalPagoDetalle: string | null
  tarjetaId: string | null
}

// Crea el gasto correspondiente a una plantilla recurrente para un período dado
// y marca ese período como generado, para no duplicarlo.
export async function generateExpenseForRecurring(
  plantilla: PlantillaRecurrente,
  fechaGasto: Date,
  periodo: string
) {
  const montoEnPesos =
    plantilla.moneda === 'ARS' ? plantilla.monto : plantilla.monto * (plantilla.tipoCambio || 0)

  const [expense] = await prisma.$transaction([
    prisma.expense.create({
      data: {
        userId: plantilla.userId,
        fechaGasto,
        motivo: plantilla.motivo,
        detalle: plantilla.detalle,
        monto: plantilla.monto,
        montoEnPesos,
        importeTotal: montoEnPesos,
        moneda: plantilla.moneda,
        tipoCambio: plantilla.tipoCambio,
        canalPago: plantilla.canalPago,
        canalPagoDetalle: plantilla.canalPagoDetalle,
        tieneCuotas: false,
        tarjetaId: plantilla.tarjetaId,
        recurringExpenseId: plantilla.id,
      },
      include: {
        tarjeta: { select: { id: true, ultimos4: true, descripcion: true } },
        unidadDestino: { select: { id: true, nombre: true } },
      },
    }),
    prisma.recurringExpense.update({
      where: { id: plantilla.id },
      data: { ultimoPeriodoGenerado: periodo },
    }),
  ])

  return expense
}
