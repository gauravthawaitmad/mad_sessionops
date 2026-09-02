"use client";

import { use } from "react";
import { SchoolDetailPage } from "@/components/schools/SchoolDetailPage";

export default function SchoolDetailRoute({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = use(params);
  // key forces a fresh mount per school — SchoolDetailPage's useState initial
  // values then supply loading/notFound/school's correct starting state on
  // navigation between schools, rather than the effect needing to reset them
  // manually (which previously also let the prior school's data flash briefly
  // before the new fetch resolved).
  return <SchoolDetailPage key={partnerId} partnerId={Number(partnerId)} />;
}
