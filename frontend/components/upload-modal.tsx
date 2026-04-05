"use client"

import { useState, useCallback } from "react"
import { uploadDocument } from "@/lib/api"
import { toast } from "sonner"
import {
  X,
  Upload,
  File,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react"
import { useDropzone } from "react-dropzone"

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: () => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_FILE_TYPES = { "application/pdf": [".pdf"] }

export default function UploadModal({
  isOpen,
  onClose,
  onUploadComplete,
}: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null)

    if (acceptedFiles.length === 0) return

    const selectedFile = acceptedFiles[0]

    // Validate file type
    if (selectedFile.type !== "application/pdf") {
      setError("Only PDF files are allowed")
      return
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(
        `File size must be 5 MB or less`
      )
      return
    }

    setFile(selectedFile)
  }, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: 1,
    noClick: true,
    disabled: uploading,
  })

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)

    // Simulate progress (since fetch doesn't provide upload progress)
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return prev
        }
        return prev + 10
      })
    }, 200)

    try {
      const promise = uploadDocument(file)

      toast.promise(promise, {
        loading: `Uploading ${file.name}...`,
        success: (doc) => {
          clearInterval(progressInterval)
          setUploadProgress(100)
          setTimeout(() => {
            onUploadComplete()
            onClose()
          }, 500)
          return `${file.name} uploaded successfully`
        },
        error: (err) => {
          clearInterval(progressInterval)
          setUploadProgress(0)
          return `Upload failed: ${err.message}`
        },
      })

      await promise
    } catch (error) {
      clearInterval(progressInterval)
      setUploadProgress(0)
      setError(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    setFile(null)
    setError(null)
    setUploadProgress(0)
    onClose()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="animate-in fade-in zoom-in relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl duration-200">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Upload Document</h2>
          <button
            onClick={handleCancel}
            className="rounded p-1 transition-colors hover:bg-accent"
            disabled={uploading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drop zone */}
        {!file && (
          <div
            {...getRootProps()}
            onClick={open}
            className={`mb-4 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent/50"
            } `}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="mb-1 font-medium">
              {isDragActive
                ? "Drop your PDF here"
                : "Click to select or drag and drop"}
            </p>
            <p className="text-sm text-muted-foreground">
              PDF only (max {MAX_FILE_SIZE / (1024 * 1024)} MB)
            </p>
          </div>
        )}

        {/* Selected file */}
        {file && (
          <div className="mb-4 rounded-lg bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              <File className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>

                {/* Progress bar */}
                {uploading && (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {uploadProgress}% uploaded
                    </p>
                  </div>
                )}
              </div>
              {!uploading && (
                <button
                  onClick={() => setFile(null)}
                  className="rounded p-1 transition-colors hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCancel}
            disabled={uploading}
            className="rounded-lg border border-border px-4 py-2 transition-colors hover:bg-accent disabled:opacity-50"
          >
            Cancel
          </button>
          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
