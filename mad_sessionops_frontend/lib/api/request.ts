import { api } from "./client";
import type { PaginatedResponse, PaginationParams } from "./types";

/**
 * ============================================
 * GENERIC REQUEST WRAPPER
 * ============================================
 *
 * For dynamic entity operations.
 *
 * USE CASES:
 * - Generic table components
 * - Generic form components
 * - Admin panels with multiple entities
 * - Any component where entity is passed as prop
 */

/**
 * Build query string from params
 */
function buildQueryString(params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) return "";

  const query = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");

  return query ? `?${query}` : "";
}

/**
 * Generic Request Object
 */
export const request = {
  /**
   * Create (POST)
   */
  create: async <T = any>({ entity, jsonData }: { entity: string; jsonData: any }): Promise<T> => {
    return api.post(`/${entity}/create`, jsonData);
  },

  /**
   * Create with File Upload
   */
  createAndUpload: async <T = any>({
    entity,
    jsonData,
  }: {
    entity: string;
    jsonData: FormData;
  }): Promise<T> => {
    return api.post(`/${entity}/create`, jsonData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  /**
   * Read (GET by ID)
   */
  read: async <T = any>({ entity, id }: { entity: string; id: string }): Promise<T> => {
    return api.get(`/${entity}/read/${id}`);
  },

  /**
   * Update (PATCH)
   */
  update: async <T = any>({
    entity,
    id,
    jsonData,
  }: {
    entity: string;
    id: string;
    jsonData: any;
  }): Promise<T> => {
    return api.patch(`/${entity}/update/${id}`, jsonData);
  },

  /**
   * Update with File Upload
   */
  updateAndUpload: async <T = any>({
    entity,
    id,
    jsonData,
  }: {
    entity: string;
    id: string;
    jsonData: FormData;
  }): Promise<T> => {
    return api.patch(`/${entity}/update/${id}`, jsonData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  /**
   * Delete (DELETE)
   */
  delete: async ({
    entity,
    id,
    data,
  }: {
    entity: string;
    id: string;
    data?: any;
  }): Promise<void> => {
    return api.delete(`/${entity}/delete/${id}`, { data });
  },

  /**
   * List (GET with pagination)
   */
  list: async <T = any>({
    entity,
    options = {},
  }: {
    entity: string;
    options?: Record<string, any>;
  }): Promise<PaginatedResponse<T>> => {
    const query = buildQueryString(options);
    return api.get(`/${entity}/list${query}`);
  },

  /**
   * List All (GET all records)
   */
  listAll: async <T = any>({
    entity,
    options = {},
  }: {
    entity: string;
    options?: Record<string, any>;
  }): Promise<T[]> => {
    const query = buildQueryString(options);
    return api.get(`/${entity}/listAll${query}`);
  },

  /**
   * Search
   */
  search: async <T = any>({
    entity,
    options = {},
  }: {
    entity: string;
    options?: Record<string, any>;
  }): Promise<T[]> => {
    const query = buildQueryString(options);
    return api.get(`/${entity}/search${query}`);
  },

  /**
   * Filter
   */
  filter: async <T = any>({
    entity,
    options = {},
  }: {
    entity: string;
    options?: { filter?: string; equal?: string };
  }): Promise<T[]> => {
    let query = "?";
    if (options.filter) query += `filter=${options.filter}&`;
    if (options.equal) query += `equal=${options.equal}&`;
    query = query.slice(0, -1);

    return api.get(`/${entity}/filter${query}`);
  },

  /**
   * Upload File
   */
  upload: async <T = any>({
    entity,
    id,
    jsonData,
  }: {
    entity: string;
    id: string;
    jsonData: FormData;
  }): Promise<T> => {
    return api.patch(`/${entity}/upload/${id}`, jsonData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  /**
   * Summary/Analytics
   */
  summary: async ({
    entity,
    options = {},
  }: {
    entity: string;
    options?: Record<string, any>;
  }): Promise<any> => {
    const query = buildQueryString(options);
    return api.get(`/${entity}/summary${query}`);
  },

  /**
   * Mail
   */
  mail: async ({ entity, jsonData }: { entity: string; jsonData: any }): Promise<any> => {
    return api.post(`/${entity}/mail`, jsonData);
  },

  /**
   * Convert
   */
  convert: async <T = any>({ entity, id }: { entity: string; id: string }): Promise<T> => {
    return api.get(`/${entity}/convert/${id}`);
  },

  /**
   * Generic POST
   */
  post: async <T = any>({ entity, jsonData }: { entity: string; jsonData: any }): Promise<T> => {
    return api.post(`/${entity}`, jsonData);
  },

  /**
   * Generic GET
   */
  get: async <T = any>({ entity }: { entity: string }): Promise<T> => {
    return api.get(`/${entity}`);
  },

  /**
   * Generic PATCH
   */
  patch: async <T = any>({ entity, jsonData }: { entity: string; jsonData: any }): Promise<T> => {
    return api.patch(`/${entity}`, jsonData);
  },
};

export default request;
