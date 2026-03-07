---
"@connpass-discord-bot/discord-bot": patch
---

Fix feed setting lookup in AI agent conversations inside Discord threads.

When users talked to the bot in a thread, feed management tools were using the thread ID as `channelId`, which caused configured feeds on the parent channel to appear as unset. The runtime context now consistently uses the configuration channel ID (parent channel for threads), so feed status/update operations resolve the correct feed.

Also fix `/connpass model` behavior in threads by resolving the configuration target to the parent channel. `set`, `status`, and `reset` now read/write the same channel-level model configuration that the agent uses during threaded conversations.

Additionally, fix other thread-related channel ID mismatches:
- `/connpass feed` commands now resolve feed target channel to the parent channel when run inside a thread (including `run`).
- Button-based AI summaries now resolve model configuration using the parent channel in threads.
