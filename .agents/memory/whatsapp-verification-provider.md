---
name: Silent WhatsApp verification
description: The provider tradeoff behind account checks that do not send messages.
---

The official WhatsApp Cloud API does not document a general silent lookup for arbitrary numbers; its ordinary confirmation path depends on messaging and status events. This project chose Whapi.Cloud's third-party contact check because the user specifically asked not to send messages.

**Why:** Switching to a message-based flow would change the requested behavior, while a third-party checker depends on its own service and a linked WhatsApp channel.

**How to apply:** Preserve the no-message behavior and explain the provider tradeoff before changing verification methods.

The user chose to send up to 1,500 unique numbers in one provider request rather than split them into smaller calls. Whapi's public OpenAPI schema for `POST /contacts` does not specify a maximum array size, but acceptance of a 1,500-number request has not been live-tested.

**Why:** The user explicitly asked to remove the per-call cap while retaining the 1,500-number consultation limit; silently reintroducing 100-number chunks would undo that decision.

**How to apply:** Keep client and server limits aligned at 1,500 per consultation. If Whapi rejects a large request, surface the provider error and confirm a compatible limit with the user rather than silently splitting it.