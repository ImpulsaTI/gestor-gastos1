"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type RecurringExpense, type Tarjeta, MONEDAS } from "@/lib/types"

interface RecurringExpenseFormProps {
  onSubmit: (data: Omit<RecurringExpense, "id" | "userId" | "activo" | "fechaInicio" | "ultimoPeriodoGenerado">) => void
  cards?: Tarjeta[]
  submitting?: boolean
  initialData?: RecurringExpense
  isEditing?: boolean
  onCancel?: () => void
}

export function RecurringExpenseForm({
  onSubmit,
  cards = [],
  submitting = false,
  initialData,
  isEditing = false,
  onCancel,
}: RecurringExpenseFormProps) {
  const [formData, setFormData] = useState({
    motivo: initialData?.motivo || "",
    detalle: initialData?.detalle || "",
    monto: initialData?.monto?.toString() || "",
    moneda: initialData?.moneda || "ARS",
    tipoCambio: initialData?.tipoCambio?.toString() || "",
    canalPago: (initialData?.canalPago || "") as "" | "web" | "local" | "otro",
    canalPagoDetalle: initialData?.canalPagoDetalle || "",
    diaDelMes: initialData?.diaDelMes?.toString() || "1",
    tarjetaId: initialData?.tarjetaId || "",
  })

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.moneda !== "ARS" && (!formData.tipoCambio || parseFloat(formData.tipoCambio) <= 0)) {
      alert(`Debes ingresar un tipo de cambio válido para ${formData.moneda}`)
      return
    }

    const dia = parseInt(formData.diaDelMes)
    if (isNaN(dia) || dia < 1 || dia > 28) {
      alert("El día del mes debe estar entre 1 y 28")
      return
    }

    onSubmit({
      motivo: formData.motivo,
      detalle: formData.detalle,
      monto: parseFloat(formData.monto),
      moneda: formData.moneda,
      tipoCambio: formData.tipoCambio ? parseFloat(formData.tipoCambio) : undefined,
      canalPago: formData.canalPago as "web" | "local" | "otro",
      canalPagoDetalle: formData.canalPagoDetalle || undefined,
      diaDelMes: dia,
      tarjetaId: formData.tarjetaId || undefined,
    })

    if (!isEditing) {
      setFormData({
        motivo: "",
        detalle: "",
        monto: "",
        moneda: "ARS",
        tipoCambio: "",
        canalPago: "",
        canalPagoDetalle: "",
        diaDelMes: "1",
        tarjetaId: "",
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="recMotivo">Motivo</Label>
        <Input
          id="recMotivo"
          value={formData.motivo}
          onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
          placeholder="Ej: Suscripción Adobe Creative Cloud"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="recDetalle">Detalle</Label>
        <Textarea
          id="recDetalle"
          value={formData.detalle}
          onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
          placeholder="Descripción del gasto recurrente"
          rows={2}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="recMonto">Monto</Label>
          <Input
            id="recMonto"
            type="number"
            step="0.01"
            value={formData.monto}
            onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recMoneda">Moneda</Label>
          <Select
            value={formData.moneda}
            onValueChange={(value) => setFormData({ ...formData, moneda: value, tipoCambio: value === "ARS" ? "" : formData.tipoCambio })}
          >
            <SelectTrigger id="recMoneda">
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

        {formData.moneda !== "ARS" && (
          <div className="space-y-2">
            <Label htmlFor="recTipoCambio">Tipo de Cambio *</Label>
            <Input
              id="recTipoCambio"
              type="number"
              step="0.01"
              value={formData.tipoCambio}
              onChange={(e) => setFormData({ ...formData, tipoCambio: e.target.value })}
              placeholder="Ej: 1500.00"
              required
            />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="recCanalPago">Canal de Pago</Label>
          <Select
            value={formData.canalPago}
            onValueChange={(value) =>
              setFormData({ ...formData, canalPago: value as "web" | "local" | "otro", canalPagoDetalle: "" })
            }
            required
          >
            <SelectTrigger id="recCanalPago">
              <SelectValue placeholder="Seleccionar canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="web">Web</SelectItem>
              <SelectItem value="local">Local/Tienda Física</SelectItem>
              <SelectItem value="otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recDia">Día del mes de cobro</Label>
          <Input
            id="recDia"
            type="number"
            min="1"
            max="28"
            value={formData.diaDelMes}
            onChange={(e) => setFormData({ ...formData, diaDelMes: e.target.value })}
            required
          />
        </div>
      </div>

      {formData.canalPago && (
        <div className="space-y-2">
          <Label htmlFor="recCanalPagoDetalle">{getCanalPagoDetalleConfig().label}</Label>
          <Input
            id="recCanalPagoDetalle"
            value={formData.canalPagoDetalle}
            onChange={(e) => setFormData({ ...formData, canalPagoDetalle: e.target.value })}
            placeholder={getCanalPagoDetalleConfig().placeholder}
            required
          />
        </div>
      )}

      {cards.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="recTarjeta">Tarjeta utilizada</Label>
          <Select value={formData.tarjetaId} onValueChange={(value) => setFormData({ ...formData, tarjetaId: value })}>
            <SelectTrigger id="recTarjeta">
              <SelectValue placeholder="Seleccionar tarjeta (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {cards.map((card) => (
                <SelectItem key={card.id} value={card.id}>
                  **** {card.ultimos4}
                  {card.descripcion ? ` — ${card.descripcion}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? "Guardando..." : isEditing ? "Guardar Cambios" : "Crear Gasto Recurrente"}
        </Button>
        {isEditing && onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
