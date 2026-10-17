# claude-agent-contracts

A contract-signing agent in ~80 lines, built with the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) and the [eContract](https://econtract.online) MCP server. Tell it in plain words what to send, to whom and where each person signs; it sends the contract, waits until the document is ready and hands you the signing links.

```text
$ node agent.mjs "Send <PDF URL> to Alice <alice@example.com> (signs under PARTY A) and then Bob <bob@example.com> (signs under PARTY B). Give me their links."
→ send_contract {"title":"Service Agreement","fileUrl":"https://raw.githubusercontent.com/…","signers":[…]}
→ get_contract {"contractId":"0ed49013-…"}
→ get_signing_links {"contractId":"0ed49013-…"}
I sent the Service Agreement (contract CTR-20261017-27SPFE) for signature. No emails went out.
- Alice (alice@example.com), signs first under "PARTY A": https://econtract.online/sign/93700b…
- Bob (bob@example.com), signs second under "PARTY B": https://econtract.online/sign/f165aa…
Bob can sign only after Alice has signed.
(4 turns, 10.0 s)
```

## Run it

Requirements: Node.js 18+, and Claude access for the Agent SDK (an `ANTHROPIC_API_KEY`, or a signed-in Claude Code on the same machine).

```bash
git clone https://github.com/contractlayer/claude-agent-contracts && cd claude-agent-contracts
npm install
export ECONTRACT_API_KEY=cl_live_...   # free account: econtract.online → Dashboard → API keys
npm start                              # sends the sample agreement to two example addresses (links only)
node agent.mjs "Which of my contracts are still waiting for signatures?"
```

## How it is built

[`agent.mjs`](agent.mjs) calls `query()` with:

- **The eContract MCP server** as a remote HTTP server: `https://api.econtract.online/mcp` with `Authorization: Bearer <ECONTRACT_API_KEY>`.
- **Only eContract tools.** `tools: []` removes the built-in tools (shell, files, web); `allowedTools` lists the eContract tools the agent may call, and `permissionMode: 'dontAsk'` denies everything else instead of prompting.
- **No cancelling by default.** `void_contract` is added only with `--allow-void`. Without it the agent explains that it cannot cancel and links the contract in the app.
- **A short system prompt**: send with `delivery: "link"` unless asked for emails, pass "signs under …" as each signer's `signatureAnchor`, poll `get_contract` until the document is ready.

Signing always stays with people: no eContract tool can sign or decline, each signer signs through their own link after confirming a code sent to their email.

## What the eContract tools do here

| Tool | Used for |
|---|---|
| `send_contract` | Create the contract from a PDF/DOCX (base64, public URL or template) and send it; `signatureAnchor` places each signature below a text in the document |
| `get_contract`, `list_contracts` | Readiness, status, who signed |
| `get_signing_links`, `send_reminder` | Personal links (no email), reminders to pending signers |
| `download_signed_document`, `get_audit_trail` | The signed PDF and the signing evidence |
| `void_contract` | Cancel (only with `--allow-void`) |

## More

- Connect the same server to Claude, ChatGPT, Cursor and other clients: [contractlayer/contractlayer → mcp](https://github.com/contractlayer/contractlayer/tree/main/mcp)
- The same operations over REST (Node.js, Python): [contractlayer/contract-manager](https://github.com/contractlayer/contract-manager)
- MCP reference: [developers.econtract.online/docs/mcp](https://developers.econtract.online/docs/mcp)

## License

MIT
