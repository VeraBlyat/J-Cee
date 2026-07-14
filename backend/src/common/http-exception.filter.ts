import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

// Da a los errores la forma { error: "mensaje" }, igual que devolvían las
// rutas originales de Next (el frontend lee data.error).
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Ocurrió un error.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const m = (res as any).message;
        // NestJS mete el mensaje en .message (string) o un array (validaciones).
        message = Array.isArray(m) ? m.join(', ') : m || message;
      }
    }

    response.status(status).json({ error: message });
  }
}
