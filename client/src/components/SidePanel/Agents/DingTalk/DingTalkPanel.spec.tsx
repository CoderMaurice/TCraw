import { fireEvent, render, screen } from '@testing-library/react';
import DingTalkPanel from './DingTalkPanel';

const mockUpsert = jest.fn();
const mockDelete = jest.fn();
const mockSetActivePanel = jest.fn();
const mockShowToast = jest.fn();
let mockBinding: {
  id: string;
  agentId: string;
  clientId: string;
  robotCode?: string;
  enabled: boolean;
  status: 'disabled' | 'connecting' | 'connected' | 'error';
  hasClientSecret: boolean;
  createdAt: string;
  updatedAt: string;
} | null = null;

jest.mock('~/data-provider', () => ({
  useDingTalkBindingQuery: () => ({
    data: { binding: mockBinding },
    isLoading: false,
  }),
  useUpsertDingTalkBindingMutation: () => ({ mutate: mockUpsert, isLoading: false }),
  useDeleteDingTalkBindingMutation: () => ({ mutate: mockDelete, isLoading: false }),
}));

jest.mock('~/Providers', () => ({
  useAgentPanelContext: () => ({
    agent_id: 'agent-1',
    setActivePanel: mockSetActivePanel,
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
  SecretInput: ({
    controlsOnHover: _controlsOnHover,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { controlsOnHover?: boolean }) => (
    <input type="password" {...props} />
  ),
  Spinner: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props} />,
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & {
    checked: boolean;
    onCheckedChange: (value: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
      {...props}
    />
  ),
  useToastContext: () => ({ showToast: mockShowToast }),
}));

describe('DingTalkPanel', () => {
  beforeEach(() => {
    mockBinding = null;
    mockUpsert.mockReset();
    mockDelete.mockReset();
    mockSetActivePanel.mockReset();
    mockShowToast.mockReset();
  });

  it('requires Client ID and Client Secret for a new binding', () => {
    render(<DingTalkPanel />);

    const saveButton = screen.getByRole('button', { name: 'com_ui_save' });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('com_ui_client_id'), {
      target: { value: 'ding-client-id' },
    });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('com_ui_client_secret'), {
      target: { value: 'ding-client-secret' },
    });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);
    expect(mockUpsert).toHaveBeenCalledWith({
      clientId: 'ding-client-id',
      clientSecret: 'ding-client-secret',
      enabled: true,
    });
  });

  it('keeps the stored secret when editing with an empty secret field', () => {
    mockBinding = {
      id: 'binding-1',
      agentId: 'agent-1',
      clientId: 'ding-client-id',
      robotCode: 'robot-1',
      enabled: true,
      status: 'connected',
      hasClientSecret: true,
      createdAt: '2026-07-16T00:00:00.000Z',
      updatedAt: '2026-07-16T00:00:00.000Z',
    };

    render(<DingTalkPanel />);

    expect(screen.getByDisplayValue('ding-client-id')).toBeInTheDocument();
    expect(screen.getByDisplayValue('robot-1')).toBeInTheDocument();
    expect(screen.getByText('com_ui_dingtalk_status_connected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_save' }));
    expect(mockUpsert).toHaveBeenCalledWith({
      clientId: 'ding-client-id',
      robotCode: 'robot-1',
      enabled: true,
    });
  });
});
