import type { TSkill, TSkillSummary } from 'librechat-data-provider';

type DisplayableSkill = Pick<TSkill | TSkillSummary, 'name' | 'displayTitle'>;

export function getSkillDisplayName(skill: DisplayableSkill): string {
  const displayTitle = skill.displayTitle?.trim();
  return displayTitle && displayTitle.length > 0 ? displayTitle : skill.name;
}
