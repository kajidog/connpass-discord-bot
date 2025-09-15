import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const connpassAgent = new Agent({
    name: 'Connpass Agent',
    instructions: `
You will generate a clear, easy-to-understand Japanese report summarizing Connpass events.
`,
    model: openai("gpt-5-nano"),
    tools: {},
});
