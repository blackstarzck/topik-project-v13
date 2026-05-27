import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  type SupabaseServerClient,
} from "../supabase/server";

type ClientFactory = () => Promise<SupabaseServerClient>;

export async function getCurrentUser(
  createClient: ClientFactory = createSupabaseServerClient,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser(
  createClient: ClientFactory = createSupabaseServerClient,
) {
  const user = await getCurrentUser(createClient);
  if (!user) {
    redirect("/login");
  }
  return user;
}
