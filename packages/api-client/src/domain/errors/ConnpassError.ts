export class ConnpassError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: any
  ) {
    super(message);
    this.name = 'ConnpassError';
    Object.setPrototypeOf(this, ConnpassError.prototype);
  }
}

export class ConnpassApiError extends ConnpassError {
  constructor(message: string, statusCode: number, response: any) {
    super(`API Error: ${message}`, statusCode, response);
    this.name = 'ConnpassApiError';
    Object.setPrototypeOf(this, ConnpassApiError.prototype);
  }
}

export class ConnpassRateLimitError extends ConnpassError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429);
    this.name = 'ConnpassRateLimitError';
    Object.setPrototypeOf(this, ConnpassRateLimitError.prototype);
  }
}

export class ConnpassValidationError extends ConnpassError {
  constructor(message: string) {
    super(`Validation Error: ${message}`);
    this.name = 'ConnpassValidationError';
    Object.setPrototypeOf(this, ConnpassValidationError.prototype);
  }
}

export class ConnpassTimeoutError extends ConnpassError {
  constructor(message = 'Request timeout') {
    super(message);
    this.name = 'ConnpassTimeoutError';
    Object.setPrototypeOf(this, ConnpassTimeoutError.prototype);
  }
}