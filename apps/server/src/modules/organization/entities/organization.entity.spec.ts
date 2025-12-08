import { Organization } from './organization.entity';

describe('Organization Entity', () => {
  let organization: Organization;

  beforeEach(() => {
    organization = new Organization();
  });

  describe('contextPrompt field', () => {
    it('should have contextPrompt property', () => {
      expect(organization).toHaveProperty('contextPrompt');
    });

    it('should allow setting contextPrompt to a string value', () => {
      const contextPrompt =
        'You are part of Hollon-AI Dev. Follow organization guidelines.';
      organization.contextPrompt = contextPrompt;

      expect(organization.contextPrompt).toBe(contextPrompt);
    });

    it('should allow setting contextPrompt to null', () => {
      organization.contextPrompt = null;

      expect(organization.contextPrompt).toBeNull();
    });

    it('should have undefined contextPrompt initially', () => {
      // TypeORM 엔티티는 초기화 전에는 undefined일 수 있음
      expect(organization.contextPrompt).toBeUndefined();
    });

    it('should handle long contextPrompt values (text type)', () => {
      const longPrompt = 'A'.repeat(10000);
      organization.contextPrompt = longPrompt;

      expect(organization.contextPrompt).toBe(longPrompt);
      expect(organization.contextPrompt.length).toBe(10000);
    });

    it('should handle multi-line contextPrompt values', () => {
      const multiLinePrompt = `# Organization: Hollon-AI Dev

우리는 고품질 소프트웨어를 만드는 팀입니다

Organization Settings:
- Daily Cost Limit: $100.00
- Monthly Cost Limit: $1000.00`;

      organization.contextPrompt = multiLinePrompt;

      expect(organization.contextPrompt).toBe(multiLinePrompt);
      expect(organization.contextPrompt).toContain('\n');
    });
  });

  describe('other fields', () => {
    it('should have name property', () => {
      organization.name = 'Test Organization';
      expect(organization.name).toBe('Test Organization');
    });

    it('should have description property', () => {
      organization.description = 'Test description';
      expect(organization.description).toBe('Test description');
    });

    it('should have settings property', () => {
      organization.settings = { maxHollonsPerTeam: 10 };
      expect(organization.settings).toEqual({ maxHollonsPerTeam: 10 });
    });
  });
});
