import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import LandingClient from "./LandingClient";

export default async function LandingPage() {
  const session = await auth0.getSession();
  if (session) redirect("/write");
  return <LandingClient />;
}
