import { ResponseParserService } from '../services/response-parser.service';

describe('ResponseParserService', () => {
  let service: ResponseParserService;

  beforeEach(() => {
    service = new ResponseParserService();
  });

  it('should parse plain text response', () => {
    const result = service.parse('Hello, World!');

    expect(result.output).toBe('Hello, World!');
    expect(result.hasError).toBe(false);
    expect(result.errorMessage).toBeUndefined();
    expect(result.metadata).toBeUndefined();
  });

  it('should parse JSON response', () => {
    const json = JSON.stringify({ response: 'test', tokens: 100 });
    const result = service.parse(json);

    expect(result.output).toBe(json);
    expect(result.metadata).toBeDefined();
    expect(result.metadata).toEqual({ response: 'test', tokens: 100 });
    expect(result.hasError).toBe(false);
  });

  it('should detect error messages starting with "Error:"', () => {
    const result = service.parse('Error: Something went wrong');

    expect(result.hasError).toBe(true);
    expect(result.errorMessage).toBe('Error: Something went wrong');
    expect(result.output).toBe('Error: Something went wrong');
  });

  it('should detect error messages starting with "Fatal:"', () => {
    const result = service.parse('Fatal: Critical failure');

    expect(result.hasError).toBe(true);
    expect(result.errorMessage).toBe('Fatal: Critical failure');
  });

  it('should handle empty response', () => {
    const result = service.parse('');

    expect(result.output).toBe('');
    expect(result.hasError).toBe(false);
    expect(result.errorMessage).toBeUndefined();
  });

  it('should trim whitespace from output', () => {
    const result = service.parse('  \n  Hello  \n  ');

    expect(result.output).toBe('Hello');
  });

  it('should handle invalid JSON gracefully', () => {
    const result = service.parse('{ invalid json }');

    expect(result.output).toBe('{ invalid json }');
    expect(result.metadata).toBeUndefined();
    expect(result.hasError).toBe(false);
  });

  it('should not detect "error" in the middle of text', () => {
    const result = service.parse('This is an error-free message');

    expect(result.hasError).toBe(false);
    expect(result.errorMessage).toBeUndefined();
  });
});
