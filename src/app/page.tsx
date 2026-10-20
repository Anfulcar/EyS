import { redirect } from "next/navigation";
import { homeFor, requireUser } from "@/lib/auth";

export default async function Home() {
  const u = await requireUser();
  redirect(homeFor(u.role));
}
