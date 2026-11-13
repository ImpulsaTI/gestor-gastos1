import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom'); // YYYY-MM-DD
    const dateTo = searchParams.get('dateTo'); // YYYY-MM-DD
    const unidadId = searchParams.get('unidadId'); // unidad de la tarjeta
    const facturadoAId = searchParams.get('facturadoAId'); // unidad destino
    const adminUserId = searchParams.get('adminUserId');

    if (!userId || !adminUserId) {
      return NextResponse.json(
        { error: 'userId y adminUserId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el solicitante sea administrador
    const adminUser = await prisma.user.findUnique({
      where: { id: adminUserId }
    });

    if (!adminUser || !adminUser.isAdmin) {
      return NextResponse.json(
        { error: 'Acceso no autorizado' },
        { status: 403 }
      );
    }

    // Obtener información del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        sector: true,
        tarjetaUltimos4: true,
        createdAt: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Gastos del usuario, respetando exactamente los mismos filtros que tiene
    // puestos el admin en la tabla (fecha, unidad de tarjeta, facturado a).
    // A diferencia de la versión anterior, si no hay gastos con esos filtros
    // el reporte muestra 0 — nunca "cae" a mostrar todos los gastos del usuario.
    const expenses = await prisma.expense.findMany({
      where: {
        userId,
        pendienteRevision: false,
        ...(dateFrom || dateTo
          ? {
              fechaGasto: {
                ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
                ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
        ...(unidadId ? { tarjeta: unidadId === 'none' ? { unidadId: null } : { unidadId } } : {}),
        ...(facturadoAId ? { unidadDestinoId: facturadoAId === 'none' ? null : facturadoAId } : {}),
      },
      orderBy: { fechaGasto: 'desc' },
    });

    const actualPeriod =
      dateFrom || dateTo
        ? `${dateFrom || '...'} a ${dateTo || '...'} (${expenses.length} gastos)`
        : `Todos los períodos (${expenses.length} gastos)`;

    // Calcular estadísticas
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.importeTotal, 0);
    const totalExpenses = expenses.length;
    
    // Gastos por moneda
    const expensesByCurrency = expenses.reduce((acc: any, expense) => {
      if (!acc[expense.moneda]) {
        acc[expense.moneda] = { count: 0, total: 0 };
      }
      acc[expense.moneda].count += 1;
      acc[expense.moneda].total += expense.importeTotal;
      return acc;
    }, {});

    // Gastos por canal
    const expensesByChannel = expenses.reduce((acc: any, expense) => {
      if (!acc[expense.canalPago]) {
        acc[expense.canalPago] = { count: 0, total: 0 };
      }
      acc[expense.canalPago].count += 1;
      acc[expense.canalPago].total += expense.importeTotal;
      return acc;
    }, {});

    // Gastos por día (para gráfico de líneas)
    const expensesByDay = expenses.reduce((acc: any, expense) => {
      const date = new Date(expense.fechaGasto).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { count: 0, total: 0 };
      }
      acc[date].count += 1;
      acc[date].total += expense.importeTotal;
      return acc;
    }, {});

    // Top 5 gastos más altos
    const topExpenses = expenses
      .sort((a, b) => b.importeTotal - a.importeTotal)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        user,
        period: actualPeriod,
        statistics: {
          totalAmount,
          totalExpenses,
          averageExpense: totalExpenses > 0 ? totalAmount / totalExpenses : 0,
          expensesByCurrency,
          expensesByChannel,
          expensesByDay,
          topExpenses
        },
        expenses,
      }
    });

  } catch (error) {
    console.error('Error al generar reporte:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}