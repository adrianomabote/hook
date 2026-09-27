---
name: Silent WhatsApp verification
description: The provider tradeoff behind account checks that do not send messages.
---

The official WhatsApp Cloud API does not document a general silent lookup for arbitrary numbers; its ordinary confirmation path depends on messaging and status events. This project chose Whapi.Cloud's third-party contact check because the user specifically asked not to send messages.

**Why:** Switching to a message-based flow would change the requested behavior, while a third-party checker depends on its own service and a linked WhatsApp channel.

**How to apply:** Preserve the no-message behavior and explain the provider tradeoff before changing verification methods.