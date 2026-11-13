import { NextResponse } from "next/server";
import { sunucuIstemcisi } from "@/lib/supabase";

export async function GET(istek: Request): Promise<NextResponse> {
  const supabase = await sunucuIstemcisi();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/giris", istek.url));
}
