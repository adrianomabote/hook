---
name: Silent WhatsApp verification
description: The provider tradeoff behind account checks that do not send messages.
---

The official WhatsApp Cloud API does not document a general silent lookup for arbitrary numbers; its ordinary confirmation path depends on messaging and status events. The user chose Z-API's third-party phone-existence lookup to preserve verification without sending messages.

**Why:** The user explicitly requires silent checks. Z-API documents individual and batch existence-check endpoints; they are separate from the message-sending endpoints.

**How to apply:** Keep requests on Z-API's phone-existence endpoints. Never use a messaging endpoint or change the no-message behavior without asking.

Z-API documents a maximum of 50,000 numbers per batch request. This API limit does not establish the user's plan quota or prove that a 250,000-number run will complete successfully.

**Why:** The user wants to verify lists over 100,000 numbers in one run, but account-specific limits and large-job throughput still require a live test.

**How to apply:** Keep the client and server batch sizes aligned. Preserve the 250,000 unique-number run limit, show progress and provider errors, and leave unreturned numbers unconfirmed instead of marking them valid.