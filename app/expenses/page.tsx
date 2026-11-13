"use client"

import { useState, useEffect } from "react"
import { ExpenseForm } from "@/components/expense-form"
import { ExpenseTable } from "@/components/expense-table"
import type { Expense, Tarjeta, RecurringExpense, Unidad } from "@/lib/types"
import { Receipt, LogOut, CreditCard, Eye, Download, Plus, Trash2, CalendarDays, X, Repeat, Power, Pencil, History, Inbox, Upload, Sparkles, Bot, Copy, Check } from "lucide-react"
import { getCurrentUser, logout } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePdfPreviewUrl } from "@/hooks/use-pdf-preview-url"

type CardSummary = {
  id: string
  periodo: string
  archivo: string
  archivoNombre: string
  archivoTipo: string
  descripcion?: string
  createdAt: string
  tarjeta?: { id: string; ultimos4: string; descripcion?: string }
}

type HistorialItem = {
  id: string
  fechaGasto: string
  fechaCarga: string
  monto: number
  moneda: string
  importeTotal: number
  documento?: string | null
  documentoNombre?: string | null
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null)
  const [showSummariesDialog, setShowSummariesDialog] = useState(false)
  const [cardSummaries, setCardSummaries] = useState<CardSummary[]>([])
  const [selectedSummary, setSelectedSummary] = useState<CardSummary | null>(null)
  // Blob URL para PDFs: los data: URI crudos fallan en varios navegadores dentro de un <iframe>.
  const summaryPdfUrl = usePdfPreviewUrl(
    selectedSummary?.archivoTipo === "application/pdf" ? selectedSummary.archivo : null
  )
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  // Tarjetas
  const [cards, setCards] = useState<Tarjeta[]>([])
  const [showCardsDialog, setShowCardsDialog] = useState(false)
  const [newCardUltimos4, setNewCardUltimos4] = useState("")
  const [newCardDescripcion, setNewCardDescripcion] = useState("")
  const [isAddingCard, setIsAddingCard] = useState(false)

  // Unidades (para asignar a qué unidad se destina un gasto)
  const [unidades, setUnidades] = useState<Unidad[]>([])

  // Filtro de fechas
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // Gastos recurrentes
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [showRecurringDialog, setShowRecurringDialog] = useState(false)
  const [recurringTemplateToEdit, setRecurringTemplateToEdit] = useState<RecurringExpense | null>(null)
  const [historyDialog, setHistoryDialog] = useState<{ motivo: string; items: HistorialItem[] } | null>(null)

  // Gastos pendientes de revisión (cargados por el conector MCP a partir de una factura)
  const [showPendingDialog, setShowPendingDialog] = useState(false)

  // Carga masiva de comprobantes para que la IA los procese después, por chat
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false)
  const [bulkFiles, setBulkFiles] = useState<File[]>([])
  const [isBulkUploading, setIsBulkUploading] = useState(false)

  // Instrucciones para conectar el asistente de IA (MCP) desde claude.ai/ChatGPT
  const [showMcpSetupDialog, setShowMcpSetupDialog] = useState(false)
  const [mcpUrlCopied, setMcpUrlCopied] = useState(false)
  const mcpUrl = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : ""

  const handleCopyMcpUrl = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl)
      setMcpUrlCopied(true)
      setTimeout(() => setMcpUrlCopied(false), 2000)
    } catch {
      // Si el navegador bloquea el clipboard, el usuario puede copiar el texto a mano
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency === "ARS" ? "ARS" : "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const loadUserExpenses = async (userId: string) => {
    try {
      const response = await fetch(`/api/expenses?userId=${userId}`)
      const data = await response.json()
      
      if (data.success) {
        setExpenses(data.expenses)
      } else {
        console.error('Error cargando gastos:', data.error)
      }
    } catch (error) {
      console.error('Error al cargar gastos:', error)
    }
  }

  const loadCards = async (userId: string) => {
    try {
      const response = await fetch(`/api/cards?userId=${userId}`)
      const data = await response.json()
      if (data.success) setCards(data.tarjetas)
    } catch (error) {
      console.error('Error al cargar tarjetas:', error)
    }
  }

  const handleAddCard = async () => {
    if (!user) return
    if (!/^\d{4}$/.test(newCardUltimos4)) {
      alert("Ingresá exactamente 4 dígitos")
      return
    }
    setIsAddingCard(true)
    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          ultimos4: newCardUltimos4,
          descripcion: newCardDescripcion || undefined,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setCards(prev => [...prev, data.tarjeta])
        setNewCardUltimos4("")
        setNewCardDescripcion("")
      } else {
        alert('Error: ' + data.error)
      }
    } catch {
      alert('Error de conexión')
    } finally {
      setIsAddingCard(false)
    }
  }

  const loadUnidades = async (userId: string) => {
    try {
      const response = await fetch(`/api/units?userId=${userId}`)
      const data = await response.json()
      if (data.success) setUnidades(data.unidades)
    } catch (error) {
      console.error('Error al cargar unidades:', error)
    }
  }

  const loadRecurringExpenses = async (userId: string) => {
    try {
      const response = await fetch(`/api/recurring-expenses?userId=${userId}`)
      const data = await response.json()
      if (data.success) setRecurringExpenses(data.recurringExpenses)
    } catch (error) {
      console.error('Error al cargar gastos recurrentes:', error)
    }
  }

  const handleEditRecurring = (recurring: RecurringExpense) => {
    // Precarga el gasto recurrente en "Registrar Gasto" para que el usuario
    // registre un nuevo gasto (con precio/ticket actualizado si cambió algo).
    setRecurringTemplateToEdit(recurring)
    setShowRecurringDialog(false)
  }

  const handleCancelRecurringEdit = () => setRecurringTemplateToEdit(null)

  const handleViewRecurringHistory = async (recurring: RecurringExpense) => {
    if (!user) return
    try {
      const response = await fetch(`/api/recurring-expenses/${recurring.id}/history?userId=${user.id}`)
      const data = await response.json()
      if (data.success) {
        setHistoryDialog({ motivo: recurring.motivo, items: data.historial })
      } else {
        alert('Error: ' + data.error)
      }
    } catch {
      alert('Error de conexión')
    }
  }

  const handleToggleRecurringActive = async (recurring: RecurringExpense) => {
    if (!user) return
    try {
      const response = await fetch('/api/recurring-expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: recurring.id, userId: user.id, activo: !recurring.activo }),
      })
      const data = await response.json()
      if (data.success) {
        setRecurringExpenses(prev => prev.map(r => (r.id === recurring.id ? data.recurringExpense : r)))
      } else {
        alert('Error: ' + data.error)
      }
    } catch {
      alert('Error de conexión')
    }
  }

  const handleDeleteRecurring = async (id: string) => {
    if (!user) return
    if (!confirm("¿Eliminar este gasto recurrente? No se borrarán los gastos ya generados.")) return
    try {
      const response = await fetch(`/api/recurring-expenses?id=${id}&userId=${user.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        setRecurringExpenses(prev => prev.filter(r => r.id !== id))
        setRecurringTemplateToEdit(prev => (prev?.id === id ? null : prev))
      } else {
        alert('Error: ' + data.error)
      }
    } catch {
      alert('Error de conexión')
    }
  }

  const handleDeleteCard = async (tarjetaId: string) => {
    if (!user) return
    if (!confirm("¿Eliminar esta tarjeta?")) return
    try {
      const response = await fetch(`/api/cards?tarjetaId=${tarjetaId}&userId=${user.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        setCards(prev => prev.filter(c => c.id !== tarjetaId))
      } else {
        alert('Error: ' + data.error)
      }
    } catch {
      alert('Error de conexión')
    }
  }

  const handleDiscardPending = async (expenseId: string) => {
    if (!user) return
    if (!confirm("¿Descartar este gasto pendiente? No se va a cargar.")) return
    try {
      const response = await fetch(`/api/expenses?expenseId=${expenseId}&userId=${user.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (data.success) {
        setExpenses(prev => prev.filter(e => e.id !== expenseId))
      } else {
        alert('Error: ' + data.error)
      }
    } catch {
      alert('Error de conexión')
    }
  }

  const handleBulkUpload = async () => {
    if (!user || bulkFiles.length === 0) return
    setIsBulkUploading(true)
    try {
      const comprobantes = await Promise.all(
        bulkFiles.map(
          (file) =>
            new Promise<{ nombre: string; tipo: string; base64: string }>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve({ nombre: file.name, tipo: file.type, base64: reader.result as string })
              reader.onerror = reject
              reader.readAsDataURL(file)
            })
        )
      )

      const response = await fetch('/api/expenses/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, comprobantes }),
      })
      const data = await response.json()

      if (data.success) {
        loadUserExpenses(user.id)
        setBulkFiles([])
        setShowBulkUploadDialog(false)
        alert(
          `Se subieron ${data.expenses.length} comprobante(s). Ahora pedile a Claude (o al asistente que tengas conectado) que procese tus comprobantes pendientes.`
        )
      } else {
        alert('Error: ' + data.error)
      }
    } catch {
      alert('Error al subir los comprobantes')
    } finally {
      setIsBulkUploading(false)
    }
  }

  const createExpense = async (expenseData: Expense) => {
    if (!user) return

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...expenseData,
          userId: user.id,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Recargar la lista de gastos
        loadUserExpenses(user.id)
        // Si era un gasto recurrente (nuevo o edición), refrescar esa lista también
        if (expenseData.esRecurrente || recurringTemplateToEdit) {
          loadRecurringExpenses(user.id)
        }
        setRecurringTemplateToEdit(null)
      } else {
        console.error('Error creando gasto:', data.error)
        alert('Error al guardar el gasto: ' + data.error)
      }
    } catch (error) {
      console.error('Error al crear gasto:', error)
      alert('Error de conexión al guardar el gasto')
    }
  }

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.isAdmin) {
      window.location.href = "/"
      return
    }
    setUser(currentUser)

    loadUserExpenses(currentUser.id)
    loadCards(currentUser.id)
    loadRecurringExpenses(currentUser.id)
    loadUnidades(currentUser.id)
  }, [])

  const handleAddExpense = (expense: Expense) => {
    createExpense(expense)
  }

  const handleEditExpense = async (expenseData: Expense) => {
    if (!user || !editingExpense) return

    try {
      const response = await fetch('/api/expenses', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...expenseData,
          expenseId: editingExpense.id,
          userId: user.id,
        }),
      })

      const data = await response.json()

      if (data.success) {
        loadUserExpenses(user.id)
        setEditingExpense(null)
        alert('Gasto actualizado exitosamente')
      } else {
        console.error('Error actualizando gasto:', data.error)
        alert('Error al actualizar el gasto: ' + data.error)
      }
    } catch (error) {
      console.error('Error al actualizar gasto:', error)
      alert('Error de conexión al actualizar el gasto')
    }
  }

  const handleLogout = () => {
    logout()
    window.location.href = "/"
  }

  const loadCardSummaries = async () => {
    if (!user) return

    try {
      const response = await fetch(`/api/card-summaries?userId=${user.id}`)
      const data = await response.json()

      if (data.success) {
        setCardSummaries(data.cardSummaries)
      } else {
        console.error("Error cargando resúmenes:", data.error)
      }
    } catch (error) {
      console.error("Error al cargar resúmenes:", error)
    }
  }

  const handleOpenSummaries = async () => {
    await loadCardSummaries()
    setShowSummariesDialog(true)
  }

  const formatPeriod = (periodo: string) => {
    const [year, month] = periodo.split("-")
    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]
    return `${monthNames[parseInt(month) - 1]} ${year}`
  }

  if (!user) {
    return null
  }

  const pendingExpenses = expenses.filter((e) => e.pendienteRevision)
  const confirmedExpenses = expenses.filter((e) => !e.pendienteRevision)

  const filteredExpenses = confirmedExpenses.filter((e) => {
    const fecha = e.fechaGasto.split("T")[0]
    if (dateFrom && fecha < dateFrom) return false
    if (dateTo && fecha > dateTo) return false
    return true
  })

  const hasFilter = dateFrom || dateTo

  return (
    <div className="page-container">
      <header className="gradient-header shadow-lg">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Receipt className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">GestorGastos</h1>
                <p className="text-sm text-white/90">
                  {user.nombre} - {user.sector}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCardsDialog(true)}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Mis Tarjetas
                {cards.length > 0 && (
                  <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{cards.length}</span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRecurringDialog(true)}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Repeat className="mr-2 h-4 w-4" />
                Recurrentes
                {recurringExpenses.length > 0 && (
                  <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{recurringExpenses.length}</span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMcpSetupDialog(true)}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Bot className="mr-2 h-4 w-4" />
                Conectar IA
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkUploadDialog(true)}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Subir comprobantes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPendingDialog(true)}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Inbox className="mr-2 h-4 w-4" />
                Pendientes de revisar
                {pendingExpenses.length > 0 && (
                  <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{pendingExpenses.length}</span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenSummaries}
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver Resúmenes
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                <LogOut className="mr-2 h-4 w-4" />
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mx-auto grid max-w-7xl gap-6 sm:gap-8 lg:grid-cols-[400px_1fr] lg:items-start lg:h-[calc(100vh-8rem)]">

          {/* Columna izquierda: formulario con scroll propio */}
          <div className="lg:h-full lg:overflow-y-auto lg:pr-1">
            <ExpenseForm
              key={recurringTemplateToEdit?.id || "new"}
              onSubmit={handleAddExpense}
              cards={cards}
              unidades={unidades}
              recurringTemplate={recurringTemplateToEdit || undefined}
              onCancelRecurring={handleCancelRecurringEdit}
            />
          </div>

          {/* Columna derecha: filtro + tabla con scroll propio */}
          <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
            {/* Filtro de fechas */}
            <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Filtrar por fecha
              </div>
              <div className="flex flex-wrap gap-3 flex-1">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="dateFrom" className="text-xs text-muted-foreground">Desde</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 w-40 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="dateTo" className="text-xs text-muted-foreground">Hasta</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-8 w-40 text-sm"
                  />
                </div>
                {hasFilter && (
                  <div className="flex flex-col justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs text-muted-foreground"
                      onClick={() => { setDateFrom(""); setDateTo("") }}
                    >
                      <X className="h-3 w-3" />
                      Limpiar
                    </Button>
                  </div>
                )}
              </div>
              {hasFilter && (
                <p className="w-full text-xs text-muted-foreground">
                  Mostrando {filteredExpenses.length} de {confirmedExpenses.length} gastos
                </p>
              )}
            </div>

            {/* Tabla con scroll independiente */}
            <div className="lg:overflow-y-auto lg:min-h-0 lg:flex-1">
              <ExpenseTable expenses={filteredExpenses} onEdit={(expense) => setEditingExpense(expense)} />
            </div>
          </div>

        </div>
      </main>

      <Dialog open={!!editingExpense} onOpenChange={() => setEditingExpense(null)}>
        <DialogContent
          className="sm:max-w-3xl max-h-[90vh] overflow-y-auto border shadow-lg"
          style={{
            backgroundColor: '#ffffff',
            backdropFilter: 'none',
            opacity: 1
          }}
        >
          <DialogHeader style={{ backgroundColor: '#ffffff' }}>
            <DialogTitle>Editar Gasto</DialogTitle>
          </DialogHeader>
          <div style={{ backgroundColor: '#ffffff' }}>
            {editingExpense && (
              <ExpenseForm
                onSubmit={handleEditExpense}
                initialData={editingExpense}
                isEditing={true}
                cards={cards}
                unidades={unidades}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSummariesDialog} onOpenChange={setShowSummariesDialog}>
        <DialogContent
          className="sm:max-w-3xl max-h-[80vh] overflow-y-auto border shadow-lg"
          style={{
            backgroundColor: '#ffffff',
            backdropFilter: 'none',
            opacity: 1
          }}
        >
          <DialogHeader style={{ backgroundColor: '#ffffff' }}>
            <DialogTitle>Resúmenes de Tarjeta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4" style={{ backgroundColor: '#ffffff' }}>
            {cardSummaries.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No hay resúmenes de tarjeta disponibles todavía
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cardSummaries.map((summary) => (
                  <Card key={summary.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {formatPeriod(summary.periodo)}
                            {summary.tarjeta && (
                              <span className="ml-2 text-sm font-mono font-normal text-muted-foreground">
                                **** {summary.tarjeta.ultimos4}
                              </span>
                            )}
                          </CardTitle>
                          {summary.descripcion && (
                            <CardDescription className="mt-1">
                              {summary.descripcion}
                            </CardDescription>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setSelectedSummary(summary)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{summary.archivoNombre}</span>
                        <span>
                          Subido: {new Date(summary.createdAt).toLocaleDateString("es-AR")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCardsDialog} onOpenChange={setShowCardsDialog}>
        <DialogContent
          className="sm:max-w-md border shadow-lg"
          style={{ backgroundColor: '#ffffff', backdropFilter: 'none', opacity: 1 }}
        >
          <DialogHeader style={{ backgroundColor: '#ffffff' }}>
            <DialogTitle>Mis Tarjetas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4" style={{ backgroundColor: '#ffffff' }}>
            {/* Lista de tarjetas existentes */}
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No tenés tarjetas agregadas todavía.
              </p>
            ) : (
              <div className="space-y-2">
                {cards.map((card) => (
                  <div key={card.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-mono font-medium">**** {card.ultimos4}</p>
                      {card.descripcion && (
                        <p className="text-xs text-muted-foreground">{card.descripcion}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCard(card.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Formulario para agregar tarjeta */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">Agregar tarjeta</p>
              <div className="space-y-2">
                <Label htmlFor="nuevaUltimos4">Últimos 4 dígitos</Label>
                <Input
                  id="nuevaUltimos4"
                  maxLength={4}
                  placeholder="1234"
                  value={newCardUltimos4}
                  onChange={(e) => setNewCardUltimos4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nuevaDescripcion">Descripción (opcional)</Label>
                <Input
                  id="nuevaDescripcion"
                  placeholder="Ej: Visa corporativa"
                  value={newCardDescripcion}
                  onChange={(e) => setNewCardDescripcion(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleAddCard}
                disabled={isAddingCard || newCardUltimos4.length !== 4}
              >
                <Plus className="mr-2 h-4 w-4" />
                {isAddingCard ? "Agregando..." : "Agregar tarjeta"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMcpSetupDialog} onOpenChange={setShowMcpSetupDialog}>
        <DialogContent
          className="sm:max-w-lg border shadow-lg"
          style={{ backgroundColor: '#ffffff', backdropFilter: 'none', opacity: 1 }}
        >
          <DialogHeader style={{ backgroundColor: '#ffffff' }}>
            <DialogTitle>Conectar un asistente de IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4" style={{ backgroundColor: '#ffffff' }}>
            <p className="text-sm text-muted-foreground">
              Conectá Claude (con cuenta Pro) a GestorGastos para pasarle fotos de facturas por chat
              y que cargue los gastos solo. No necesitás token ni API paga, usa tu plan normal.
            </p>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">1. Pegá este link en claude.ai</Label>
              <div className="flex gap-2">
                <Input value={mcpUrl} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={handleCopyMcpUrl} title="Copiar">
                  {mcpUrlCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                En <a href="https://claude.ai/new?modal=add-custom-connector#customize/connectors" target="_blank" rel="noopener noreferrer" className="text-primary underline">Claude Conectores</a>,
                tocá <strong>Add custom connector</strong>.
              </li>
              <li>Pegá el link de arriba y confirmá.</li>
              <li>Te va a pedir iniciar sesión: usá tu mismo email y contraseña de GestorGastos.</li>
              <li>
                Listo. En cualquier chat nuevo, subí la foto de una factura y pedile "cargá este
                gasto en GestorGastos", o "subí comprobantes" en la app y después "procesá mis
                comprobantes pendientes" si son varios.
              </li>
              <li>
                Los gastos que carga quedan en <strong>"Pendientes de revisar"</strong> hasta que
                vos los confirmes o corrijas.
              </li>
            </ol>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showBulkUploadDialog}
        onOpenChange={(open) => {
          setShowBulkUploadDialog(open)
          if (!open) setBulkFiles([])
        }}
      >
        <DialogContent
          className="sm:max-w-lg border shadow-lg"
          style={{ backgroundColor: '#ffffff', backdropFilter: 'none', opacity: 1 }}
        >
          <DialogHeader style={{ backgroundColor: '#ffffff' }}>
            <DialogTitle>Subir comprobantes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4" style={{ backgroundColor: '#ffffff' }}>
            <p className="text-sm text-muted-foreground">
              Subí de una todas las fotos de facturas que tengas (hasta 30). Después, en el chat con
              tu asistente de IA conectado (ej. Claude), pedile que "procese los comprobantes
              pendientes" — va a leer cada foto y completar el gasto solo. Vos los confirmás después
              en "Pendientes de revisar".
            </p>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors hover:border-primary hover:bg-accent">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {bulkFiles.length > 0 ? `${bulkFiles.length} archivo(s) seleccionado(s)` : "Elegí las fotos o PDFs"}
              </span>
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setBulkFiles(Array.from(e.target.files || []))}
              />
            </label>

            {bulkFiles.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {bulkFiles.map((f, i) => (
                  <li key={i} className="truncate">{f.name}</li>
                ))}
              </ul>
            )}

            <Button
              className="w-full"
              onClick={handleBulkUpload}
              disabled={isBulkUploading || bulkFiles.length === 0}
            >
              {isBulkUploading ? "Subiendo..." : `Subir ${bulkFiles.length || ""} comprobante(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border shadow-lg"
          style={{ backgroundColor: '#ffffff', backdropFilter: 'none', opacity: 1 }}
        >
          <DialogHeader style={{ backgroundColor: '#ffffff' }}>
            <DialogTitle>Pendientes de revisar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4" style={{ backgroundColor: '#ffffff' }}>
            <p className="text-sm text-muted-foreground">
              Gastos cargados por el asistente de IA a partir de una factura. Revisalos, corregí lo
              que haga falta (tarjeta, unidad, etc.) y guardá para confirmarlos — hasta entonces no
              cuentan como gastos reales ni aparecen en la tabla general.
            </p>

            {pendingExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tenés gastos pendientes de revisar.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingExpenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate flex items-center gap-2">
                        {e.motivo}
                        {e.pendienteProcesamientoIA && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                            Esperando que la IA lo procese
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(e.monto, e.moneda)} · {new Date(e.fechaGasto).toLocaleDateString("es-AR", { timeZone: "UTC" })}
                      </p>
                      {e.unidadDestino ? (
                        <p className="text-xs text-emerald-700 truncate">
                          Unidad detectada: {e.unidadDestino.nombre}
                        </p>
                      ) : e.razonSocialDetectada ? (
                        <p className="text-xs text-amber-700 truncate">
                          Razón social detectada: "{e.razonSocialDetectada}" — no coincide con ninguna unidad, elegila a mano
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => {
                          setShowPendingDialog(false)
                          setEditingExpense(e)
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Revisar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDiscardPending(e.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRecurringDialog} onOpenChange={setShowRecurringDialog}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border shadow-lg"
          style={{ backgroundColor: '#ffffff', backdropFilter: 'none', opacity: 1 }}
        >
          <DialogHeader style={{ backgroundColor: '#ffffff' }}>
            <DialogTitle>Gastos Recurrentes</DialogTitle>
          </DialogHeader>
          <div className="space-y-6" style={{ backgroundColor: '#ffffff' }}>
            <p className="text-sm text-muted-foreground">
              Se crean tildando "¿Recurrente?" al registrar un gasto. Se generan solos cada mes,
              y el del período actual se carga de inmediato en tu tabla. Para cambiar el precio o
              subir un ticket nuevo, usá el lápiz: te precarga el gasto en "Registrar Gasto".
            </p>

            {recurringExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No tenés gastos recurrentes configurados todavía. Tildá "¿Recurrente?" al registrar
                un gasto para crear el primero.
              </p>
            ) : (
              <div className="space-y-2">
                {recurringExpenses.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate flex items-center gap-2">
                        {r.motivo}
                        {!r.activo && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Pausado</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(r.monto, r.moneda)} · día {r.diaDelMes} de cada mes
                        {r.tarjeta && <> · **** {r.tarjeta.ultimos4}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Ver historial de precios"
                        onClick={() => handleViewRecurringHistory(r)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Editar (registrar nuevo gasto con datos actualizados)"
                        onClick={() => handleEditRecurring(r)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title={r.activo ? "Pausar" : "Reactivar"}
                        onClick={() => handleToggleRecurringActive(r)}
                      >
                        <Power className={`h-4 w-4 ${r.activo ? "text-primary" : "text-muted-foreground"}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRecurring(r.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyDialog} onOpenChange={() => setHistoryDialog(null)}>
        <DialogContent
          className="sm:max-w-lg max-h-[80vh] overflow-y-auto border shadow-lg"
          style={{ backgroundColor: '#ffffff', backdropFilter: 'none', opacity: 1 }}
        >
          <DialogHeader style={{ backgroundColor: '#ffffff' }}>
            <DialogTitle>Historial — {historyDialog?.motivo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2" style={{ backgroundColor: '#ffffff' }}>
            {historyDialog?.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todavía no hay gastos registrados para este recurrente.
              </p>
            ) : (
              historyDialog?.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(item.fechaGasto).toLocaleDateString("es-AR", { timeZone: "UTC", year: "numeric", month: "long" })}
                    </p>
                    {item.documentoNombre && (
                      <p className="text-xs text-muted-foreground">{item.documentoNombre}</p>
                    )}
                  </div>
                  <p className="font-semibold">
                    {formatCurrency(item.monto, item.moneda)}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSummary} onOpenChange={() => setSelectedSummary(null)}>
        <DialogContent
          className="sm:max-w-4xl max-h-[90vh] overflow-y-auto border shadow-lg"
          style={{
            backgroundColor: '#ffffff',
            backdropFilter: 'none',
            opacity: 1
          }}
        >
          <DialogHeader style={{ backgroundColor: '#ffffff' }}>
            <DialogTitle>
              Resumen - {selectedSummary && formatPeriod(selectedSummary.periodo)}
            </DialogTitle>
          </DialogHeader>
          {selectedSummary && (
            <div className="space-y-4" style={{ backgroundColor: '#ffffff' }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Archivo</p>
                  <p className="font-medium">{selectedSummary.archivoNombre}</p>
                </div>
                <a
                  href={(selectedSummary.archivoTipo === "application/pdf" ? summaryPdfUrl : null) || selectedSummary.archivo}
                  download={selectedSummary.archivoNombre}
                  className="inline-flex"
                >
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                  </Button>
                </a>
              </div>

              {selectedSummary.archivoTipo?.startsWith("image/") ? (
                <div className="rounded-lg border overflow-hidden">
                  <img
                    src={selectedSummary.archivo}
                    alt="Resumen de tarjeta"
                    className="w-full h-auto"
                  />
                </div>
              ) : selectedSummary.archivoTipo === "application/pdf" ? (
                <div className="rounded-lg border overflow-hidden">
                  {summaryPdfUrl ? (
                    <iframe
                      src={summaryPdfUrl}
                      className="w-full h-[600px]"
                      title="Vista previa del resumen"
                    />
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground">Cargando vista previa...</p>
                  )}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No se puede previsualizar este archivo. Descárgalo para verlo.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
