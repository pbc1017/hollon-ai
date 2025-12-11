/**
 * Experience Level for Hollons
 * SSOT 원칙: 통계적 성과 지표일 뿐, 개별 성장이 아님
 * 같은 Role의 홀론들은 능력 동일 (systemPrompt + Organization Document 접근)
 * experienceLevel은 할당 우선순위 점수로만 사용
 */
export enum ExperienceLevel {
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  LEAD = 'lead',
  PRINCIPAL = 'principal',
}
