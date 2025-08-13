import type { ErrorResponse } from '../types/generated/ErrorResponse';

class ApiError extends Error {
  status: number;
  response?: Response;
  
  constructor(
    message: string,
    status: number,
    response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }
}

// OData response interface
interface ODataResponse<T> {
  '@odata.context': string;
  '@odata.count'?: number;
  value: T[];
}

// OData query options
export interface ODataQueryOptions {
  $select?: string;
  $filter?: string;
  $orderby?: string;
  $top?: number;
  $skip?: number;
  $count?: boolean;
  $expand?: string;
}

// Helper to build query string from OData options
function buildODataQuery(options: ODataQueryOptions): string {
  const params = new URLSearchParams();
  
  if (options.$select) params.append('$select', options.$select);
  if (options.$filter) params.append('$filter', options.$filter);
  if (options.$orderby) params.append('$orderby', options.$orderby);
  if (options.$top !== undefined) params.append('$top', options.$top.toString());
  if (options.$skip !== undefined) params.append('$skip', options.$skip.toString());
  if (options.$count !== undefined) params.append('$count', options.$count.toString());
  if (options.$expand) params.append('$expand', options.$expand);
  
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
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

// OData-aware API request for collections (automatically unwraps OData envelope)
export async function apiRequestOData<T = any>(
  url: string,
  options: RequestInit = {},
  queryOptions?: ODataQueryOptions
): Promise<{ data: T[]; count?: number }> {
  const queryString = queryOptions ? buildODataQuery(queryOptions) : '';
  const fullUrl = `${url}${queryString}`;
  
  const response = await apiRequest<ODataResponse<T> | T[]>(fullUrl, options);
  
  // Check if response is OData format (has @odata.context and value properties)
  if (response && typeof response === 'object' && '@odata.context' in response && 'value' in response) {
    const odataResponse = response as ODataResponse<T>;
    return {
      data: odataResponse.value,
      count: odataResponse['@odata.count']
    };
  }
  
  // Fallback for non-OData responses (backward compatibility)
  return {
    data: Array.isArray(response) ? response : [response as T],
    count: undefined
  };
}

// Legacy endpoint mappings to new OData endpoints
const ENDPOINT_MAPPINGS: Record<string, string> = {
  '/api/1/companies': '/api/1/Companies',
  '/api/1/users': '/api/1/Users',
  '/api/1/sites': '/api/1/Sites',
  '/api/1/roles': '/api/1/Roles',
  '/api/1/data': '/api/1/DataSources',
};

// Function to map navigation endpoints
function mapNavigationEndpoint(url: string): string {
  // Handle company navigation endpoints
  const companyUsersMatch = url.match(/^\/api\/1\/company\/(\d+)\/users$/);
  if (companyUsersMatch) {
    return `/api/1/Companies/${companyUsersMatch[1]}/Users`;
  }
  
  const companySitesMatch = url.match(/^\/api\/1\/company\/(\d+)\/sites$/);
  if (companySitesMatch) {
    return `/api/1/Companies/${companySitesMatch[1]}/Sites`;
  }
  
  // Handle user navigation endpoints
  const userRolesMatch = url.match(/^\/api\/1\/users\/(\d+)\/roles$/);
  if (userRolesMatch) {
    return `/api/1/Users/${userRolesMatch[1]}/Roles`;
  }
  
  // Handle individual resource endpoints (with IDs)
  const userIdMatch = url.match(/^\/api\/1\/users\/(\d+)(.*)$/);
  if (userIdMatch) {
    return `/api/1/Users/${userIdMatch[1]}${userIdMatch[2]}`;
  }
  
  const siteIdMatch = url.match(/^\/api\/1\/sites\/(\d+)(.*)$/);
  if (siteIdMatch) {
    return `/api/1/Sites/${siteIdMatch[1]}${siteIdMatch[2]}`;
  }
  
  const companyIdMatch = url.match(/^\/api\/1\/companies\/(\d+)(.*)$/);
  if (companyIdMatch) {
    return `/api/1/Companies/${companyIdMatch[1]}${companyIdMatch[2]}`;
  }
  
  const roleIdMatch = url.match(/^\/api\/1\/roles\/(\d+)(.*)$/);
  if (roleIdMatch) {
    return `/api/1/Roles/${roleIdMatch[1]}${roleIdMatch[2]}`;
  }
  
  // Map basic collection endpoints
  for (const [oldEndpoint, newEndpoint] of Object.entries(ENDPOINT_MAPPINGS)) {
    if (url.startsWith(oldEndpoint)) {
      return url.replace(oldEndpoint, newEndpoint);
    }
  }
  
  return url;
}

// Enhanced API request that automatically maps old endpoints to new OData endpoints
export async function apiRequestWithMapping<T = any>(
  url: string,
  options: RequestInit = {},
  queryOptions?: ODataQueryOptions
): Promise<T> {
  const mappedUrl = mapNavigationEndpoint(url);
  
  // For GET requests to collection endpoints, use OData-aware function
  if (!options.method || options.method === 'GET') {
    const isCollectionEndpoint = 
      mappedUrl.match(/\/api\/1\/(Users|Companies|Sites|Roles|DataSources)$/) ||
      mappedUrl.match(/\/api\/1\/(Users|Companies|Sites|Roles|DataSources)\/\d+\/(Users|Sites|Roles|Company)$/);
    
    if (isCollectionEndpoint) {
      const result = await apiRequestOData<T extends Array<infer U> ? U : T>(mappedUrl, options, queryOptions);
      return result.data as T;
    }
  }
  
  // For non-collection endpoints, use regular API request
  const queryString = queryOptions ? buildODataQuery(queryOptions) : '';
  const fullUrl = `${mappedUrl}${queryString}`;
  return await apiRequest<T>(fullUrl, options);
}

// Convenience function for getting OData collections with count information
export async function apiRequestODataWithCount<T = any>(
  url: string,
  options: RequestInit = {},
  queryOptions?: ODataQueryOptions
): Promise<{ data: T[]; count?: number; hasMore?: boolean }> {
  const result = await apiRequestOData<T>(url, options, queryOptions);
  
  // Calculate if there are more records (useful for pagination)
  const hasMore = queryOptions?.$top && result.count 
    ? (queryOptions.$skip || 0) + queryOptions.$top < result.count
    : undefined;
    
  return {
    data: result.data,
    count: result.count,
    hasMore
  };
}

export { ApiError };