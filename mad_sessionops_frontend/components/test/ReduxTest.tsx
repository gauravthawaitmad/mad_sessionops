"use client";

import { useAppSelector, useAppDispatch } from "@/lib/redux";
import {
  toggleTheme,
  toggleSidebar,
  openModal,
  closeModal,
  setGlobalLoading,
  toggleNotifications,
  selectTheme,
  selectSidebarOpen,
  selectActiveModal,
  selectGlobalLoading,
  selectShowNotifications,
} from "@/lib/redux/features/ui/uiSlice";
import { Container, Typography, Box, Stack, Paper } from "@mui/material";
import { Button, Card, Alert, Badge } from "@/components/ui";
import { LoadingOverlay } from "@/components/loading";

export default function ReduxTest() {
  // Read state from Redux
  const theme = useAppSelector(selectTheme);
  const sidebarOpen = useAppSelector(selectSidebarOpen);
  const activeModal = useAppSelector(selectActiveModal);
  const globalLoading = useAppSelector(selectGlobalLoading);
  const showNotifications = useAppSelector(selectShowNotifications);

  // Get dispatch function
  const dispatch = useAppDispatch();

  // Simulate loading
  const handleSimulateLoading = () => {
    dispatch(setGlobalLoading(true));
    setTimeout(() => dispatch(setGlobalLoading(false)), 2000);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h3" fontWeight="bold" gutterBottom>
          Redux State Management Test
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Testing UI slice with theme, sidebar, modals, and loading states
        </Typography>
      </Box>

      {/* Current State Display */}
      <Alert severity="info" title="Current Redux State" sx={{ mb: 4 }}>
        <Stack spacing={1}>
          <Typography variant="body2">
            <strong>Theme:</strong> {theme}
          </Typography>
          <Typography variant="body2">
            <strong>Sidebar:</strong> {sidebarOpen ? "Open" : "Closed"}
          </Typography>
          <Typography variant="body2">
            <strong>Active Modal:</strong> {activeModal || "None"}
          </Typography>
          <Typography variant="body2">
            <strong>Global Loading:</strong> {globalLoading ? "Yes" : "No"}
          </Typography>
          <Typography variant="body2">
            <strong>Notifications:</strong> {showNotifications ? "Visible" : "Hidden"}
          </Typography>
        </Stack>
      </Alert>

      {/* Theme Controls */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Theme Controls
        </Typography>
        <Card>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button variant="contained" onClick={() => dispatch(toggleTheme())}>
              Toggle Theme (Current: {theme})
            </Button>
            <Badge label={theme === "light" ? "Light Mode" : "Dark Mode"} status="info" />
          </Stack>
        </Card>
      </Box>

      {/* Sidebar Controls */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Sidebar Controls
        </Typography>
        <Card>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button variant="outlined" onClick={() => dispatch(toggleSidebar())}>
              Toggle Sidebar
            </Button>
            <Badge
              label={sidebarOpen ? "Open" : "Closed"}
              status={sidebarOpen ? "success" : "error"}
            />
          </Stack>
        </Card>
      </Box>

      {/* Modal Controls */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Modal Controls
        </Typography>
        <Card>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button
              variant="contained"
              color="error"
              onClick={() => dispatch(openModal("deleteConfirm"))}
            >
              Open Delete Modal
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => dispatch(openModal("userSettings"))}
            >
              Open Settings Modal
            </Button>
            <Button
              variant="outlined"
              onClick={() => dispatch(closeModal())}
              disabled={!activeModal}
            >
              Close Modal
            </Button>
            {activeModal && <Badge label={`Active: ${activeModal}`} status="warning" />}
          </Stack>
        </Card>
      </Box>

      {/* Loading Controls */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Loading Controls
        </Typography>
        <Card>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button variant="contained" onClick={handleSimulateLoading}>
              Simulate Loading (2s)
            </Button>
            <Badge
              label={globalLoading ? "Loading..." : "Ready"}
              status={globalLoading ? "warning" : "success"}
            />
          </Stack>
        </Card>
      </Box>

      {/* Notification Controls */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Notification Controls
        </Typography>
        <Card>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button variant="outlined" onClick={() => dispatch(toggleNotifications())}>
              Toggle Notifications
            </Button>
            <Badge
              label={showNotifications ? "Visible" : "Hidden"}
              status={showNotifications ? "info" : "default"}
            />
          </Stack>
        </Card>
      </Box>

      {/* Redux DevTools Info */}
      <Paper sx={{ p: 3, bgcolor: "background.default" }}>
        <Typography variant="h6" gutterBottom fontWeight="semibold">
          🛠️ Redux DevTools
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Open your browser's Redux DevTools to see state changes in real-time!
        </Typography>
        <Typography variant="body2" color="text.secondary">
          1. Open browser DevTools (F12)
          <br />
          2. Click "Redux" tab
          <br />
          3. Watch state update as you click buttons
        </Typography>
      </Paper>

      {/* Global Loading Overlay */}
      <LoadingOverlay open={globalLoading} message="Loading..." fullScreen blur />
    </Container>
  );
}
