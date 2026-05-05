'use client';

import { use } from 'react';
import { SchoolDetailPage } from '@/components/schools/SchoolDetailPage';

export default function SchoolDetailRoute({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = use(params);
  return <SchoolDetailPage partnerId={Number(partnerId)} />;
}
