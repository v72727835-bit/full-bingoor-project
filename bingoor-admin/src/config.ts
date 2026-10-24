// Same live backend the Bingoor app uses. Override with NEXT_PUBLIC_API_URL.
export const API_URL: string =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://app-api.autozo.org/api/v1';