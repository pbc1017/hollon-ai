import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  statusCode: number;
  timestamp: string;
}

/**
 * Global interceptor to transform all successful responses into a consistent format
 * Only applies to non-file responses
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // Don't transform if already in the response format
        if (data && typeof data === 'object' && 'data' in data) {
          return data as Response<T>;
        }

        // Don't transform file downloads or streams
        if (response.getHeader('Content-Type')?.includes('application/octet')) {
          return data;
        }

        // Transform to standard response format
        return {
          data,
          statusCode: response.statusCode,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
