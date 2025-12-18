import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockResponse: {
    statusCode: number;
    getHeader: jest.Mock;
  };

  beforeEach(() => {
    interceptor = new TransformInterceptor();

    mockResponse = {
      statusCode: 200,
      getHeader: jest.fn(),
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn(),
    } as unknown as CallHandler;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should transform response into standard format', (done) => {
    const testData = { message: 'test' };
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('statusCode');
        expect(result).toHaveProperty('timestamp');
        expect(result.data).toEqual(testData);
        expect(result.statusCode).toBe(200);
        done();
      });
  });

  it('should not transform if already in response format', (done) => {
    const alreadyFormatted = {
      data: { message: 'test' },
      statusCode: 200,
      timestamp: '2025-12-19T10:00:00.000Z',
    };
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(alreadyFormatted));

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toEqual(alreadyFormatted);
        done();
      });
  });

  it('should not transform file downloads', (done) => {
    const fileData = Buffer.from('test file data');
    mockResponse.getHeader.mockReturnValue('application/octet-stream');
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(fileData));

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result).toEqual(fileData);
        done();
      });
  });
});
