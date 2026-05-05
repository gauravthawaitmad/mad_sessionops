# Frontend Patterns

## Component Architecture

### Server vs Client Components

```
Server Component (default):
- Data fetching
- Layout structure
- Static content
- No interactivity

Client Component ('use client'):
- Event handlers (onClick, onChange)
- useState, useEffect
- Browser APIs
- Redux access
- Form interactions
```

### Page Pattern

```tsx
// app/schools/page.tsx (Server Component)
export default function SchoolsPage() {
  return (
    <div>
      <PageHeader title="Schools" />
      <SchoolList />  {/* Client component for interactivity */}
    </div>
  );
}
```

```tsx
// components/schools/SchoolList.tsx (Client Component)
'use client';

import { useEffect, useState } from 'react';
import { schoolsApi } from '@/lib/api/schools';

export function SchoolList() {
  // Interactive logic here
}
```

## State Management

### Decision Tree

| Need | Solution |
|------|----------|
| Auth token / user info | Redux (lib/redux/features/auth/) |
| Server data (lists, details) | API call + local useState |
| Form state | React Hook Form |
| UI state (modals, toggles) | Local useState |
| URL-driven state (filters, pagination) | URL search params |

### Redux — Auth Only

```tsx
// Access auth state:
import { useAppSelector } from '@/lib/redux/store';

const { user, accessToken } = useAppSelector((state) => state.auth);
```

Do NOT put non-auth state in Redux. Keep it simple.

## API Integration

### API Function Pattern

```tsx
// lib/api/schools.ts
import { apiClient } from './client';
import type { School, SchoolListResponse } from './types';

export const schoolsApi = {
  list: () => apiClient.get<SchoolListResponse>('/api/schools/'),

  detail: (id: number) => apiClient.get<School>(`/api/schools/${id}/`),

  create: (data: CreateSchoolPayload) =>
    apiClient.post<School>('/api/schools/', data),
};
```

### Using API in Components

```tsx
'use client';

import { useState, useEffect } from 'react';
import { schoolsApi } from '@/lib/api/schools';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

export function SchoolList() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    schoolsApi.list()
      .then((res) => setSchools(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (/* render schools */);
}
```

## Form Pattern

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
});

type FormData = z.infer<typeof schema>;

export function ExampleForm({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <TextField
        {...register('name')}
        error={!!errors.name}
        helperText={errors.name?.message}
        label="Name"
        fullWidth
      />
      <TextField
        {...register('email')}
        error={!!errors.email}
        helperText={errors.email?.message}
        label="Email"
        fullWidth
      />
      <Button type="submit" variant="contained" disabled={isSubmitting}>
        Submit
      </Button>
    </form>
  );
}
```

## MUI Usage

### Import Pattern (Always Subpath)

```tsx
// CORRECT:
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';

// WRONG (pulls entire library):
import { Button, TextField, Box } from '@mui/material';
```

### Theme Tokens

Use MUI theme for colors and spacing. Never hardcode:

```tsx
// CORRECT:
<Box sx={{ color: 'text.primary', p: 2, mb: 3 }}>

// WRONG:
<Box sx={{ color: '#333', padding: '16px', marginBottom: '24px' }}>
```

## Error Handling

### API Error Display

```tsx
import toast from 'react-hot-toast';

try {
  await schoolsApi.create(data);
  toast.success('School created');
} catch (err: any) {
  // Backend returns {error: {code, message, details?}}
  const message = err.response?.data?.error?.message || 'Something went wrong';
  toast.error(message);
}
```

### Loading States

Always show explicit loading state. Never render empty/null while loading:

```tsx
if (loading) return <Skeleton variant="rectangular" height={200} />;
```

## File Organization

```
components/
├── common/          # Shared UI (PageHeader, EmptyState, etc.)
├── schools/         # School feature components
├── children/        # Children feature components
├── volunteers/      # Volunteer feature components
└── layout/          # App layout (sidebar, nav, etc.)
```

New features get their own directory under `components/`.
