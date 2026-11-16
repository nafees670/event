import type { QueryClient } from "@tanstack/react-query";

import { authApi } from "@/lib/api/auth";

export async function signOut(queryClient: QueryClient): Promise<void> {
  try {
    await authApi.logout();
  } finally {
    queryClient.clear();
    window.location.assign("/login");
  }
}
