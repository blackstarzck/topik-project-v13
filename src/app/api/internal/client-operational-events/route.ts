import { validateClientOperationalEvent } from "@/lib/operations/client-operational-event";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const validated = validateClientOperationalEvent(input);
  if (!validated.ok) return new Response(null, { status: 400 });

  console.info("client_operational_event", validated.event);
  return new Response(null, { status: 202 });
}
