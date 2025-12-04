import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body } = request;
    const startTime = Date.now();

    // Log incoming request
    this.logger.log(`→ ${method} ${url}`);

    if (Object.keys(body || {}).length > 0) {
      this.logger.debug(`Request body: ${JSON.stringify(body)}`);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(`← ${method} ${url} [${duration}ms]`);
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error(`✗ ${method} ${url} [${duration}ms] - ${error.message}`);
        },
      }),
    );
  }
}
