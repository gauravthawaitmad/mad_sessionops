"use client";

import { useState } from "react";
import Button from "@mui/material/Button";

export function TestErrorButton() {
  const [shouldThrow, setShouldThrow] = useState(false);

  // Thrown during render (not inside the click handler) so it's a real React
  // render-phase error — caught by app/error.tsx, same path a real bug takes.
  if (shouldThrow) {
    throw new Error("Sentry frontend test error");
  }

  return (
    <Button variant="contained" color="error" onClick={() => setShouldThrow(true)}>
      Trigger test error
    </Button>
  );
}
