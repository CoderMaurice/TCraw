import {
  AgentCapabilities,
  ArtifactModes,
  ImageDetail,
  ReasoningEffort,
  ReasoningSummary,
  Tools,
  Verbosity,
} from 'librechat-data-provider';
import { getDefaultAgentFormValues } from '../forms';

describe('getDefaultAgentFormValues', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults new agents to code execution and shadcn artifacts while search features stay off', () => {
    const values = getDefaultAgentFormValues();

    expect(values[Tools.execute_code]).toBe(true);
    expect(values[Tools.file_search]).toBe(false);
    expect(values[Tools.web_search]).toBe(false);
    expect(values[AgentCapabilities.artifacts]).toBe(ArtifactModes.SHADCNUI);
    expect(values.skills_enabled).toBe(true);
  });

  it('defaults new agents to the ChatGPT gpt-5.5 model settings', () => {
    localStorage.setItem('LAST_AGENT_MODEL', 'gpt-4o');
    localStorage.setItem('LAST_AGENT_PROVIDER', 'openAI');

    const values = getDefaultAgentFormValues();

    expect(values.provider).toEqual({ label: 'ChatGPT', value: 'ZT' });
    expect(values.model).toBe('gpt-5.5');
    expect(values.model_parameters).toEqual({
      temperature: 0.5,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stop: [],
      resendFiles: true,
      imageDetail: ImageDetail.auto,
      reasoning_effort: ReasoningEffort.medium,
      reasoning_summary: ReasoningSummary.auto,
      verbosity: Verbosity.none,
      useResponsesApi: true,
      web_search: true,
      disableStreaming: false,
    });
  });
});
