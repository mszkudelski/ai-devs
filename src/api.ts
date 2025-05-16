import axios, { AxiosError } from 'axios';

interface ApiError {
  message: string;
  status?: number;
  data?: any;
  url?: string;
  timestamp: string;
}

const handleApiError = (error: unknown, url: string): never => {
  const apiError: ApiError = {
    message: 'Unknown error occurred',
    timestamp: new Date().toISOString(),
    url
  };

  if (axios.isAxiosError(error)) {
    apiError.message = error.response?.data?.message || error.message;
    apiError.status = error.response?.status;
    apiError.data = error.response?.data;
    
    if (error.response) {
      switch (error.response.status) {
        case 400:
          apiError.message = 'Bad Request: The request was invalid';
          break;
        case 401:
          apiError.message = 'Unauthorized: Authentication is required';
          break;
        case 403:
          apiError.message = 'Forbidden: You don\'t have permission to access this resource';
          break;
        case 404:
          apiError.message = `Resource not found at ${url}`;
          break;
        case 429:
          apiError.message = 'Too many requests: Please try again later';
          break;
        case 500:
          apiError.message = 'Internal Server Error: Something went wrong on the server';
          break;
        default:
          apiError.message = `Request failed with status ${error.response.status}`;
      }
    } else if (error.request) {
      apiError.message = 'Network Error: Unable to reach the server';
    }
  } else if (error instanceof Error) {
    apiError.message = error.message;
  }

  console.error('API Request Failed:', {
    url,
    error: apiError,
    timestamp: apiError.timestamp
  });

  throw apiError;
};

export const getRequest = async <T>(url: string): Promise<T> => {
  try {
    const response = await axios.get<T>(url);
    return response.data;
  } catch (error) {
    return handleApiError(error, url);
  }
};  

export const postRequest = async <T, R>(url: string, data: T): Promise<R> => {
  try {
    const response = await axios.post<R>(url, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    return handleApiError(error, url);
  }
};  