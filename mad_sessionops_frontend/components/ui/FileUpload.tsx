"use client";

import {
  Box,
  Button,
  Typography,
  Avatar,
  IconButton,
  LinearProgress,
  FormHelperText,
} from "@mui/material";
import { CloudUpload, Close, Image as ImageIcon } from "@mui/icons-material";
import { useState, useRef, ChangeEvent } from "react";

/**
 * ============================================
 * FILE UPLOAD COMPONENT
 * ============================================
 *
 * File upload with preview and progress.
 */

export interface FileUploadProps {
  /** File input label */
  label?: string;
  /** Accepted file types */
  accept?: string;
  /** Maximum file size in MB */
  maxSize?: number;
  /** Upload handler */
  onUpload: (file: File) => void | Promise<void>;
  /** Preview the uploaded file */
  preview?: boolean;
  /** Current file URL (for editing) */
  currentFileUrl?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Variant */
  variant?: "button" | "dropzone" | "avatar";
}

export function FileUpload({
  label = "Upload file",
  accept = "image/*",
  maxSize = 5, // 5MB default
  onUpload,
  preview = true,
  currentFileUrl,
  error,
  helperText,
  variant = "button",
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentFileUrl || null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Reset errors
    setLocalError(null);

    // Validate file size
    const fileSizeInMB = selectedFile.size / (1024 * 1024);
    if (fileSizeInMB > maxSize) {
      setLocalError(`File size must be less than ${maxSize}MB`);
      return;
    }

    // Set file and preview
    setFile(selectedFile);

    // Create preview URL if image
    if (preview && selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }

    // Upload
    try {
      setUploading(true);
      setProgress(0);

      // Simulate progress (replace with actual upload progress)
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      await onUpload(selectedFile);

      clearInterval(interval);
      setProgress(100);
      setUploading(false);
    } catch (err: any) {
      setLocalError(err.message || "Upload failed");
      setUploading(false);
      setProgress(0);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setPreviewUrl(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Avatar variant
  if (variant === "avatar") {
    return (
      <Box>
        <Box position="relative" display="inline-block">
          <Avatar
            src={previewUrl || undefined}
            sx={{
              width: 120,
              height: 120,
              cursor: "pointer",
              border: error || localError ? "2px solid" : "none",
              borderColor: "error.main",
            }}
            onClick={handleClick}
          >
            {!previewUrl && <ImageIcon sx={{ fontSize: 48 }} />}
          </Avatar>

          {previewUrl && (
            <IconButton
              size="small"
              onClick={handleRemove}
              sx={{
                position: "absolute",
                top: -8,
                right: -8,
                bgcolor: "background.paper",
                boxShadow: 1,
                "&:hover": {
                  bgcolor: "error.main",
                  color: "white",
                },
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          )}
        </Box>

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {uploading && (
          <Box mt={1}>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}

        {(error || localError || helperText) && (
          <FormHelperText error={!!(error || localError)} sx={{ mt: 1 }}>
            {error || localError || helperText}
          </FormHelperText>
        )}
      </Box>
    );
  }

  // Dropzone variant
  if (variant === "dropzone") {
    return (
      <Box>
        <Box
          onClick={handleClick}
          sx={{
            border: "2px dashed",
            borderColor: error || localError ? "error.main" : "divider",
            borderRadius: 2,
            p: 4,
            textAlign: "center",
            cursor: "pointer",
            bgcolor: "background.paper",
            transition: "all 0.2s",
            "&:hover": {
              borderColor: "primary.main",
              bgcolor: "action.hover",
            },
          }}
        >
          <CloudUpload sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />

          <Typography variant="body1" gutterBottom>
            {label}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            {accept} • Max {maxSize}MB
          </Typography>

          {previewUrl && preview && (
            <Box mt={2}>
              <img
                src={previewUrl}
                alt="Preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: 200,
                  borderRadius: 8,
                }}
              />
            </Box>
          )}
        </Box>

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {uploading && (
          <Box mt={2}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary">
              Uploading... {progress}%
            </Typography>
          </Box>
        )}

        {(error || localError || helperText) && (
          <FormHelperText error={!!(error || localError)} sx={{ mt: 1 }}>
            {error || localError || helperText}
          </FormHelperText>
        )}
      </Box>
    );
  }

  // Button variant (default)
  return (
    <Box>
      <Button
        variant="outlined"
        startIcon={<CloudUpload />}
        onClick={handleClick}
        fullWidth
        sx={{
          borderColor: error || localError ? "error.main" : undefined,
        }}
      >
        {label}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {file && (
        <Box mt={1} display="flex" alignItems="center" gap={1}>
          <Typography variant="caption" sx={{ flex: 1 }}>
            {file.name}
          </Typography>
          <IconButton size="small" onClick={handleRemove}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      )}

      {uploading && (
        <Box mt={1}>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      )}

      {(error || localError || helperText) && (
        <FormHelperText error={!!(error || localError)} sx={{ mt: 1 }}>
          {error || localError || helperText}
        </FormHelperText>
      )}
    </Box>
  );
}

export default FileUpload;
