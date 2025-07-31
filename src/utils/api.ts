import type { ErrorResponse } from '../types/generated/ErrorResponse';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  // Handle empty responses (like 204 No Content)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    if (response.ok) {
      return {} as T;
    } else {
      throw new ApiError('Request failed with empty response', response.status, response);
    }
  }

  const responseText = await response.text();
  
  // Log non-JSON responses for debugging
  if (!responseText.trim()) {
    console.warn(`API returned empty response: ${response.status} ${response.statusText} for ${url}`);
    if (response.ok) {
      return {} as T;
    } else {
      throw new ApiError('Request failed with empty response', response.status, response);
    }
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    // This should never happen with the updated backend, so log it
    console.error('Non-JSON response received:', {
      url,
      status: response.status,
      statusText: response.statusText,
      responseText: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''),
    });
    throw new ApiError('Server returned non-JSON response', response.status, response);
  }

  if (response.ok) {
    return data as T;
  } else {
    // Server returned JSON error response
    const errorData = data as ErrorResponse;
    throw new ApiError(errorData.error || 'Request failed', response.status, response);
  }
}

export { ApiError };