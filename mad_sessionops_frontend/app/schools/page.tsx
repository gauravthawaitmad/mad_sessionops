'use client';

import { SchoolListPage } from '@/components/schools/SchoolListPage';
import { useAppSelector } from '@/lib/redux';
import { selectUser } from '@/lib/redux/features/auth/authSlice';

export default function SchoolsPage() {
  const user = useAppSelector(selectUser);
  const userName = user?.name ?? 'User';
  return <SchoolListPage userName={userName} />;
}
