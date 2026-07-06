import { renderHook } from '@testing-library/react';
import { SystemRoles } from 'librechat-data-provider';
import useSideNavLinks from './useSideNavLinks';
import { useAuthContext } from '~/hooks';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('@librechat/client', () => ({
  MCPIcon: () => null,
  AttachmentIcon: () => null,
  OpenAIMinimalIcon: () => null,
}), { virtual: true });

jest.mock('librechat-data-provider', () => {
  const actual = jest.requireActual('librechat-data-provider');

  return {
    ...actual,
    isParamEndpoint: () => false,
    isAgentsEndpoint: () => false,
    isAssistantsEndpoint: () => false,
  };
});

jest.mock('~/hooks', () => ({
  useAgentCapabilities: () => ({ skillsEnabled: false }),
  useMCPServerManager: () => ({ availableMCPServers: [] }),
  useGetAgentsConfig: () => ({ agentsConfig: undefined }),
  useHasAccess: () => false,
  useAuthContext: jest.fn(),
}));

jest.mock('~/components/SidePanel/MCPBuilder/MCPBuilderPanel', () => () => null);
jest.mock('~/components/SidePanel/Agents/AgentPanelSwitch', () => () => null);
jest.mock('~/components/SidePanel/Builder/PanelSwitch', () => () => null);
jest.mock('~/components/SidePanel/Parameters/Panel', () => () => null);
jest.mock('~/components/SidePanel/Memories', () => ({ MemoryPanel: () => null }));
jest.mock('~/components/SidePanel/Files/Panel', () => () => null);
jest.mock('~/components/Skills', () => ({ SkillsAccordion: () => null }));

const baseArgs = {
  keyProvided: true,
  interfaceConfig: {},
  endpointsConfig: {},
  includeHidePanel: false,
};

describe('useSideNavLinks admin people link', () => {
  it('shows people link for admins', () => {
    (useAuthContext as jest.Mock).mockReturnValue({ user: { role: SystemRoles.ADMIN } });

    const { result } = renderHook(() => useSideNavLinks(baseArgs));

    expect(result.current.some((link) => link.id === 'admin-users')).toBe(true);
  });

  it('hides people link for non-admins', () => {
    (useAuthContext as jest.Mock).mockReturnValue({ user: { role: 'USER' } });

    const { result } = renderHook(() => useSideNavLinks(baseArgs));

    expect(result.current.some((link) => link.id === 'admin-users')).toBe(false);
  });
});
