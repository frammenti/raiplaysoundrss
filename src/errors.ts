export { HttpError, NotFoundError, ValidationError, BadGatewayError }

class HttpError extends Error {
  public statusCode: number

  constructor(message: string, options: ErrorOptions & { statusCode: number }) {
    super(message)
    this.statusCode = options.statusCode
  }
}

class NotFoundError extends Error {
  statusCode = 404
}

class ValidationError extends Error {
  statusCode = 400
}

class BadGatewayError extends Error {
  statusCode = 502
}
