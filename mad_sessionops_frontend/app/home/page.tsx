import { redirect } from "next/navigation";

// Leftover boilerplate route from the original scaffold — never had real
// content, but was still a live post-login redirect target (see useAuth.ts),
// so it stayed reachable. Redirect to the real dashboard instead of rendering
// the old generic admin-template shell.
export default function HomePage() {
  redirect("/schools");
}
