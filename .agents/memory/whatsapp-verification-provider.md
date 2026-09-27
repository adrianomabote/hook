---
name: Silent WhatsApp verification
description: The provider tradeoff behind account checks that do not send messages.
---

The official WhatsApp Cloud API does not document a general silent lookup for arbitrary numbers; its ordinary confirmation path depends on messaging and status events. This project chose Whapi.Cloud's third-party contact check because the user specifically asked not to send messages.

**Why:** Switching to a message-based flow would change the requested behavior, while a third-party checker depends on its own service and a linked WhatsApp channel.

**How to apply:** Preserve the no-message behavior and explain the provider tradeoff before changing verification methods.

The current interface accepts up to 250,000 unique numbers in one user-initiated verification and sends them to Whapi sequentially in batches of up to 1,500. Acceptance of 1,500-number requests and large-job throughput have not been live-tested.

**Why:** The user wants to paste and verify lists over 100,000 numbers in one run without splitting the list manually, while the external service's request and rate limits remain unconfirmed.

**How to apply:** Keep the client and server run limit aligned. Preserve silent, no-message checks; expose progress and provider errors, and leave unreturned numbers as unconfirmed instead of marking them valid.