/**
 * ============================================
 * API EXPORTS
 * ============================================
 *
 * Central export point for all API-related code
 */

// HTTP Client
export { default as apiClient, api } from "./client";

// Generic Request Wrapper (for dynamic entities)
export { request } from "./request";

// Specific Services (for type-safe operations)
export { default as services } from "./services";
export * from "./services";

// Types
export * from "./types";

/**
 * ============================================
 * USAGE GUIDE
 * ============================================
 *
 * 1. Generic Components (entity is dynamic):
 *    import { request } from '@/lib/api';
 *    const data = await request.read({ entity: 'users', id: '123' });
 *
 * 2. Specific Components (entity is known):
 *    import { usersService } from '@/lib/api';
 *    const user = await usersService.getProfile();
 *
 * 3. Direct API calls (when needed):
 *    import { api } from '@/lib/api';
 *    const data = await api.get('/custom-endpoint');
 */
