import { QueryClient } from "@tanstack/react-query";

export function createDesktopQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        refetchInterval: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
