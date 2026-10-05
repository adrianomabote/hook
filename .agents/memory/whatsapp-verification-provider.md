---
name: Silent WhatsApp verification
description: The provider tradeoff behind account checks that do not send messages.
---

The official WhatsApp Cloud API does not document a general silent lookup for arbitrary numbers; its ordinary confirmation path depends on messaging and status events. The user chose Z-API's third-party phone-existence lookup to preserve verification without sending messages.

**Why:** The user explicitly requires silent checks. Z-API documents individual and batch existence-check endpoints; they are separate from the message-sending endpoints.

**How to apply:** Keep requests on Z-API's phone-existence endpoints. Never use a messaging endpoint or change the no-message behavior without asking.

The user changed the earlier manual-splitting choice: a list may contain up to 100,000 unique numbers, and the checker must automatically verify it in sequential divisions of 1,000 while showing current and total divisions.

**Why:** The user explicitly asked to paste large lists (including 100,000 contacts), split them into blocks of 1,000, and see which division is running.

**How to apply:** Keep the frontend and server limits aligned at 100,000 per list and send no more than 1,000 numbers to the provider per request. Offer WhatsApp contact downloads only from provider-confirmed rows; the existing no-message requirement still applies.

## Interpreting provider errors

An upstream HTTP 400 from a silent Z-API check does not establish that the phone number is invalid. Credential or instance lookup failures can also arrive as 400 responses; use the sanitized provider message to distinguish them.

**Why:** During setup, correcting the account Client-Token changed the provider response from a Client-Token configuration error to `Instance not found`, while the number itself was unchanged.

**How to apply:** Stop repeated or bulk checks after a 400. Surface only sanitized provider details, verify the account token and matching active instance credentials, then retry only after a configuration change.