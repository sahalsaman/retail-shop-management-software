import { deleteSession } from "@/lib/session";
import { ok } from "@/lib/api";

export async function POST() {
  await deleteSession();
  return ok({ loggedOut: true });
}
