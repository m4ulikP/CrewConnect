import type { ApiResponse, ApiErrorResponse } from "@crewconnect/shared";

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = data as ApiErrorResponse | null;
    throw new ApiClientError(
      errorBody?.error?.code || "HTTP_ERROR",
      errorBody?.error?.message || `Request failed with status ${response.status}`,
      response.status,
      errorBody?.error?.details
    );
  }

  const successBody = data as ApiResponse<T>;
  return successBody.data;
}

export async function fetchHealth(): Promise<{
  status: string;
  uptime: number;
  timestamp: string;
  version: string;
  database: { connected: boolean; status: string; isReplicaSet: boolean };
}> {
  const url = `${BASE_URL}/health`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}
