"use client";

import { useState } from "react";
import { Container, Typography, Box, Grid, Stack, TextField } from "@mui/material";
import { Add, Edit, Delete, Search, Email, Lock, Person, Inbox } from "@mui/icons-material";
import {
  Button,
  Input,
  Card,
  Modal,
  Alert,
  Badge,
  Avatar,
  Spinner,
  EmptyState,
} from "@/components/ui";

export default function UIComponentsTest() {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={6}>
        <Typography variant="h3" fontWeight="bold" gutterBottom>
          Base UI Components
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Custom reusable components built on Material-UI
        </Typography>
      </Box>

      {/* Buttons */}
      <Box mb={6}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Buttons
        </Typography>
        <Card>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Button variant="contained">Contained</Button>
            <Button variant="outlined">Outlined</Button>
            <Button variant="text">Text</Button>
            <Button variant="contained" startIcon={<Add />}>
              With Icon
            </Button>
            <Button variant="contained" loading>
              Loading
            </Button>
            <Button
              variant="contained"
              loading={loading}
              loadingText="Saving..."
              onClick={handleLoadingDemo}
            >
              Click to Load
            </Button>
            <Button variant="contained" color="secondary">
              Secondary
            </Button>
            <Button variant="contained" color="error">
              Error
            </Button>
            <Button variant="contained" disabled>
              Disabled
            </Button>
          </Stack>
        </Card>
      </Box>

      {/* Inputs */}
      <Box mb={6}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Inputs
        </Typography>
        <Card>
          <Stack spacing={3}>
            <Input label="Standard Input" fullWidth />
            <Input
              label="Email"
              type="email"
              startIcon={<Email />}
              placeholder="you@example.com"
              fullWidth
            />
            <Input
              label="Password"
              type="password"
              startIcon={<Lock />}
              helperText="At least 8 characters"
              fullWidth
            />
            <Input label="Search" startIcon={<Search />} placeholder="Search..." fullWidth />
            <TextField
              label="Bio"
              multiline
              rows={4}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              helperText="Tell us about yourself"
              fullWidth
            />
            <Input label="Disabled" disabled fullWidth />
            <Input label="Error State" error="This field is required" fullWidth />
          </Stack>
        </Card>
      </Box>

      {/* Cards */}
      <Box mb={6}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Cards
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card
              title="Basic Card"
              subtitle="With subtitle"
              hoverEffect
              actions={
                <>
                  <Button size="small">View</Button>
                  <Button size="small" variant="contained">
                    Edit
                  </Button>
                </>
              }
            >
              <Typography variant="body2" color="text.secondary">
                This is a basic card with title, subtitle, content, and actions.
              </Typography>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card
              title="With Image"
              image="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400"
              imageHeight={160}
              hoverEffect
              divider
              actions={
                <Stack direction="row" spacing={1}>
                  <Badge status="success" label="Active" />
                  <Badge status="info" label="New" />
                </Stack>
              }
            >
              <Typography variant="body2" color="text.secondary">
                Card with image and badges in actions.
              </Typography>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card
              title="Interactive Card"
              hoverEffect
              actions={
                <>
                  <Button size="small" startIcon={<Edit />}>
                    Edit
                  </Button>
                  <Button size="small" color="error" startIcon={<Delete />}>
                    Delete
                  </Button>
                </>
              }
            >
              <Typography variant="body2" color="text.secondary" paragraph>
                Card with hover effect and action buttons.
              </Typography>
              <Stack direction="row" spacing={1} mt={2}>
                <Avatar size="small">JD</Avatar>
                <Avatar size="small" status="online">
                  AB
                </Avatar>
                <Avatar size="small" status="away">
                  CD
                </Avatar>
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Alerts */}
      <Box mb={6}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Alerts
        </Typography>
        <Card>
          <Stack spacing={2}>
            <Alert severity="success" title="Success!">
              Your changes have been saved successfully.
            </Alert>
            <Alert severity="info" variant="filled">
              This is an informational message.
            </Alert>
            <Alert severity="warning" variant="outlined" closable onClose={() => {}}>
              This is a warning that can be dismissed.
            </Alert>
            <Alert severity="error" title="Error Occurred">
              Something went wrong. Please try again.
            </Alert>
          </Stack>
        </Card>
      </Box>

      {/* Badges */}
      <Box mb={6}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Badges
        </Typography>
        <Card>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Badge label="Default" />
            <Badge status="success" label="Success" />
            <Badge status="error" label="Error" />
            <Badge status="warning" label="Warning" />
            <Badge status="info" label="Info" />
            <Badge status="success" label="Outlined" variant="outlined" />
            <Badge status="error" label="Filled" variant="filled" />
            <Badge label="Custom" variant="soft" />
          </Stack>
        </Card>
      </Box>

      {/* Avatars */}
      <Box mb={6}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Avatars
        </Typography>
        <Card>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Avatar size="small">SM</Avatar>
            <Avatar size="medium">MD</Avatar>
            <Avatar size="large">LG</Avatar>
            <Avatar status="online">ON</Avatar>
            <Avatar status="offline">OF</Avatar>
            <Avatar status="away">AW</Avatar>
            <Avatar status="busy">BS</Avatar>
            <Avatar src="https://i.pravatar.cc/150?img=1" alt="User" status="online" size="large" />
          </Stack>
        </Card>
      </Box>

      {/* Spinners */}
      <Box mb={6}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Spinners
        </Typography>
        <Card>
          <Stack direction="row" spacing={4} alignItems="center">
            <Spinner size={24} />
            <Spinner size={40} text="Loading..." />
            <Spinner size={60} color="secondary" />
          </Stack>
          <Box mt={4}>
            <Spinner center text="Centered Spinner" />
          </Box>
        </Card>
      </Box>

      {/* Empty States */}
      <Box mb={6}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Empty States
        </Typography>
        <Card>
          <EmptyState
            icon={<Inbox />}
            title="No Data Available"
            description="There's nothing to display here yet. Try adding some content."
            action={{
              label: "Add Content",
              onClick: () => console.log("Add content"),
            }}
            minHeight="300px"
          />
        </Card>
      </Box>

      {/* Modal */}
      <Box mb={6}>
        <Typography variant="h5" fontWeight="semibold" gutterBottom>
          Modal
        </Typography>
        <Card>
          <Button variant="contained" onClick={() => setModalOpen(true)}>
            Open Modal
          </Button>
        </Card>
      </Box>

      {/* Modal Component */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Example Modal"
        dividers
        actions={
          <>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => {
                alert("Confirmed!");
                setModalOpen(false);
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        <Typography paragraph>
          This is a modal dialog with a title, content, and action buttons.
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Input label="Example Input" fullWidth />
        </Box>
      </Modal>
    </Container>
  );
}
