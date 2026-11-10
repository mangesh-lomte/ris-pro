import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on 401 or 403
        if (typeof error === 'object' && error !== null && 'statusCode' in error) {
          const status = (error as { statusCode: number }).statusCode;
          if (status === 401 || status === 403) return false;
        }
        return failureCount < 2;
      },
    },
  },
});

