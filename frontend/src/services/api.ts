/**
 * API Helper - Fetch wrapper for local API calls
 *
 * All requests go through relative paths (e.g., /api/health)
 * which Vite proxies to the backend at localhost:3001.
 *
 * NO direct http:// URLs - everything stays local.
 */

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Make a GET request to the local API
 */
export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: errorData.message || `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    const data = await response.json();
    return { data, status: response.status };
  } catch (err) {
    return {
      error: 'Unable to connect to the server. Is it running?',
      status: 0,
    };
  }
}

/**
 * Make a POST request to the local API
 */
export async function apiPost<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: errorData.message || `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    const data = await response.json();
    return { data, status: response.status };
  } catch (err) {
    return {
      error: 'Unable to connect to the server. Is it running?',
      status: 0,
    };
  }
}

/**
 * Make a PUT request to the local API
 */
export async function apiPut<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: errorData.message || `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    const data = await response.json();
    return { data, status: response.status };
  } catch (err) {
    return {
      error: 'Unable to connect to the server. Is it running?',
      status: 0,
    };
  }
}

/**
 * Make a DELETE request to the local API
 */
export async function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: errorData.message || `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    const data = await response.json();
    return { data, status: response.status };
  } catch (err) {
    return {
      error: 'Unable to connect to the server. Is it running?',
      status: 0,
    };
  }
}
