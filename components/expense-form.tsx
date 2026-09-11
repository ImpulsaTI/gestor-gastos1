"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Upload, X, Repeat } from "lucide-react"
import { type Expense, type Tarjeta, type Unidad, type RecurringExpense, MONEDAS } from "@/lib/types"
import { getCurrentUser } from "@/lib/auth"

interface ExpenseFormProps {
  onSubmit: (expense: Expense) => void
  initialData?: Expense
  isEditing?: boolean
  cards?: Tarjeta[]
  unidades?: Unidad[]
  recurringTemplate?: RecurringExpense
  onCancelRecurring?: () => void
}

export function ExpenseForm({
  onSubmit,
  initialData,
  isEditing = false,
  cards = [],
  unidades = [],
  recurringTemplate,
  onCancelRecurring,
}: ExpenseFormProps) {
  // Al editar una plantilla recurrente (vía el lápiz en "Recurrentes"), se precarga
  // acá para registrar un nuevo gasto con los datos (posiblemente actualizados).
  const source = initialData || recurringTemplate

  const [formData, setFormData] = useState({
    fechaGasto: initialData?.fechaGasto
      ? new Date(initialData.fechaGasto).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    motivo: source?.motivo || "",
    detalle: source?.detalle || "",
    monto: source?.monto?.toString() || "",
    moneda: source?.moneda || "ARS",
    tipoCambio: source?.tipoCambio?.toString() || "",
    canalPago: (source?.canalPago || "") as "" | "web" | "local" | "otro",
    canalPagoDetalle: source?.canalPagoDetalle || "",
    tieneCuotas: initialData?.tieneCuotas || false,
    cantidadCuotas: initialData?.cantidadCuotas?.toString() || "",
    tarjetaId: source?.tarjetaId || "",
    unidadDestinoId: initialData?.unidadDestinoId || "",
  })

  const [esRecurrente, setEsRecurrente] = useState(!!recurringTemplate)

  const [documento, setDocumento] = useState<{
    file?: File
    url?: string
    nombre: string
    tipo: string
  } | null>(
    initialData?.documento
      ? {
          url: initialData.documento,
          nombre: initialData.documentoNombre || "documento",
          tipo: initialData.documentoTipo || "",
        }
      : null
  )

  const [uploading, setUploading] = useState(false)
  const [montoEnPesos, setMontoEnPesos] = useState<number>(
    initialData?.montoEnPesos || 0
  )

  // Actualizar monto en pesos cuando cambian los valores
  const updateMontoEnPesos = (newFormData: typeof formData) => {
    const monto = parseFloat(newFormData.monto) || 0
    if (newFormData.moneda === 'ARS') {
      setMontoEnPesos(monto)
    } else {
      const tipoCambio = parseFloat(newFormData.tipoCambio) || 0
      setMontoEnPesos(monto * tipoCambio)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Limitar tamaño a 5MB
      if (file.size > 5 * 1024 * 1024) {
        alert("El archivo es demasiado grande. Máximo 5MB.")
        return
      }

      setDocumento({
        file,
        nombre: file.name,
        tipo: file.type,
      })
    }
  }

  const uploadFile = async (file: File, expenseId: string): Promise<string | null> => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser) return null

      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', currentUser.id)
      formData.append('expenseId', expenseId)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      
      if (result.success) {
        return result.url
      } else {
        console.error('Error subiendo archivo:', result.error)
        return null
      }
    } catch (error) {
      console.error('Error al subir archivo:', error)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar tipo de cambio para monedas no ARS
    if (formData.moneda !== 'ARS' && (!formData.tipoCambio || parseFloat(formData.tipoCambio) <= 0)) {
      alert(`Debes ingresar un tipo de cambio válido para ${formData.moneda}`)
      return
    }
    
    setUploading(true)

    try {
      const monto = Number.parseFloat(formData.monto)
      const cantidadCuotas = formData.tieneCuotas ? Number.parseInt(formData.cantidadCuotas) : 1
      
      // Calcular monto en pesos argentinos
      let montoEnPesosArgentinos = monto
      if (formData.moneda !== 'ARS') {
        montoEnPesosArgentinos = monto * parseFloat(formData.tipoCambio)
      }
      
      const importeTotal = montoEnPesosArgentinos * cantidadCuotas
      const expenseId = Date.now().toString()

      let documentoUrl: string | undefined = undefined

      // Subir archivo si existe
      if (documento?.file) {
        const uploaded = await uploadFile(documento.file, expenseId)
        if (!uploaded) {
          alert("Error al subir el archivo. Inténtalo de nuevo.")
          setUploading(false)
          return
        }
        documentoUrl = uploaded
      }

      const expense: Expense = {
        id: expenseId,
        fechaGasto: formData.fechaGasto,
        fechaCarga: new Date().toISOString(),
        motivo: formData.motivo,
        detalle: formData.detalle,
        monto,
        montoEnPesos: montoEnPesosArgentinos,
        importeTotal,
        moneda: formData.moneda,
        tipoCambio: formData.tipoCambio ? Number.parseFloat(formData.tipoCambio) : undefined,
        canalPago: formData.canalPago as "web" | "local" | "otro",
        canalPagoDetalle: formData.canalPagoDetalle || undefined,
        tieneCuotas: formData.tieneCuotas,
        cantidadCuotas: formData.tieneCuotas ? cantidadCuotas : undefined,
        tarjetaId: formData.tarjetaId || undefined,
        unidadDestinoId: formData.unidadDestinoId || undefined,
        documento: documentoUrl,
        documentoNombre: documento?.nombre,
        documentoTipo: documento?.tipo,
        esRecurrente: !isEditing ? esRecurrente : undefined,
        recurringExpenseId: !isEditing ? recurringTemplate?.id : undefined,
      }

      onSubmit(expense)
    } catch (error) {
      console.error('Error al procesar gasto:', error)
      alert("Error al procesar el gasto. Inténtalo de nuevo.")
    } finally {
      setUploading(false)
    }

    // Reset form (no aplica si se estaba editando una plantilla recurrente:
    // el padre desmonta/remonta este form al limpiar recurringTemplate)
    if (!recurringTemplate) {
      setFormData({
        fechaGasto: new Date().toISOString().split("T")[0],
        motivo: "",
        detalle: "",
        monto: "",
        moneda: "ARS",
        tipoCambio: "",
        canalPago: "",
        canalPagoDetalle: "",
        tieneCuotas: false,
        cantidadCuotas: "",
        tarjetaId: "",
        unidadDestinoId: "",
      })
      setEsRecurrente(false)
      setDocumento(null)
    }
  }

  const getCanalPagoDetalleConfig = () => {
    switch (formData.canalPago) {
      case "web":
        return { label: "URL de la Web", placeholder: "https://ejemplo.com" }
      case "local":
        return { label: "Nombre de la Tienda/Local", placeholder: "Nombre del local físico" }
      case "otro":
        return { label: "Comentario", placeholder: "Especificar canal de pago" }
      default:
        return { label: "Detalle", placeholder: "" }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{isEditing ? "Editar Gasto" : "Registrar Gasto"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {recurringTemplate && (
            <div className="flex items-start justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm">
                  Editando gasto recurrente <strong>{recurringTemplate.motivo}</strong>. Se va a
                  registrar un nuevo gasto con estos datos (actualizá el precio o subí el ticket
                  nuevo si cambió algo).
                </p>
              </div>
              {onCancelRecurring && (
                <Button type="button" variant="ghost" size="sm" onClick={onCancelRecurring}>
                  Cancelar
                </Button>
              )}
            </div>
          )}

          {!isEditing && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="esRecurrente">¿Recurrente?</Label>
                <p className="text-sm text-muted-foreground">
                  Se repite todos los meses (ej: suscripción). Se va a agregar a tu lista de
                  recurrentes.
                </p>
              </div>
              <Switch
                id="esRecurrente"
                checked={esRecurrente}
                disabled={!!recurringTemplate}
                onCheckedChange={setEsRecurrente}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fechaGasto">Fecha del Gasto</Label>
              <Input
                id="fechaGasto"
                type="date"
                value={formData.fechaGasto}
                onChange={(e) => setFormData({ ...formData, fechaGasto: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="canalPago">Canal de Pago</Label>
              <Select
                value={formData.canalPago}
                onValueChange={(value) =>
                  setFormData({ ...formData, canalPago: value as "web" | "local" | "otro", canalPagoDetalle: "" })
                }
                required
              >
                <SelectTrigger id="canalPago">
                  <SelectValue placeholder="Seleccionar canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="local">Local/Tienda Física</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.canalPago && (
            <div className="space-y-2">
              <Label htmlFor="canalPagoDetalle">{getCanalPagoDetalleConfig().label}</Label>
              <Input
                id="canalPagoDetalle"
                value={formData.canalPagoDetalle}
                onChange={(e) => setFormData({ ...formData, canalPagoDetalle: e.target.value })}
                placeholder={getCanalPagoDetalleConfig().placeholder}
                type="text"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo del Uso</Label>
            <Input
              id="motivo"
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Ej: Compra de suministros"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="detalle">Detalle</Label>
            <Textarea
              id="detalle"
              value={formData.detalle}
              onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
              placeholder="Descripción detallada del gasto"
              rows={3}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="monto">Monto</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                value={formData.monto}
                onChange={(e) => {
                  const newFormData = { ...formData, monto: e.target.value }
                  setFormData(newFormData)
                  updateMontoEnPesos(newFormData)
                }}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="moneda">Moneda</Label>
              <Select value={formData.moneda} onValueChange={(value) => {
                const newFormData = { ...formData, moneda: value, tipoCambio: value === 'ARS' ? '' : formData.tipoCambio }
                setFormData(newFormData)
                updateMontoEnPesos(newFormData)
              }}>
                <SelectTrigger id="moneda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONEDAS.map((moneda) => (
                    <SelectItem key={moneda} value={moneda}>
                      {moneda}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.moneda !== 'ARS' && (
              <div className="space-y-2">
                <Label htmlFor="tipoCambio">Tipo de Cambio *</Label>
                <Input
                  id="tipoCambio"
                  type="number"
                  step="0.01"
                  value={formData.tipoCambio}
                  onChange={(e) => {
                    const newFormData = { ...formData, tipoCambio: e.target.value }
                    setFormData(newFormData)
                    updateMontoEnPesos(newFormData)
                  }}
                  placeholder="Ej: 1500.00"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Valor de {formData.moneda} en pesos argentinos
                </p>
              </div>
            )}
          </div>

          {/* Mostrar monto calculado en pesos */}
          {formData.moneda !== 'ARS' && formData.monto && formData.tipoCambio && (
            <div className="stat-card-style p-4 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Equivalente en Pesos Argentinos:</p>
                <p className="text-2xl font-bold text-primary">
                  ${montoEnPesos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS
                </p>
                <p className="text-xs text-muted-foreground">
                  {formData.monto} {formData.moneda} × {formData.tipoCambio} = {montoEnPesos.toFixed(2)} ARS
                </p>
              </div>
            </div>
          )}

          {!esRecurrente && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="tieneCuotas">¿Pago en cuotas?</Label>
                <p className="text-sm text-muted-foreground">Especifica si el gasto se pagará en cuotas</p>
              </div>
              <Switch
                id="tieneCuotas"
                checked={formData.tieneCuotas}
                onCheckedChange={(checked) => setFormData({ ...formData, tieneCuotas: checked })}
              />
            </div>
          )}

          {!esRecurrente && formData.tieneCuotas && (
            <div className="space-y-2">
              <Label htmlFor="cantidadCuotas">Cantidad de Cuotas</Label>
              <Input
                id="cantidadCuotas"
                type="number"
                min="2"
                value={formData.cantidadCuotas}
                onChange={(e) => setFormData({ ...formData, cantidadCuotas: e.target.value })}
                placeholder="Ej: 12"
                required={formData.tieneCuotas}
              />
            </div>
          )}

          {cards.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="tarjetaId">Tarjeta utilizada</Label>
              <Select
                value={formData.tarjetaId}
                onValueChange={(value) => setFormData({ ...formData, tarjetaId: value })}
                required
              >
                <SelectTrigger id="tarjetaId">
                  <SelectValue placeholder="Seleccionar tarjeta" />
                </SelectTrigger>
                <SelectContent>
                  {cards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      **** {card.ultimos4}{card.descripcion ? ` — ${card.descripcion}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {unidades.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="unidadDestinoId">Unidad a la que se destina el gasto</Label>
              <Select
                value={formData.unidadDestinoId}
                onValueChange={(value) => setFormData({ ...formData, unidadDestinoId: value })}
              >
                <SelectTrigger id="unidadDestinoId">
                  <SelectValue placeholder="Seleccionar unidad (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((unidad) => (
                    <SelectItem key={unidad.id} value={unidad.id}>
                      {unidad.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Si el gasto es para otra unidad distinta a la de tu tarjeta, indicalo acá.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Documento / Comprobante</Label>
            {documento ? (
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <div className="flex-1 truncate text-sm">{documento.nombre}</div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDocumento(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-6 transition-colors hover:border-primary hover:bg-accent">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Subir archivo (PDF, imagen, etc.)</span>
                <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFileChange} />
              </label>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={uploading}>
            {uploading
              ? "Subiendo archivo..."
              : isEditing
              ? "Actualizar Gasto"
              : recurringTemplate
              ? "Guardar Cambios del Recurrente"
              : esRecurrente
              ? "Registrar Gasto Recurrente"
              : "Registrar Gasto"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
