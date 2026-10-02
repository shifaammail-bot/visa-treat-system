import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except Next internals and static files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logos/|pdfjs/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
