"use client"

import { useEffect, useState } from "react"

/**
 * Convierte un data: URI de PDF en un Blob URL.
 *
 * Embeber un PDF como data: URI en un <iframe> falla en varios navegadores
 * (sobre todo Safari/iOS, y Chrome con archivos grandes): en vez de mostrar
 * el PDF, lo descarga directo o no muestra nada. Un Blob URL es mucho más
 * compatible para este caso.
 */
export function usePdfPreviewUrl(dataUri: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!dataUri) {
      setBlobUrl(null)
      return
    }

    let objectUrl: string | null = null
    try {
      const [header, base64] = dataUri.split(",")
      const mime = header.match(/data:(.*);base64/)?.[1] || "application/pdf"
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: mime })
      objectUrl = URL.createObjectURL(blob)
      setBlobUrl(objectUrl)
    } catch (error) {
      console.error("Error al convertir PDF a Blob URL:", error)
      setBlobUrl(null)
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [dataUri])

  return blobUrl
}
