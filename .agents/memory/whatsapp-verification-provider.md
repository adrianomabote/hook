---
name: Silent WhatsApp verification
description: The provider tradeoff behind account checks that do not send messages.
---

The official WhatsApp Cloud API does not document a general silent lookup for arbitrary numbers; its ordinary confirmation path depends on messaging and status events. The user chose Z-API's third-party phone-existence lookup to preserve verification without sending messages.

**Why:** The user explicitly requires silent checks. Z-API documents individual and batch existence-check endpoints; they are separate from the message-sending endpoints.

**How to apply:** Keep requests on Z-API's phone-existence endpoints. Never use a messaging endpoint or change the no-message behavior without asking.

Z-API documents a maximum of 50,000 numbers per batch request. ContactoCheck's maximum is also 50,000 unique numbers per verification; users divide larger lists manually.

**Why:** The user explicitly chose a 50,000-number cap per verification instead of automatically splitting larger lists.

**How to apply:** Keep the client limit, server limit, and provider batch size aligned at 50,000. Larger lists must be divided into separate verifications; do not raise the limit or auto-split them without asking.

## Interpreting provider errors

An upstream HTTP 400 from a silent Z-API check does not establish that the phone number is invalid. Credential or instance lookup failures can also arrive as 400 responses; use the sanitized provider message to distinguish them.

**Why:** During setup, correcting the account Client-Token changed the provider response from a Client-Token configuration error to `Instance not found`, while the number itself was unchanged.

**How to apply:** Stop repeated or bulk checks after a 400. Surface only sanitized provider details, verify the account token and matching active instance credentials, then retry only after a configuration change.