# Connect AI to a remote or headless server

Nopetion keeps its normal private HTTPS address. Initial AI OAuth sign-in returns to the browser's computer at an HTTP numeric-loopback address, with PKCE and a single-use state bound to your authenticated personal account. Tokens stay encrypted in the server's dedicated AI store. This does not read another application's authentication files or enable an API-key fallback.

## One-time connection from a computer

Use Node.js 24 and the source's `scripts/ai-login-bridge.mjs`. Choose unused local ports; the examples leave an existing local Nopetion on port 3000 untouched.

**1. Open an SSH tunnel to your own server.**

```sh
ssh -N -L 127.0.0.1:31999:127.0.0.1:3000 user@your-server
```

This binds only to your computer's loopback interface. Keep the terminal open. Use the actual remote application port if yours differs.

**2. Start the local login bridge in a second terminal.**

```sh
node scripts/ai-login-bridge.mjs \
  --upstream http://127.0.0.1:31999 \
  --mount /nopetion --port 31415
```

Use `--mount /` for a root deployment. The mount must match the app's build-time path. The bridge forwards only to the numeric-loopback SSH tunnel, removes the app mount for HTTP/WebSocket requests and preserves the fixed callback path. It refuses unrelated Host/Origin requests and external proxy targets. It never logs request URLs, cookies or tokens.

**3. Open the printed local settings address in a separate Chrome profile.**

For the example this is `http://127.0.0.1:31415/nopetion/settings/personal-ai`. Sign into Nopetion with your existing server password, then choose **Continue with ChatGPT**. Enter passwords only in the browser. The app's secure-cookie policy is preserved; use a browser that supports secure cookies on numeric loopback.

OAuth returns to `http://127.0.0.1:31415/api/personal-ai/callback`. The server binds this exact address to the authenticated attempt. Existing explicit callback configuration remains fixed and takes precedence; if one is configured, use its displayed port instead of 31415.

After a successful connection, check account/model status on the normal HTTPS address. Close the local bridge and SSH tunnel when finished. The connection remains in the server's encrypted AI store; the bridge does not need to stay running for normal use from a phone or computer.

On a phone, keep using the server's normal HTTPS address. A loopback address refers to the phone itself and cannot reach a bridge running on your computer. AI settings recheck the server when you return to the screen; **Check connection** also refreshes the status. An unavailable status check is shown separately from a disconnected account.

**Disconnect selected account** removes that account's connection from the server, affecting every phone and computer that uses it. The confirmation explains this scope before proceeding. Reconnecting requires a new ChatGPT sign-in from a computer; restoring an old token backup is not a substitute for authorization.

## Validate without exposing personal documents

Use a new synthetic demo document, choose its content scope, inspect the preview and approve a small generation. Verify the saved result after refresh and confirm that disconnect/reconnect works. Provider account access, plan availability and real OAuth/token-refresh behavior require a real account; local fixtures and browser emulation do not establish those results.

The server may transmit only the document scope you approve to the connected provider. A self-hosted app does not make an external provider local. Keep proxy routing, callback state checks and document/attachment permissions intact.
