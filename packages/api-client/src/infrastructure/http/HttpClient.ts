import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { ConnpassApiError, ConnpassRateLimitError, ConnpassTimeoutError, ConnpassError } from '../../domain/errors';

export interface HttpClientConfig {
  baseURL: string;
  apiKey: string;
  timeout?: number;
  rateLimitDelay?: number;
}

export class HttpClient {
  private client: AxiosInstance;
  private lastRequestTime: number = 0;
  private rateLimitDelay: number;

  constructor(config: HttpClientConfig) {
    this.rateLimitDelay = config.rateLimitDelay ?? 1000;
    
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout ?? 30000,
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new ConnpassTimeoutError('Request timeout');
        }

        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;

          switch (status) {
            case 429:
              throw new ConnpassRateLimitError('Rate limit exceeded');
            case 400:
              throw new ConnpassApiError('Bad Request', status, data);
            case 401:
              throw new ConnpassApiError('Unauthorized - Invalid API key', status, data);
            case 403:
              throw new ConnpassApiError('Forbidden', status, data);
            case 404:
              throw new ConnpassApiError('Not Found', status, data);
            case 500:
              throw new ConnpassApiError('Internal Server Error', status, data);
            default:
              throw new ConnpassApiError(`HTTP ${status}`, status, data);
          }
        }

        throw new ConnpassError(`Network error: ${error.message}`);
      }
    );
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  async get<T>(url: string, params?: Record<string, any>): Promise<AxiosResponse<T>> {
    try {
      await this.waitForRateLimit();
      return await this.client.get<T>(url, { params });
    } catch (error) {
      throw error;
    }
  }
}