import { Agent } from '@mastra/core/agent';

export const weatherAgent = new Agent({
  name: 'Connpass Event Search Agent',
  instructions: `
`,
  model: 'openai/gpt-4o-mini',
});
