"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { Box, Button, Typography, Container } from "@mui/material";
import { ErrorOutline } from "@mui/icons-material";

/**
 * ============================================
 * ERROR BOUNDARY
 * ============================================
 *
 * Catches React errors and displays fallback UI.
 */

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error
    console.error("Error Boundary caught:", error, errorInfo);

    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Container maxWidth="sm">
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight="100vh"
            textAlign="center"
            gap={3}
          >
            <ErrorOutline sx={{ fontSize: 80, color: "error.main" }} />

            <Typography variant="h4" component="h1">
              Oops! Something went wrong
            </Typography>

            <Typography variant="body1" color="text.secondary">
              We&apos;re sorry for the inconvenience. Please try refreshing the page.
            </Typography>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: "grey.100",
                  borderRadius: 1,
                  textAlign: "left",
                  width: "100%",
                  overflow: "auto",
                }}
              >
                <Typography variant="caption" component="pre">
                  {this.state.error.toString()}
                </Typography>
              </Box>
            )}

            <Box display="flex" gap={2}>
              <Button variant="contained" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>

              <Button variant="outlined" onClick={this.handleReset}>
                Try Again
              </Button>
            </Box>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}
