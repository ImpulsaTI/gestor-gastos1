"use client"

import { useState, useEffect } from "react"
import { getCurrentUser, logout } from "@/lib/auth"
import type { UserExpense, User } from "@/lib/types"
import { Receipt, LogOut, Eye, Printer, Filter, FileText, Download, Upload, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [allExpenses, setAllExpenses] = useState<UserExpense[]>([])
  const [filteredExpenses, setFilteredExpenses] = useState<UserExpense[]>([])
  const [selectedExpense, setSelectedExpense] = useState<UserExpense | null>(null)
  const [filterUser, setFilterUser] = useState<string>("all")
  const [uniqueUsers, setUniqueUsers] = useState<{ id: string; name: string }[]>([])
  const [showUploadSummaryDialog, setShowUploadSummaryDialog] = useState(false)
  const [selectedUserForSummary, setSelectedUserForSummary] = useState<{ id: string; name: string } | null>(null)
  const [summaryPeriod, setSummaryPeriod] = useState("")
  const [summaryFile, setSummaryFile] = useState<File | null>(null)
  const [summaryDescription, setSummaryDescription] = useState("")
  const [isUploadingSummary, setIsUploadingSummary] = useState(false)

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency === "ARS" ? "ARS" : "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const loadAllExpenses = async (adminUserId: string) => {
    try {
      const response = await fetch(`/api/expenses/all?adminUserId=${adminUserId}`)
      const data = await response.json()
      
      if (data.success) {
        setAllExpenses(data.expenses)
        setFilteredExpenses(data.expenses)
        
        // Obtener usuarios únicos
        const users = Array.from(new Map(data.expenses.map((e: UserExpense) => [e.userId, { id: e.userId, name: e.userName }])).values())
        setUniqueUsers(users)
      } else {
        console.error('Error cargando gastos:', data.error)
      }
    } catch (error) {
      console.error('Error al cargar gastos:', error)
    }
  }

  useEffect(() => {
    // Verificar que sea administrador
    const currentUser = getCurrentUser()
    if (!currentUser || !currentUser.isAdmin) {
      window.location.href = "/"
      return
    }
    setUser(currentUser)

    // Cargar todos los gastos desde la base de datos
    loadAllExpenses(currentUser.id)
  }, [])

  useEffect(() => {
    if (filterUser === "all") {
      setFilteredExpenses(allExpenses)
    } else {
      setFilteredExpenses(allExpenses.filter((e) => e.userId === filterUser))
    }
  }, [filterUser, allExpenses])

  const handleLogout = () => {
    logout()
    window.location.href = "/"
  }

  const handlePrint = (expense: UserExpense) => {
    // Primero imprimir el ticket
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket ${expense.id}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .section {
              margin-bottom: 20px;
            }
            .section-title {
              font-weight: bold;
              font-size: 14px;
              color: #666;
              margin-bottom: 5px;
            }
            .section-content {
              font-size: 16px;
              margin-bottom: 15px;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            .divider {
              border-top: 1px solid #ddd;
              margin: 20px 0;
            }
            .document-section {
              margin-top: 30px;
              page-break-before: always;
            }
            img {
              max-width: 100%;
              height: auto;
              border: 1px solid #ddd;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Ticket de Gasto Corporativo</h1>
            <p>ID: ${expense.id}</p>
          </div>

          <div class="section">
            <div class="section-title">INFORMACIÓN DEL USUARIO</div>
            <div class="section-content">
              <strong>Nombre:</strong> ${expense.userName}<br>
              <strong>Email:</strong> ${expense.userEmail}<br>
              <strong>Tarjeta (últimos 4):</strong> ${expense.userTarjeta || "N/A"}
            </div>
          </div>

          <div class="divider"></div>

          <div class="grid">
            <div class="section">
              <div class="section-title">FECHA DEL GASTO</div>
              <div class="section-content">${new Date(expense.fechaGasto).toLocaleDateString("es-AR", { timeZone: "UTC" })}</div>
            </div>
            <div class="section">
              <div class="section-title">FECHA DE CARGA</div>
              <div class="section-content">${new Date(expense.fechaCarga).toLocaleString("es-AR")}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">MOTIVO</div>
            <div class="section-content">${expense.motivo}</div>
          </div>

          <div class="section">
            <div class="section-title">DETALLE</div>
            <div class="section-content">${expense.detalle}</div>
          </div>

          <div class="divider"></div>

          <div class="grid">
            <div class="section">
              <div class="section-title">MONTO</div>
              <div class="section-content">${expense.moneda} ${expense.monto.toFixed(2)}</div>
            </div>
            <div class="section">
              <div class="section-title">IMPORTE TOTAL</div>
              <div class="section-content">${expense.moneda} ${expense.importeTotal.toFixed(2)}</div>
            </div>
          </div>

          ${
            expense.tipoCambio
              ? `
          <div class="section">
            <div class="section-title">TIPO DE CAMBIO</div>
            <div class="section-content">${expense.tipoCambio}</div>
          </div>
          `
              : ""
          }

          <div class="grid">
            <div class="section">
              <div class="section-title">CANAL DE PAGO</div>
              <div class="section-content">${expense.canalPago.toUpperCase()}</div>
            </div>
            ${
              expense.canalPagoDetalle
                ? `
            <div class="section">
              <div class="section-title">DETALLE DEL CANAL</div>
              <div class="section-content">${expense.canalPagoDetalle}</div>
            </div>
            `
                : ""
            }
          </div>

          <div class="section">
            <div class="section-title">CUOTAS</div>
            <div class="section-content">
              ${expense.tieneCuotas ? `Sí - ${expense.cantidadCuotas} cuotas` : "No"}
            </div>
          </div>

          ${
            expense.documento && expense.documentoTipo?.startsWith("image/")
              ? `
          <div class="document-section">
            <div class="section-title">DOCUMENTO ADJUNTO</div>
            <div class="section-content">
              <p><strong>Archivo:</strong> ${expense.documentoNombre || "Sin nombre"}</p>
              <img src="${expense.documento}" alt="Factura" style="max-width: 100%; height: auto; margin-top: 10px;" />
            </div>
          </div>
          `
              : expense.documento && expense.documentoTipo && expense.documentoTipo !== "application/pdf"
              ? `
          <div class="document-section">
            <div class="section-title">DOCUMENTO ADJUNTO</div>
            <div class="section-content">
              <p><strong>Archivo:</strong> ${expense.documentoNombre || "Sin nombre"}</p>
              <p>Tipo: ${expense.documentoTipo || "Desconocido"}</p>
              <p>Ver documento original en el sistema</p>
            </div>
          </div>
          `
              : ""
          }

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()

    // Si hay un PDF adjunto, lanzar ambas impresiones al mismo tiempo
    if (expense.documento && expense.documentoTipo === "application/pdf") {
      console.log('Intentando imprimir PDF:', expense.documento)
      
      // Crear un iframe oculto para cargar y imprimir el PDF
      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.top = '-10000px'
      iframe.style.left = '-10000px'
      iframe.style.width = '1px'
      iframe.style.height = '1px'
      iframe.src = expense.documento
      
      document.body.appendChild(iframe)
      
      // Intentar imprimir cuando el iframe esté cargado
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.print()
            console.log('PDF enviado a imprimir')
          } catch (error) {
            console.log('Error al imprimir PDF via iframe, intentando con ventana nueva:', error)
            // Fallback: abrir en nueva ventana
            const pdfWindow = window.open(expense.documento, '_blank')
            if (pdfWindow) {
              // Múltiples intentos para activar la impresión
              const activatePrint = () => {
                try {
                  pdfWindow.print()
                  console.log('Impresión activada en fallback')
                } catch (e) {
                  console.log('Error en fallback print:', e)
                }
              }
              
              setTimeout(activatePrint, 800)
              setTimeout(activatePrint, 2000)
              setTimeout(() => pdfWindow.close(), 8000)
            }
          }
          // Limpiar el iframe después de 5 segundos
          setTimeout(() => {
            document.body.removeChild(iframe)
          }, 5000)
        }, 1500)
      }
      
      // Timeout de seguridad por si no se carga el iframe
      setTimeout(() => {
        console.log('Timeout del iframe, intentando con ventana nueva')
        const pdfWindow = window.open(expense.documento, '_blank')
        if (pdfWindow) {
          // Múltiples intentos para activar la impresión
          const tryPrint = () => {
            try {
              pdfWindow.print()
              console.log('Impresión activada en ventana del PDF')
            } catch (e) {
              console.log('Error al activar impresión:', e)
            }
          }
          
          // Intentar inmediatamente
          setTimeout(tryPrint, 500)
          // Segundo intento por si el primero falla
          setTimeout(tryPrint, 1500)
          // Tercer intento
          setTimeout(tryPrint, 3000)
          
          // Cerrar ventana después de 10 segundos
          setTimeout(() => {
            try {
              pdfWindow.close()
            } catch (e) {
              console.log('No se pudo cerrar la ventana automáticamente')
            }
          }, 10000)
        }
      }, 1000) // Reducido el timeout para que sea más rápido
    }
  }

  const handleGenerateReport = async (userId: string, userName: string) => {
    if (!user) return;

    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      console.log('Generando reporte para:', userName, 'Mes:', currentMonth);
      
      const response = await fetch(`/api/reports/user?userId=${userId}&month=${currentMonth}&adminUserId=${user.id}`);
      const reportData = await response.json();

      console.log('Datos del reporte:', reportData);

      if (reportData.success) {
        const reportHtml = generateReportHTML(reportData.data, userName);
        
        // Abrir en nueva ventana para previsualizar
        const reportWindow = window.open("", "_blank");
        if (reportWindow) {
          reportWindow.document.write(reportHtml);
          reportWindow.document.close();
        }
      } else {
        alert('Error al generar el reporte: ' + reportData.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al generar el reporte');
    }
  };

  const generateReportHTML = (data: any, userName: string) => {
    const { user: userData, period, statistics, expenses } = data;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte de Gastos - ${userName}</title>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 20px;
              background: #f5f6fa;
              line-height: 1.6;
            }
            .container {
              max-width: 1400px;
              margin: 0 auto;
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 2.2em;
              font-weight: 400;
            }
            .header p {
              margin: 10px 0 0 0;
              opacity: 0.9;
              font-size: 1.1em;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 15px;
              padding: 25px;
              background: #ecf0f1;
            }
            .stat-card {
              background: white;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              border-left: 4px solid #3498db;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .stat-value {
              font-size: 1.8em;
              font-weight: bold;
              color: #2c3e50;
              margin-bottom: 5px;
            }
            .stat-label {
              color: #7f8c8d;
              font-size: 0.85em;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .expenses-section {
              padding: 25px;
            }
            .expenses-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
              font-size: 0.9em;
            }
            .expenses-table th {
              background: #34495e;
              color: white;
              padding: 12px 8px;
              text-align: left;
              font-weight: 600;
              border-bottom: 2px solid #2c3e50;
            }
            .expenses-table td {
              padding: 10px 8px;
              border-bottom: 1px solid #bdc3c7;
              vertical-align: top;
            }
            .expenses-table tr:nth-child(even) {
              background: #f8f9fa;
            }
            .expenses-table tr:hover {
              background: #e8f4fd;
            }
            .currency-badge {
              background: #3498db;
              color: white;
              padding: 3px 6px;
              border-radius: 3px;
              font-size: 0.75em;
              font-weight: bold;
            }
            .channel-badge {
              padding: 3px 8px;
              border-radius: 3px;
              font-size: 0.75em;
              font-weight: bold;
            }
            .channel-web { background: #2ecc71; color: white; }
            .channel-local { background: #f39c12; color: white; }
            .channel-otro { background: #9b59b6; color: white; }
            .cuotas-si { background: #e74c3c; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7em; }
            .cuotas-no { background: #95a5a6; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7em; }
            .user-info {
              background: white;
              padding: 25px;
              border-bottom: 2px solid #ecf0f1;
            }
            .user-info h2 {
              color: #2c3e50;
              margin-bottom: 15px;
              font-size: 1.4em;
            }
            .user-details {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 12px;
            }
            .user-detail {
              padding: 12px;
              background: #f8f9fa;
              border-radius: 6px;
              border-left: 3px solid #3498db;
            }
            .detail-label {
              font-weight: 600;
              color: #7f8c8d;
              margin-bottom: 4px;
              font-size: 0.85em;
            }
            .detail-value {
              color: #2c3e50;
              font-size: 1em;
            }
            .section-title {
              color: #2c3e50;
              margin-bottom: 15px;
              font-size: 1.5em;
              font-weight: 600;
              border-bottom: 2px solid #3498db;
              padding-bottom: 8px;
            }
            .no-expenses {
              text-align: center;
              padding: 40px;
              color: #7f8c8d;
              font-size: 1.2em;
            }
            @media print {
              body { background: white; }
              .container { box-shadow: none; }
              .expenses-table { font-size: 0.8em; }
              .expenses-table th, .expenses-table td { padding: 8px 6px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Reporte de Gastos</h1>
              <p>${userName} - ${period}</p>
              <p>Generado el ${new Date().toLocaleDateString('es-ES')}</p>
            </div>

            <div class="user-info">
              <h2>Información del Usuario</h2>
              <div class="user-details">
                <div class="user-detail">
                  <div class="detail-label">Email</div>
                  <div class="detail-value">${userData.email}</div>
                </div>
                <div class="user-detail">
                  <div class="detail-label">Sector</div>
                  <div class="detail-value">${userData.sector}</div>
                </div>
                <div class="user-detail">
                  <div class="detail-label">Tarjeta</div>
                  <div class="detail-value">****${userData.tarjetaUltimos4}</div>
                </div>
                <div class="user-detail">
                  <div class="detail-label">Miembro desde</div>
                  <div class="detail-value">${new Date(userData.createdAt).toLocaleDateString('es-ES')}</div>
                </div>
              </div>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">$${statistics.totalAmount.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
                <div class="stat-label">Total Gastado</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${statistics.totalExpenses}</div>
                <div class="stat-label">Total Gastos</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">$${statistics.averageExpense.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
                <div class="stat-label">Promedio por Gasto</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${Object.keys(statistics.expensesByCurrency).length}</div>
                <div class="stat-label">Monedas Utilizadas</div>
              </div>
            </div>

            <div class="expenses-section">
              ${statistics.totalExpenses === 0 ? `
                <div class="no-expenses">
                  <h3>No hay gastos registrados</h3>
                  <p>Este usuario no tiene gastos registrados en el período seleccionado.</p>
                </div>
              ` : `
                <h2 class="section-title">Detalle Completo de Gastos (${statistics.totalExpenses} registros)</h2>
                <table class="expenses-table">
                  <thead>
                    <tr>
                      <th style="width: 80px;">Fecha</th>
                      <th style="width: 120px;">Motivo</th>
                      <th style="width: 200px;">Detalle</th>
                      <th style="width: 60px;">Moneda</th>
                      <th style="width: 90px;">Monto</th>
                      <th style="width: 70px;">Canal</th>
                      <th style="width: 150px;">Detalle Canal</th>
                      <th style="width: 80px;">Cuotas</th>
                      <th style="width: 80px;">Cargado</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${expenses.map((expense: any) => `
                      <tr>
                        <td>${new Date(expense.fechaGasto).toLocaleDateString('es-ES', { timeZone: 'UTC' })}</td>
                        <td><strong>${expense.motivo}</strong></td>
                        <td>${expense.detalle}</td>
                        <td><span class="currency-badge">${expense.moneda}</span></td>
                        <td style="text-align: right;"><strong>$${expense.importeTotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong></td>
                        <td><span class="channel-badge channel-${expense.canalPago}">${expense.canalPago.toUpperCase()}</span></td>
                        <td>${expense.canalPagoDetalle || '-'}</td>
                        <td>
                          ${expense.tieneCuotas 
                            ? `<span class="cuotas-si">${expense.cantidadCuotas} cuotas</span>` 
                            : `<span class="cuotas-no">Sin cuotas</span>`
                          }
                        </td>
                        <td>${new Date(expense.fechaCarga).toLocaleDateString('es-ES')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>
          </div>

          <script>
            // Función para descargar como archivo HTML (manual)
            function downloadReport() {
              const htmlContent = document.documentElement.outerHTML;
              const blob = new Blob([htmlContent], { type: 'text/html' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'reporte-gastos-${userName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.html';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            }
            
            // Auto descargar solo cuando se genera desde la aplicación
            if (window.location.protocol !== 'file:' && window.opener) {
              setTimeout(() => {
                downloadReport();
              }, 500);
            }
          </script>
        </body>
      </html>
    `;
  };

  const handleOpenUploadSummary = (selectedUser: { id: string; name: string }) => {
    setSelectedUserForSummary(selectedUser)
    const currentMonth = new Date().toISOString().slice(0, 7)
    setSummaryPeriod(currentMonth)
    setSummaryFile(null)
    setSummaryDescription("")
    setShowUploadSummaryDialog(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSummaryFile(file)
    }
  }

  const handleUploadSummary = async () => {
    if (!user || !selectedUserForSummary || !summaryFile || !summaryPeriod) {
      alert("Por favor complete todos los campos requeridos")
      return
    }

    setIsUploadingSummary(true)

    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string

        const response = await fetch("/api/card-summaries", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: selectedUserForSummary.id,
            periodo: summaryPeriod,
            archivo: base64,
            archivoNombre: summaryFile.name,
            archivoTipo: summaryFile.type,
            descripcion: summaryDescription,
            adminUserId: user.id,
          }),
        })

        const data = await response.json()

        if (data.success) {
          alert(`Resumen subido exitosamente para ${selectedUserForSummary.name}`)
          setShowUploadSummaryDialog(false)
          setSummaryFile(null)
          setSummaryDescription("")
        } else {
          alert("Error al subir el resumen: " + data.error)
        }
      }

      reader.readAsDataURL(summaryFile)
    } catch (error) {
      console.error("Error:", error)
      alert("Error al subir el resumen")
    } finally {
      setIsUploadingSummary(false)
    }
  }

  const totalGeneral = filteredExpenses.reduce((sum, e) => sum + e.importeTotal, 0)

  if (!user) {
    return null
  }

  return (
    <div className="page-container">
      <header className="gradient-header shadow-lg">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Receipt className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">GestorGastos - Admin</h1>
                <p className="text-sm text-white/90">Vista de todos los gastos</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
              <LogOut className="mr-2 h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="stat-card-style">
            <CardHeader className="pb-3">
              <CardDescription className="text-muted-foreground">Total de Tickets</CardDescription>
              <CardTitle className="text-3xl text-primary font-bold">{filteredExpenses.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="stat-card-style">
            <CardHeader className="pb-3">
              <CardDescription className="text-muted-foreground">Usuarios</CardDescription>
              <CardTitle className="text-3xl text-primary font-bold">{uniqueUsers.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="stat-card-style">
            <CardHeader className="pb-3">
              <CardDescription className="text-muted-foreground">Total General</CardDescription>
              <CardTitle className="text-3xl text-primary font-bold">
                ${totalGeneral.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Filtrar por Usuario</CardTitle>
              <Filter className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los usuarios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {uniqueUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Resúmenes de Tarjeta</CardTitle>
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardDescription>Subir resúmenes mensuales de tarjeta para cada usuario</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uniqueUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="font-medium">{u.name}</span>
                  <Button
                    className="button-elegant"
                    size="sm"
                    onClick={() => handleOpenUploadSummary(u)}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Subir Resumen
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Reportes de Usuarios</CardTitle>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uniqueUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="font-medium">{u.name}</span>
                  <Button
                    className="button-elegant"
                    size="sm"
                    onClick={() => handleGenerateReport(u.id, u.name)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Generar Reporte
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Todos los Tickets</CardTitle>
            <CardDescription>
              {filteredExpenses.length} {filteredExpenses.length === 1 ? "ticket" : "tickets"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredExpenses.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No hay tickets registrados todavía</p>
              ) : (
                filteredExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">{expense.motivo}</h3>
                          <p className="text-sm text-muted-foreground">{expense.userName}</p>
                        </div>
                        <Badge variant="secondary">
                          {expense.moneda} {expense.importeTotal.toFixed(2)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Gasto: {new Date(expense.fechaGasto).toLocaleDateString("es-AR", { timeZone: "UTC" })}</span>
                        <span>•</span>
                        <span>Cargado: {new Date(expense.fechaCarga).toLocaleDateString("es-AR")}</span>
                        <span>•</span>
                        <span className="capitalize">{expense.canalPago}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedExpense(expense)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </Button>
                      <Button variant="default" size="sm" onClick={() => handlePrint(expense)}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimir
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!selectedExpense} onOpenChange={() => setSelectedExpense(null)}>
        <DialogContent 
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl border shadow-lg"
          style={{ 
            backgroundColor: '#ffffff',
            backdropFilter: 'none',
            opacity: 1,
            zIndex: 9999
          }}
        >
          <DialogHeader style={{ backgroundColor: '#ffffff' }}>
            <DialogTitle>Detalle del Ticket</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-6" style={{ backgroundColor: '#ffffff' }}>
              <div className="rounded-lg bg-muted p-4">
                <h3 className="mb-2 font-semibold">Información del Usuario</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <strong>Nombre:</strong> {selectedExpense.userName}
                  </p>
                  <p>
                    <strong>Email:</strong> {selectedExpense.userEmail}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fecha del Gasto</p>
                  <p className="text-lg">{new Date(selectedExpense.fechaGasto).toLocaleDateString("es-AR", { timeZone: "UTC" })}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fecha de Carga</p>
                  <p className="text-lg">{new Date(selectedExpense.fechaCarga).toLocaleString("es-AR")}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Motivo</p>
                <p className="text-lg">{selectedExpense.motivo}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Detalle</p>
                <p className="text-base">{selectedExpense.detalle}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Monto</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(selectedExpense.monto, selectedExpense.moneda)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Importe Total</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(selectedExpense.importeTotal, selectedExpense.moneda)}
                  </p>
                </div>
              </div>

              {selectedExpense.tipoCambio && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tipo de Cambio</p>
                  <p className="text-lg">{selectedExpense.tipoCambio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Canal de Pago</p>
                  <p className="text-lg capitalize">{selectedExpense.canalPago}</p>
                </div>
                {selectedExpense.canalPagoDetalle && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Detalle del Canal</p>
                    <p className="text-lg">{selectedExpense.canalPagoDetalle}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Cuotas</p>
                <p className="text-lg">
                  {selectedExpense.tieneCuotas ? `Sí - ${selectedExpense.cantidadCuotas} cuotas` : "No"}
                </p>
              </div>

              {selectedExpense.documento && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Documento Adjunto</p>
                  <p className="mb-2 text-sm">{selectedExpense.documentoNombre}</p>
                  {selectedExpense.documentoTipo?.startsWith("image/") ? (
                    <img
                      src={selectedExpense.documento || "/placeholder.svg"}
                      alt="Factura"
                      className="max-h-96 w-full rounded-lg border object-contain"
                    />
                  ) : selectedExpense.documentoTipo === "application/pdf" ? (
                    <div className="rounded-lg border">
                      <div className="mb-2 flex items-center justify-between bg-gray-50 p-2">
                        <p className="text-sm font-medium">PDF: {selectedExpense.documentoNombre}</p>
                        <a
                          href={selectedExpense.documento}
                          download={selectedExpense.documentoNombre}
                          className="text-xs text-primary underline hover:text-primary/80"
                        >
                          Descargar
                        </a>
                      </div>
                      <iframe
                        src={selectedExpense.documento}
                        className="h-96 w-full border-0"
                        title="Vista previa del PDF"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Documento no disponible para vista previa</p>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => handlePrint(selectedExpense)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir Ticket
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadSummaryDialog} onOpenChange={setShowUploadSummaryDialog}>
        <DialogContent
          className="sm:max-w-md border shadow-lg"
          style={{
            backgroundColor: '#ffffff',
            backdropFilter: 'none',
            opacity: 1
          }}
        >
          <DialogHeader style={{ backgroundColor: '#ffffff' }}>
            <DialogTitle>Subir Resumen de Tarjeta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4" style={{ backgroundColor: '#ffffff' }}>
            <div>
              <Label className="text-sm font-medium">Usuario</Label>
              <p className="text-lg font-semibold">{selectedUserForSummary?.name}</p>
            </div>

            <div>
              <Label htmlFor="periodo">Período (Mes/Año)</Label>
              <Input
                id="periodo"
                type="month"
                value={summaryPeriod}
                onChange={(e) => setSummaryPeriod(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="file">Archivo (PDF o Imagen)</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileChange}
                required
              />
              {summaryFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Archivo seleccionado: {summaryFile.name}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="descripcion">Descripción (opcional)</Label>
              <Input
                id="descripcion"
                placeholder="Ej: Resumen tarjeta corporativa diciembre 2024"
                value={summaryDescription}
                onChange={(e) => setSummaryDescription(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowUploadSummaryDialog(false)}
                disabled={isUploadingSummary}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUploadSummary}
                disabled={isUploadingSummary || !summaryFile || !summaryPeriod}
              >
                {isUploadingSummary ? "Subiendo..." : "Subir Resumen"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
