/**
 * ============================================
 * API TYPES
 * ============================================
 *
 * Shared types for API requests and responses.
 */

/**
 * Pagination Parameters
 *
 * Standard pagination for list endpoints
 */
export interface PaginationParams {
  page?: number; // Page number (1-indexed)
  limit?: number; // Items per page
  offset?: number; // Alternative to page
  sort?: string; // Sort field
  order?: "asc" | "desc"; // Sort order
}

/**
 * Paginated Response
 *
 * Standard response format for paginated data
 */
export interface PaginatedResponse<T> {
  data: T[]; // Array of items
  total: number; // Total items count
  page: number; // Current page
  limit: number; // Items per page
  totalPages: number; // Total pages
  hasMore: boolean; // Has next page
}

/**
 * API Error Response
 *
 * Standard error format from backend
 */
export interface ApiError {
  message: string; // Error message
  code: string; // Error code
  status: number; // HTTP status
  errors?: Record<string, string[]>; // Field validation errors
  data?: any; // Additional error data
}

/**
 * API Success Response
 *
 * Standard success format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Search Parameters
 */
export interface SearchParams extends PaginationParams {
  query?: string; // Search query
  filters?: Record<string, any>; // Additional filters
}

/**
 * File Upload Response
 */
export interface UploadResponse {
  url: string; // Uploaded file URL
  filename: string; // Original filename
  size: number; // File size in bytes
  mimetype: string; // File MIME type
}
