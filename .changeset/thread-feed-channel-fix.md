---
"@connpass-discord-bot/discord-bot": patch
---

Fix feed setting lookup in AI agent conversations inside Discord threads.

When users talked to the bot in a thread, feed management tools were using the thread ID as `channelId`, which caused configured feeds on the parent channel to appear as unset. The runtime context now consistently uses the configuration channel ID (parent channel for threads), so feed status/update operations resolve the correct feed.
