# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately via GitHub Security Advisories on this repository ("Report a vulnerability"). Do not open public issues for security reports. We aim to acknowledge within 72 hours.

## Scope & design commitments (v0.1)

- All local servers (trace viewer, device port-forwards) bind to `127.0.0.1` only.
- Trace files are treated as untrusted input by the viewer (no eval, no HTML injection; strict parsing).
- Values entered via `fill()` are masked in traces by default.
- Dependencies are locked and audited in CI (fail on high/critical); releases are published to npm with provenance.

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | ✔ (latest release) |
