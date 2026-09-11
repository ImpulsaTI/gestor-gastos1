import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId es requerido' },
        { status: 400 }
      );
    }

    const expenses = await prisma.expense.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nombre: true,
          }
        },
        tarjeta: {
          select: {
            id: true,
            ultimos4: true,
            descripcion: true,
          }
        },
        unidadDestino: {
          select: {
            id: true,
            nombre: true,
          }
        }
      },
      orderBy: { fechaGasto: 'desc' }
    });

    return NextResponse.json({
      success: true,
      expenses
    });

  } catch (error) {
    console.error('Error al obtener gastos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== INICIO POST /api/expenses ===');
    const body = await request.json();
    console.log('Body recibido:', JSON.stringify(body, null, 2));
    const {
      userId,
      fechaGasto,
      motivo,
      detalle,
      monto,
      montoEnPesos,
      importeTotal,
      moneda,
      tipoCambio,
      canalPago,
      canalPagoDetalle,
      tieneCuotas,
      cantidadCuotas,
      documento,
      documentoNombre,
      documentoTipo,
      tarjetaId,
      unidadDestinoId,
      esRecurrente,
      recurringExpenseId,
    } = body;

    // Validaciones básicas
    if (!userId || !fechaGasto || !motivo || !detalle || !monto || !importeTotal || !moneda || !canalPago) {
      return NextResponse.json(
        { error: 'Todos los campos obligatorios deben estar presentes' },
        { status: 400 }
      );
    }

    // Calcular montoEnPesos si no viene o validar tipo de cambio
    let calculatedMontoEnPesos = montoEnPesos;
    if (moneda !== 'ARS') {
      if (!tipoCambio || parseFloat(tipoCambio) <= 0) {
        return NextResponse.json(
          { error: 'Tipo de cambio es obligatorio para monedas diferentes a ARS' },
          { status: 400 }
        );
      }
      calculatedMontoEnPesos = parseFloat(monto) * parseFloat(tipoCambio);
    } else {
      calculatedMontoEnPesos = parseFloat(monto);
    }

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Si el gasto es recurrente, crear o actualizar su plantilla (RecurringExpense).
    // Cada gasto que se registra así queda como una nueva línea en el historial
    // de ese recurrente (no se sobreescribe nada), pero la plantilla guarda los
    // valores vigentes (motivo/precio/etc.) para que el cron use lo más reciente.
    let finalRecurringExpenseId: string | null = recurringExpenseId || null;

    if (esRecurrente) {
      const fecha = new Date(fechaGasto);
      const diaDelMes = Math.min(fecha.getUTCDate(), 28);
      const periodo = fecha.toISOString().slice(0, 7);

      const plantillaData = {
        motivo,
        detalle,
        monto: parseFloat(monto),
        moneda,
        tipoCambio: tipoCambio ? parseFloat(tipoCambio) : null,
        canalPago,
        canalPagoDetalle: canalPagoDetalle || null,
        diaDelMes,
        tarjetaId: tarjetaId || null,
        ultimoPeriodoGenerado: periodo,
      };

      if (finalRecurringExpenseId) {
        const plantilla = await prisma.recurringExpense.update({
          where: { id: finalRecurringExpenseId },
          data: plantillaData,
        });
        finalRecurringExpenseId = plantilla.id;
      } else {
        const plantilla = await prisma.recurringExpense.create({
          data: { ...plantillaData, userId },
        });
        finalRecurringExpenseId = plantilla.id;
      }
    }

    // Usar SQL crudo para insertar con montoEnPesos mientras se resuelve Prisma generate
    const expenseData = {
      id: Date.now().toString(),
      userId,
      fechaGasto: new Date(fechaGasto),
      motivo,
      detalle,
      monto: parseFloat(monto),
      montoEnPesos: parseFloat(calculatedMontoEnPesos),
      importeTotal: parseFloat(importeTotal),
      moneda,
      tipoCambio: tipoCambio ? parseFloat(tipoCambio) : null,
      canalPago,
      canalPagoDetalle,
      tieneCuotas: Boolean(tieneCuotas),
      cantidadCuotas: cantidadCuotas ? parseInt(cantidadCuotas) : null,
      tarjetaId: tarjetaId || null,
      unidadDestinoId: unidadDestinoId || null,
      recurringExpenseId: finalRecurringExpenseId,
      documento,
      documentoNombre,
      documentoTipo,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const expense = await prisma.$queryRaw`
      INSERT INTO expenses (
        id, "userId", "fechaGasto", motivo, detalle, monto, "montoEnPesos",
        "importeTotal", moneda, "tipoCambio", "canalPago", "canalPagoDetalle",
        "tieneCuotas", "cantidadCuotas", "tarjetaId", "unidadDestinoId", "recurringExpenseId",
        documento, "documentoNombre",
        "documentoTipo", "createdAt", "updatedAt"
      ) VALUES (
        ${expenseData.id}, ${expenseData.userId}, ${expenseData.fechaGasto},
        ${expenseData.motivo}, ${expenseData.detalle}, ${expenseData.monto},
        ${expenseData.montoEnPesos}, ${expenseData.importeTotal}, ${expenseData.moneda},
        ${expenseData.tipoCambio}, ${expenseData.canalPago}, ${expenseData.canalPagoDetalle},
        ${expenseData.tieneCuotas}, ${expenseData.cantidadCuotas}, ${expenseData.tarjetaId},
        ${expenseData.unidadDestinoId}, ${expenseData.recurringExpenseId},
        ${expenseData.documento}, ${expenseData.documentoNombre}, ${expenseData.documentoTipo},
        ${expenseData.createdAt}, ${expenseData.updatedAt}
      ) RETURNING *;
    `;

    console.log('Expense creado con SQL crudo:', expense);

    return NextResponse.json({
      success: true,
      expense: expenseData // Devolvemos los datos que insertamos
    });

  } catch (error) {
    console.error('=== ERROR COMPLETO al crear gasto ===');
    console.error('Tipo de error:', typeof error);
    console.error('Error object:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    console.error('=== FIN ERROR ===');
    
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      expenseId,
      userId,
      fechaGasto,
      motivo,
      detalle,
      monto,
      montoEnPesos,
      importeTotal,
      moneda,
      tipoCambio,
      canalPago,
      canalPagoDetalle,
      tieneCuotas,
      cantidadCuotas,
      documento,
      documentoNombre,
      documentoTipo,
      tarjetaId,
      unidadDestinoId,
    } = body;

    // Validaciones básicas
    if (!expenseId || !userId || !fechaGasto || !motivo || !detalle || !monto || !importeTotal || !moneda || !canalPago) {
      return NextResponse.json(
        { success: false, error: 'Todos los campos obligatorios deben estar presentes' },
        { status: 400 }
      );
    }

    // Verificar que el gasto existe y pertenece al usuario
    const existingExpense = await prisma.expense.findUnique({
      where: { id: expenseId }
    });

    if (!existingExpense) {
      return NextResponse.json(
        { success: false, error: 'Gasto no encontrado' },
        { status: 404 }
      );
    }

    if (existingExpense.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar este gasto' },
        { status: 403 }
      );
    }

    // Calcular montoEnPesos si es necesario
    let calculatedMontoEnPesos = montoEnPesos;
    if (moneda !== 'ARS') {
      if (!tipoCambio || parseFloat(tipoCambio) <= 0) {
        return NextResponse.json(
          { success: false, error: 'Tipo de cambio es obligatorio para monedas diferentes a ARS' },
          { status: 400 }
        );
      }
      calculatedMontoEnPesos = parseFloat(monto) * parseFloat(tipoCambio);
    } else {
      calculatedMontoEnPesos = parseFloat(monto);
    }

    // Actualizar usando SQL crudo
    const updatedExpense = await prisma.$queryRaw`
      UPDATE expenses SET
        "fechaGasto" = ${new Date(fechaGasto)},
        motivo = ${motivo},
        detalle = ${detalle},
        monto = ${parseFloat(monto)},
        "montoEnPesos" = ${parseFloat(calculatedMontoEnPesos)},
        "importeTotal" = ${parseFloat(importeTotal)},
        moneda = ${moneda},
        "tipoCambio" = ${tipoCambio ? parseFloat(tipoCambio) : null},
        "canalPago" = ${canalPago},
        "canalPagoDetalle" = ${canalPagoDetalle},
        "tieneCuotas" = ${Boolean(tieneCuotas)},
        "cantidadCuotas" = ${cantidadCuotas ? parseInt(cantidadCuotas) : null},
        "tarjetaId" = ${tarjetaId || null},
        "unidadDestinoId" = ${unidadDestinoId || null},
        documento = ${documento},
        "documentoNombre" = ${documentoNombre},
        "documentoTipo" = ${documentoTipo},
        "updatedAt" = ${new Date()}
      WHERE id = ${expenseId}
      RETURNING *;
    `;

    return NextResponse.json({
      success: true,
      expense: updatedExpense
    });

  } catch (error) {
    console.error('Error al actualizar gasto:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}