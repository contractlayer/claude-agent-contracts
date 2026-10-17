#!/usr/bin/env node
// A contract-signing agent built with the Claude Agent SDK and the eContract MCP server.
//
//   export ECONTRACT_API_KEY=cl_live_...      # https://econtract.online/dashboard/api-keys
//   node agent.mjs "Send <PDF URL> to Jane <jane@example.com> for signature. She signs under PARTY B."
//   node agent.mjs "Which of my contracts are still waiting for signatures?"
//   node agent.mjs --allow-void "Cancel contract CTR-20261017-ABC123, it was sent by mistake."
//
// The agent gets only eContract tools (no shell, no file access), and cancelling a contract is
// off unless you pass --allow-void. Signing is never possible: signers sign through their own link.

import { query } from '@anthropic-ai/claude-agent-sdk';

const KEY = process.env.ECONTRACT_API_KEY;
if (!KEY) {
  console.error('Set ECONTRACT_API_KEY (create one at https://econtract.online/dashboard/api-keys)');
  process.exit(1);
}

const args = process.argv.slice(2);
const allowVoid = args.includes('--allow-void');
const task =
  args.filter((a) => a !== '--allow-void').join(' ') ||
  'Send https://raw.githubusercontent.com/contractlayer/contract-manager/main/samples/service-agreement.pdf ' +
    'for signature to Alice <alice@example.com> (signs under "PARTY A") and then Bob <bob@example.com> (signs under "PARTY B"). ' +
    'Do not email them: give me their signing links.';

// Read and write tools of the eContract MCP server the agent may call without asking
const TOOLS = [
  'send_contract',
  'list_contracts',
  'get_contract',
  'get_signing_links',
  'send_reminder',
  'download_signed_document',
  'get_audit_trail',
  'list_templates',
  'get_template',
  'verify_pdf',
  ...(allowVoid ? ['void_contract'] : []),
].map((name) => `mcp__econtract__${name}`);

const SYSTEM = [
  'You manage contracts in eContract through its MCP tools.',
  'The person running you has already confirmed the recipients and the document in their request, so you may send without asking again.',
  'Use delivery "link" unless they ask for emails, and give each signer only their own link.',
  'When they say where someone signs ("signs under PARTY A"), pass that text as the signer\'s signatureAnchor.',
  'After send_contract, call get_contract until processingStatus is "ready" (or report the processingError), then get_signing_links.',
  'You can never sign or decline for anyone. Answer briefly.',
].join(' ');

const stream = query({
  prompt: task,
  options: {
    systemPrompt: SYSTEM,
    mcpServers: {
      econtract: { type: 'http', url: 'https://api.econtract.online/mcp', headers: { Authorization: `Bearer ${KEY}` } },
    },
    tools: [], // no built-in tools (shell, files, web): eContract only
    allowedTools: TOOLS,
    permissionMode: 'dontAsk', // anything not in allowedTools is denied, not prompted
    maxTurns: 20,
  },
});

for await (const message of stream) {
  if (message.type === 'assistant') {
    for (const block of message.message.content) {
      if (block.type === 'tool_use') console.log(`→ ${block.name.replace('mcp__econtract__', '')} ${JSON.stringify(block.input).slice(0, 160)}`);
      else if (block.type === 'text' && block.text.trim()) console.log(block.text.trim());
    }
  } else if (message.type === 'result') {
    if (message.subtype !== 'success') {
      console.error(`Agent stopped: ${message.subtype}`);
      process.exitCode = 1;
    }
    console.log(`\n(${message.num_turns} turns, ${(message.duration_ms / 1000).toFixed(1)} s)`);
  }
}
