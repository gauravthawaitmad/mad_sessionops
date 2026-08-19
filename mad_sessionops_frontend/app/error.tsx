"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Box, Button, Container, Typography } from "@mui/material";
import { ErrorOutline } from "@mui/icons-material";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

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
          We&apos;re sorry for the inconvenience. Please try again.
        </Typography>

        <Button variant="contained" onClick={() => reset()}>
          Try Again
        </Button>
      </Box>
    </Container>
  );
}
