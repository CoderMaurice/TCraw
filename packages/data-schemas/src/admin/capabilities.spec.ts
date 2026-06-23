import { ResourceType } from 'librechat-data-provider';
import {
  CAPABILITY_CATEGORIES,
  CapabilityImplications,
  ResourceCapabilityMap,
  SystemCapabilities,
  isValidCapability,
} from './capabilities';

describe('isValidCapability', () => {
  it.each(Object.values(SystemCapabilities))('accepts base capability: %s', (cap) => {
    expect(isValidCapability(cap)).toBe(true);
  });

  it.each(['manage:configs:endpoints', 'read:configs:registration', 'manage:configs:speech'])(
    'accepts section-level capability: %s',
    (cap) => {
      expect(isValidCapability(cap)).toBe(true);
    },
  );

  it.each(['assign:configs:user', 'assign:configs:group', 'assign:configs:role'])(
    'accepts assignment capability: %s',
    (cap) => {
      expect(isValidCapability(cap)).toBe(true);
    },
  );

  it.each([
    '',
    'fake',
    'god:mode',
    'manage:configs:',
    'manage:configs: spaces',
    'manage:configs:a:b',
    'delete:configs:endpoints',
    'assign:configs:admin',
    'assign:configs:',
    'MANAGE:USERS',
    'manage:users:extra',
    'read:configs:end points',
  ])('rejects invalid capability: "%s"', (cap) => {
    expect(isValidCapability(cap)).toBe(false);
  });
});

describe('knowledge base capabilities', () => {
  it('defines read and manage knowledge base capabilities', () => {
    expect(SystemCapabilities.READ_KNOWLEDGE_BASES).toBe('read:knowledgebases');
    expect(SystemCapabilities.MANAGE_KNOWLEDGE_BASES).toBe('manage:knowledgebases');
    expect(isValidCapability(SystemCapabilities.READ_KNOWLEDGE_BASES)).toBe(true);
    expect(isValidCapability(SystemCapabilities.MANAGE_KNOWLEDGE_BASES)).toBe(true);
  });

  it('maps knowledge base resources to manage capability', () => {
    expect(ResourceCapabilityMap[ResourceType.KNOWLEDGE_BASE]).toBe(
      SystemCapabilities.MANAGE_KNOWLEDGE_BASES,
    );
  });

  it('allows manage knowledge bases to imply read knowledge bases', () => {
    expect(CapabilityImplications[SystemCapabilities.MANAGE_KNOWLEDGE_BASES]).toContain(
      SystemCapabilities.READ_KNOWLEDGE_BASES,
    );
  });

  it('lists knowledge base capabilities in the content category', () => {
    const contentCategory = CAPABILITY_CATEGORIES.find((category) => category.key === 'content');

    expect(contentCategory?.capabilities).toEqual(
      expect.arrayContaining([
        SystemCapabilities.MANAGE_KNOWLEDGE_BASES,
        SystemCapabilities.READ_KNOWLEDGE_BASES,
      ]),
    );
  });
});
