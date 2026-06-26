"use client"

import { useState } from "react"
import type { Expense } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileText, Eye, Globe, Store, Info, Pencil } from "lucide-react"

interface ExpenseTableProps {
  expenses: Expense[]
  onEdit?: (expense: Expense) => void
}

export function ExpenseTable({ expenses, onEdit }: ExpenseTableProps) {
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency === "ARS" ? "ARS" : "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "UTC",
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getCanalIcon = (canal: string) => {
    switch (canal) {
      case "web":
        return <Globe className="h-4 w-4" />
      case "local":
        return <Store className="h-4 w-4" />
      case "otro":
        return <Info className="h-4 w-4" />
      default:
        return null
    }
  }

  const totalGeneral = expenses.reduce((acc, expense) => {
    // Si tiene montoEnPesos, usarlo (nuevo sistema)
    if (expense.montoEnPesos && expense.montoEnPesos > 0) {
      return acc + (expense.tieneCuotas ? expense.montoEnPesos * (expense.cantidadCuotas || 1) : expense.montoEnPesos)
    }
    
    // Fallback: calcular en pesos argentinos
    if (expense.moneda === 'ARS') {
      return acc + expense.importeTotal
    } else if (expense.tipoCambio && expense.tipoCambio > 0) {
      // Calcular en pesos usando tipo de cambio
      const montoEnPesos = expense.monto * expense.tipoCambio
      return acc + (expense.tieneCuotas ? montoEnPesos * (expense.cantidadCuotas || 1) : montoEnPesos)
    }
    
    // Si no hay tipo de cambio, incluir como está (no ideal pero funcional)
    return acc + expense.importeTotal
  }, 0)

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">No hay gastos registrados</h3>
        <p className="text-sm text-muted-foreground">Comienza registrando tu primer gasto usando el formulario</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold">Gastos Registrados</h2>
          <div className="text-left sm:text-right">
            <p className="text-sm text-muted-foreground">Total General</p>
            <p className="text-2xl font-bold">{formatCurrency(totalGeneral, "ARS")}</p>
          </div>
        </div>

        <div className="block md:hidden space-y-3">
          {expenses.map((expense) => (
            <div key={expense.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{expense.motivo}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(expense.fechaGasto)}</p>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  {getCanalIcon(expense.canalPago)}
                  <span className="capitalize">{expense.canalPago}</span>
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monto</p>
                  <p className="font-semibold">{formatCurrency(expense.monto, expense.moneda)}</p>
                </div>
                {expense.tieneCuotas && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Cuotas</p>
                    <p className="font-medium">{expense.cantidadCuotas}x</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">Total (ARS)</p>
                  {expense.moneda === 'ARS' ? (
                    <p className="text-lg font-bold">{formatCurrency(expense.importeTotal, 'ARS')}</p>
                  ) : (
                    <div>
                      <p className="text-lg font-bold">
                        {formatCurrency(
                          expense.montoEnPesos && expense.montoEnPesos > 0
                            ? (expense.tieneCuotas ? expense.montoEnPesos * (expense.cantidadCuotas || 1) : expense.montoEnPesos)
                            : expense.tipoCambio
                              ? (expense.tieneCuotas ? expense.monto * expense.tipoCambio * (expense.cantidadCuotas || 1) : expense.monto * expense.tipoCambio)
                              : expense.importeTotal,
                          'ARS'
                        )}
                      </p>
                      {expense.tipoCambio && (
                        <p className="text-xs text-muted-foreground">{expense.moneda} {expense.tipoCambio.toFixed(2)}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedExpense(expense)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  {onEdit && (
                    <Button variant="outline" size="sm" onClick={() => onEdit(expense)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha Gasto</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Cuotas</TableHead>
                <TableHead>Total (ARS)</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{formatDate(expense.fechaGasto)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{expense.motivo}</TableCell>
                  <TableCell>{formatCurrency(expense.monto, expense.moneda)}</TableCell>
                  <TableCell>
                    {expense.tieneCuotas ? (
                      <span className="text-sm font-medium">{expense.cantidadCuotas}x</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {expense.moneda === 'ARS' ? (
                      formatCurrency(expense.importeTotal, 'ARS')
                    ) : (
                      <div className="space-y-1">
                        <div>
                          {formatCurrency(
                            expense.montoEnPesos && expense.montoEnPesos > 0 
                              ? (expense.tieneCuotas ? expense.montoEnPesos * (expense.cantidadCuotas || 1) : expense.montoEnPesos)
                              : expense.tipoCambio 
                                ? (expense.tieneCuotas ? expense.monto * expense.tipoCambio * (expense.cantidadCuotas || 1) : expense.monto * expense.tipoCambio)
                                : expense.importeTotal, 
                            'ARS'
                          )}
                        </div>
                        {expense.tipoCambio && (
                          <div className="text-xs text-muted-foreground">
                            {expense.moneda} {expense.tipoCambio.toFixed(2)}
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      {getCanalIcon(expense.canalPago)}
                      <span className="capitalize">{expense.canalPago}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedExpense(expense)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {onEdit && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(expense)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!selectedExpense} onOpenChange={() => setSelectedExpense(null)}>
        <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-y-auto border-2 shadow-xl" 
          style={{ 
            backgroundColor: '#ffffff',
            backdropFilter: 'none',
            opacity: 1,
            zIndex: 9999
          }}
        >
          <DialogHeader style={{ backgroundColor: '#ffffff' }}>
            <DialogTitle className="text-gray-900">Detalle del Gasto</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4 p-1" style={{ backgroundColor: '#ffffff' }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fecha del Gasto</p>
                  <p className="text-lg">{formatDate(selectedExpense.fechaGasto)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fecha de Carga</p>
                  <p className="text-lg">{formatDateTime(selectedExpense.fechaCarga)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Motivo</p>
                <p className="text-lg">{selectedExpense.motivo}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Detalle</p>
                <p className="text-lg">{selectedExpense.detalle}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Monto</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(selectedExpense.monto, selectedExpense.moneda)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Moneda</p>
                  <p className="text-lg">{selectedExpense.moneda}</p>
                </div>
                {selectedExpense.tipoCambio && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tipo de Cambio</p>
                    <p className="text-lg">{selectedExpense.tipoCambio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Canal de Pago</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="flex items-center gap-1">
                    {getCanalIcon(selectedExpense.canalPago)}
                    <span className="capitalize">{selectedExpense.canalPago}</span>
                  </Badge>
                  {selectedExpense.canalPagoDetalle && (
                    <span className="text-sm">
                      {selectedExpense.canalPago === "web" ? (
                        <a
                          href={selectedExpense.canalPagoDetalle}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {selectedExpense.canalPagoDetalle}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">{selectedExpense.canalPagoDetalle}</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Total en Pesos Argentinos</p>
                <p className="text-2xl font-bold">
                  {selectedExpense.moneda === 'ARS' ? (
                    formatCurrency(selectedExpense.importeTotal, 'ARS')
                  ) : (
                    formatCurrency(selectedExpense.montoEnPesos ? (selectedExpense.tieneCuotas ? selectedExpense.montoEnPesos * (selectedExpense.cantidadCuotas || 1) : selectedExpense.montoEnPesos) : selectedExpense.importeTotal, 'ARS')
                  )}
                </p>
                {selectedExpense.moneda !== 'ARS' && selectedExpense.tipoCambio && (
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(selectedExpense.monto, selectedExpense.moneda)} × {selectedExpense.tipoCambio.toFixed(2)} = {formatCurrency(selectedExpense.montoEnPesos || selectedExpense.monto, 'ARS')}
                  </p>
                )}
              </div>

              {selectedExpense.tieneCuotas && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cuotas</p>
                  <p className="text-lg">
                    {selectedExpense.cantidadCuotas} cuotas de{" "}
                    {formatCurrency(selectedExpense.monto, selectedExpense.moneda)}
                  </p>
                </div>
              )}

              {selectedExpense.documento && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Documento</p>
                  <div className="rounded-lg border p-4">
                    <p className="mb-2 text-sm">{selectedExpense.documentoNombre}</p>
                    {selectedExpense.documentoTipo?.startsWith("image/") ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={selectedExpense.documento || "/placeholder.svg"}
                          alt="Comprobante"
                          className="max-h-64 rounded object-contain border"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "/placeholder.svg";
                            target.alt = "Error cargando imagen";
                          }}
                        />
                        <a
                          href={selectedExpense.documento}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 text-xs text-primary hover:underline"
                        >
                          Ver en tamaño completo
                        </a>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <a
                          href={selectedExpense.documento}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          Ver documento
                        </a>
                        <a
                          href={selectedExpense.documento}
                          download={selectedExpense.documentoNombre}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          Descargar documento
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {onEdit && (
                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={() => {
                    setSelectedExpense(null)
                    onEdit(selectedExpense)
                  }}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar Gasto
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
