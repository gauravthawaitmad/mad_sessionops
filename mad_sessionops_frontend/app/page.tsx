import { redirect } from "next/navigation";

// The middleware handles unauthenticated users (redirects to /login?next=/schools).
// Authenticated users landing on "/" are sent to the main app route.
export default function Home() {
  redirect("/schools");
}
