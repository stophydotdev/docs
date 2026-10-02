// Setup chooser shared by the introduction and the MCP pages.
// variant: "keyless" (default, no key), "key" (API key header) or "signin" (browser sign-in on mcp.stophy.dev/mcp).
// Keep each command aligned with the corresponding client's current config format.
export const McpClientSelector = ({ variant = "keyless", showSeeAll = true }) => {
  const url = variant === "signin" ? "https://mcp.stophy.dev/mcp" : "https://api.stophy.dev/mcp";
  const withKey = variant === "key";
  const json = (lines) => lines.join("\n");
  const cursorConfig = withKey
    ? json(["{", '  "mcpServers": {', '    "stophy": {', `      "url": "${url}",`, '      "headers": {', '        "Authorization": "Bearer YOUR_STOPHY_API_KEY"', "      }", "    }", "  }", "}"])
    : json(["{", '  "mcpServers": {', '    "stophy": {', `      "url": "${url}"`, "    }", "  }", "}"]);
  const opencodeConfig = withKey
    ? json(["{", '  "$schema": "https://opencode.ai/config.json",', '  "mcp": {', '    "stophy": {', '      "type": "remote",', `      "url": "${url}",`, '      "enabled": true,', '      "headers": {', '        "Authorization": "Bearer {env:STOPHY_API_KEY}"', "      }", "    }", "  }", "}"])
    : json(["{", '  "$schema": "https://opencode.ai/config.json",', '  "mcp": {', '    "stophy": {', '      "type": "remote",', `      "url": "${url}",`, '      "enabled": true', "    }", "  }", "}"]);
  const clients = [
    {
      id: "codex",
      name: "Codex",
      detail: "Run in terminal",
      icon: "/images/agent-clients/codex.svg",
      command: withKey
        ? `codex mcp add stophy --url ${url} --bearer-token-env-var STOPHY_API_KEY`
        : `codex mcp add stophy --url ${url}`,
      description: withKey
        ? "Run this in a terminal where STOPHY_API_KEY is set. Codex reads the key when it starts."
        : variant === "signin"
          ? "Run this in a terminal, then run codex mcp login stophy to sign in with your browser."
          : "Run this in a terminal. No key needed.",
      hint: "Run codex mcp list to check the connection.",
    },
    {
      id: "claude",
      name: "Claude Code",
      detail: "Run in terminal",
      icon: "/images/agent-clients/claude-code.svg",
      command: withKey
        ? `claude mcp add --transport http stophy ${url} --header "Authorization: Bearer $STOPHY_API_KEY"`
        : `claude mcp add --transport http stophy ${url}`,
      description: withKey
        ? "Run this in a terminal where STOPHY_API_KEY is set. Claude Code saves the expanded header in your local config."
        : variant === "signin"
          ? "Run this in a terminal. Then run /mcp in Claude Code, choose stophy, and pick Authenticate to sign in with your browser."
          : "Run this in a terminal. No key needed.",
      hint: "Run claude mcp get stophy to check the connection.",
    },
    {
      id: "cursor",
      name: "Cursor",
      detail: "Copy config",
      icon: "/images/agent-clients/cursor.svg",
      codeLabel: "mcp.json",
      code: cursorConfig,
      description: withKey
        ? "Add this to ~/.cursor/mcp.json and replace YOUR_STOPHY_API_KEY with your key."
        : variant === "signin"
          ? "Add this to ~/.cursor/mcp.json. Cursor opens your browser to sign in."
          : "Add this to ~/.cursor/mcp.json. No key needed.",
      hint: "Restart Cursor, then check the MCP section in Settings.",
    },
    {
      id: "opencode",
      name: "OpenCode",
      detail: "Copy config",
      icon: "/images/agent-clients/opencode.svg",
      codeLabel: "opencode.json",
      code: opencodeConfig,
      description: withKey
        ? "Add this to opencode.json. Set STOPHY_API_KEY in your environment."
        : variant === "signin"
          ? "Add this to opencode.json. OpenCode opens your browser to sign in."
          : "Add this to opencode.json. No key needed.",
      hint: "Run opencode mcp list to check the connection.",
    },
  ];
  const subtitle =
    variant === "signin"
      ? "Sign in with your browser. Every endpoint, billed to your account."
      : withKey
        ? "Use your API key for every endpoint."
        : "Start with no API key. Add a key or sign in for every endpoint.";
  const footer =
    variant === "signin"
      ? "Use this URL with Streamable HTTP. Your client starts the browser sign-in."
      : "Use this URL with Streamable HTTP. Add an Authorization: Bearer <key> header for every endpoint.";
  const [activeId, setActiveId] = useState("codex");
  const [copied, setCopied] = useState(false);
  const active = clients.find((client) => client.id === activeId);

  const select = (client) => {
    setActiveId(client.id);
    setCopied(false);
  };
  const onTabKeyDown = (event, index) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % clients.length;
    else if (event.key === "ArrowLeft") next = (index + clients.length - 1) % clients.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = clients.length - 1;
    else return;
    event.preventDefault();
    select(clients[next]);
    document.getElementById("stophy-mcp-tab-" + clients[next].id)?.focus();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active.command || active.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="stophy-mcp-selector not-prose" aria-labelledby="stophy-mcp-heading">
      <div className="stophy-mcp-header">
        <div>
          <h3 id="stophy-mcp-heading">Set up Stophy MCP</h3>
          <p>{subtitle}</p>
        </div>
        {showSeeAll && <a href="/mcp-server">See all setup options <span aria-hidden="true">→</span></a>}
      </div>
      <div className="stophy-mcp-tabs" role="tablist" aria-label="Choose an MCP client">
        {clients.map((client, index) => (
          <button
            key={client.id}
            id={"stophy-mcp-tab-" + client.id}
            type="button"
            role="tab"
            aria-selected={activeId === client.id}
            aria-controls="stophy-mcp-panel"
            tabIndex={activeId === client.id ? 0 : -1}
            className={activeId === client.id ? "is-active" : ""}
            onClick={() => select(client)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            <img className="stophy-client-mark" src={client.icon} alt="" width={26} height={26} aria-hidden="true" />
            <strong>{client.name}</strong>
            <span>{client.detail}</span>
          </button>
        ))}
      </div>
      <div
        id="stophy-mcp-panel"
        className="stophy-mcp-panel"
        role="tabpanel"
        aria-labelledby={"stophy-mcp-tab-" + active.id}
      >
        <p>{active.description}</p>
        <div className={active.code ? "stophy-mcp-code is-multiline" : "stophy-mcp-code"}>
          {active.code && <div className="stophy-mcp-code-label">{active.codeLabel}</div>}
          <div className="stophy-mcp-code-body">
            {active.command ? <><span aria-hidden="true">$</span><code>{active.command}</code></> : <pre><code>{active.code}</code></pre>}
            <button type="button" onClick={copy} aria-label={copied ? "Copied setup" : "Copy setup"}>
              {copied ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
              )}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>
        <p className="stophy-mcp-hint">{active.hint}</p>
      </div>
      <div className="stophy-mcp-footer">
        <span><strong>Using another MCP client?</strong> <code>{url}</code></span>
        <span>{footer}</span>
      </div>
      <span className="stophy-sr-only" aria-live="polite">{copied ? "Setup copied." : ""}</span>
    </section>
  );
};
