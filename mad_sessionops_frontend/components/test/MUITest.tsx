"use client";

import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  CardActions,
  Grid,
  Paper,
  Chip,
  IconButton,
  Stack,
  Alert,
  LinearProgress,
  CircularProgress,
} from "@mui/material";
import {
  Favorite,
  Share,
  Delete,
  Edit,
  Add,
  Search,
  Settings,
  Notifications,
} from "@mui/icons-material";
import { useTheme } from "@/components/providers/ThemeProvider";

export default function MUITest() {
  const { mode, toggleTheme } = useTheme();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header with Theme Toggle */}
      <Box sx={{ mb: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
            Material-UI Integration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Testing MUI components with our design system
          </Typography>
        </Box>
        <Button variant="contained" onClick={toggleTheme}>
          {mode === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
        </Button>
      </Box>

      {/* Buttons Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="semibold">
          Buttons
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Button variant="contained">Contained</Button>
          <Button variant="outlined">Outlined</Button>
          <Button variant="text">Text</Button>
          <Button variant="contained" color="secondary">
            Secondary
          </Button>
          <Button variant="contained" color="success">
            Success
          </Button>
          <Button variant="contained" color="error">
            Error
          </Button>
          <Button variant="contained" disabled>
            Disabled
          </Button>
          <Button variant="contained" size="small">
            Small
          </Button>
          <Button variant="contained" size="large">
            Large
          </Button>
          <Button variant="contained" startIcon={<Add />}>
            With Icon
          </Button>
        </Stack>
      </Paper>

      {/* Form Inputs */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="semibold">
          Form Inputs
        </Typography>
        <Stack spacing={3}>
          <TextField label="Standard Input" fullWidth />
          <TextField label="Email" type="email" fullWidth />
          <TextField
            label="Password"
            type="password"
            helperText="At least 8 characters"
            fullWidth
          />
          <TextField label="Disabled" disabled fullWidth />
          <TextField label="Error State" error helperText="This field is required" fullWidth />
          <TextField
            label="With Icon"
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: "action.active" }} />,
            }}
            fullWidth
          />
          <TextField label="Multiline" multiline rows={4} fullWidth />
        </Stack>
      </Paper>

      {/* Cards */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="semibold" sx={{ mb: 2 }}>
          Cards
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  Card Title
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  This is a card component from Material-UI. It can contain any content you want to
                  display.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip label="Tag 1" size="small" />
                  <Chip label="Tag 2" size="small" color="primary" />
                </Stack>
              </CardContent>
              <CardActions>
                <Button size="small">Learn More</Button>
                <IconButton size="small">
                  <Favorite />
                </IconButton>
                <IconButton size="small">
                  <Share />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  Another Card
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Cards are versatile components that can display various types of content including
                  text, images, and actions.
                </Typography>
                <LinearProgress sx={{ mb: 2 }} />
                <Typography variant="caption" color="text.secondary">
                  Progress: 60%
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" color="primary">
                  View Details
                </Button>
              </CardActions>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                  Third Card
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Material-UI provides excellent elevation and shadow system for depth perception.
                </Typography>
                <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary">
                    Loading...
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Icons */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="semibold">
          Icons
        </Typography>
        <Stack direction="row" spacing={2}>
          <IconButton color="primary">
            <Favorite />
          </IconButton>
          <IconButton color="secondary">
            <Share />
          </IconButton>
          <IconButton color="error">
            <Delete />
          </IconButton>
          <IconButton color="success">
            <Edit />
          </IconButton>
          <IconButton>
            <Settings />
          </IconButton>
          <IconButton>
            <Notifications />
          </IconButton>
        </Stack>
      </Paper>

      {/* Chips */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="semibold">
          Chips
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label="Default" />
          <Chip label="Primary" color="primary" />
          <Chip label="Secondary" color="secondary" />
          <Chip label="Success" color="success" />
          <Chip label="Error" color="error" />
          <Chip label="Warning" color="warning" />
          <Chip label="Info" color="info" />
          <Chip label="Deletable" onDelete={() => {}} />
          <Chip label="Clickable" onClick={() => {}} />
          <Chip label="With Icon" icon={<Favorite />} />
        </Stack>
      </Paper>

      {/* Alerts */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="semibold" sx={{ mb: 2 }}>
          Alerts
        </Typography>
        <Stack spacing={2}>
          <Alert severity="success">This is a success alert!</Alert>
          <Alert severity="info">This is an info alert.</Alert>
          <Alert severity="warning">This is a warning alert.</Alert>
          <Alert severity="error">This is an error alert.</Alert>
          <Alert severity="success" variant="filled">
            Filled success alert
          </Alert>
          <Alert severity="error" variant="outlined">
            Outlined error alert
          </Alert>
        </Stack>
      </Box>

      {/* Typography Scale */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom fontWeight="semibold">
          Typography Scale
        </Typography>
        <Stack spacing={2}>
          <Typography variant="h1">Heading 1</Typography>
          <Typography variant="h2">Heading 2</Typography>
          <Typography variant="h3">Heading 3</Typography>
          <Typography variant="h4">Heading 4</Typography>
          <Typography variant="h5">Heading 5</Typography>
          <Typography variant="h6">Heading 6</Typography>
          <Typography variant="body1">
            Body 1: This is regular body text. Lorem ipsum dolor sit amet, consectetur adipiscing
            elit.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Body 2: This is smaller body text for supporting content.
          </Typography>
          <Typography variant="caption" display="block">
            Caption: Small text for captions and labels
          </Typography>
        </Stack>
      </Paper>
    </Container>
  );
}
