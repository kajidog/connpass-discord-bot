import type { ChatInputCommandInteraction } from 'discord.js';
import type { IAdminStore, IBanStore, AdminUser, BannedUser } from '@connpass-discord-bot/core';
import { hasAnyAdmin, isAdminUser, isBannedUser } from '../../security/permissions.js';

const BAN_MESSAGE = '⛔ あなたはBANされているため、この操作は実行できません。';
const ADMIN_ONLY_MESSAGE = '⛔ この操作は管理者のみ実行できます。';

/**
 * /connpass admin ハンドラー
 */
export async function handleAdminCommand(
  interaction: ChatInputCommandInteraction,
  adminStore: IAdminStore,
  banStore: IBanStore
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const requesterId = interaction.user.id;

  if (await isBannedUser(banStore, requesterId)) {
    await interaction.reply({ content: BAN_MESSAGE, ephemeral: true });
    return;
  }

  const hasAdmins = await hasAnyAdmin(adminStore);
  const isAdmin = await isAdminUser(adminStore, requesterId);

  if (subcommand !== 'add' && !isAdmin) {
    await interaction.reply({ content: ADMIN_ONLY_MESSAGE, ephemeral: true });
    return;
  }

  if (subcommand === 'add' && hasAdmins && !isAdmin) {
    await interaction.reply({ content: ADMIN_ONLY_MESSAGE, ephemeral: true });
    return;
  }

  switch (subcommand) {
    case 'add':
      await handleAdminAdd(interaction, adminStore, requesterId, hasAdmins);
      break;
    case 'remove':
      await handleAdminRemove(interaction, adminStore);
      break;
    case 'ban':
      await handleAdminBan(interaction, banStore, requesterId);
      break;
    case 'unban':
      await handleAdminUnban(interaction, banStore);
      break;
    case 'list':
      await handleAdminList(interaction, adminStore, banStore);
      break;
    default:
      await interaction.reply({ content: '未知のサブコマンドです', ephemeral: true });
  }
}

async function handleAdminAdd(
  interaction: ChatInputCommandInteraction,
  adminStore: IAdminStore,
  requesterId: string,
  hasAdmins: boolean
): Promise<void> {
  const target = interaction.options.getUser('user', true);
  const existing = await adminStore.find(target.id);
  if (existing) {
    await interaction.reply({
      content: `⚠️ <@${target.id}> はすでに管理者です。`,
      ephemeral: true,
    });
    return;
  }

  const admin: AdminUser = {
    discordUserId: target.id,
    addedAt: new Date().toISOString(),
    addedBy: hasAdmins ? requesterId : undefined,
  };

  await adminStore.save(admin);

  const note = hasAdmins ? '' : '（管理者未登録のため、初回登録として受理しました）';
  await interaction.reply({
    content: `✅ <@${target.id}> を管理者に追加しました。${note}`,
    ephemeral: true,
  });
}

async function handleAdminRemove(
  interaction: ChatInputCommandInteraction,
  adminStore: IAdminStore
): Promise<void> {
  const target = interaction.options.getUser('user', true);
  const existing = await adminStore.find(target.id);
  if (!existing) {
    await interaction.reply({
      content: `⚠️ <@${target.id}> は管理者ではありません。`,
      ephemeral: true,
    });
    return;
  }

  await adminStore.delete(target.id);
  await interaction.reply({
    content: `✅ <@${target.id}> を管理者から削除しました。`,
    ephemeral: true,
  });
}

async function handleAdminBan(
  interaction: ChatInputCommandInteraction,
  banStore: IBanStore,
  requesterId: string
): Promise<void> {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') ?? undefined;

  const existing = await banStore.find(target.id);
  if (existing) {
    await interaction.reply({
      content: `⚠️ <@${target.id}> はすでにBANされています。`,
      ephemeral: true,
    });
    return;
  }

  const ban: BannedUser = {
    discordUserId: target.id,
    bannedAt: new Date().toISOString(),
    bannedBy: requesterId,
    reason,
  };

  await banStore.save(ban);

  await interaction.reply({
    content: `✅ <@${target.id}> をBANしました。${reason ? `\n理由: ${reason}` : ''}`,
    ephemeral: true,
  });
}

async function handleAdminUnban(
  interaction: ChatInputCommandInteraction,
  banStore: IBanStore
): Promise<void> {
  const target = interaction.options.getUser('user', true);
  const existing = await banStore.find(target.id);
  if (!existing) {
    await interaction.reply({
      content: `⚠️ <@${target.id}> はBANされていません。`,
      ephemeral: true,
    });
    return;
  }

  await banStore.delete(target.id);
  await interaction.reply({
    content: `✅ <@${target.id}> のBANを解除しました。`,
    ephemeral: true,
  });
}

async function handleAdminList(
  interaction: ChatInputCommandInteraction,
  adminStore: IAdminStore,
  banStore: IBanStore
): Promise<void> {
  const type = (interaction.options.getString('type') ?? 'all') as 'admins' | 'bans' | 'all';
  const admins: AdminUser[] = type === 'bans' ? [] : await adminStore.list();
  const bans: BannedUser[] = type === 'admins' ? [] : await banStore.list();

  let message = '📋 **管理者/BAN一覧**\n\n';

  if (type === 'admins' || type === 'all') {
    message += `**管理者 (${admins.length})**\n`;
    if (admins.length === 0) {
      message += '（なし）\n\n';
    } else {
      message += admins
        .map((admin) => `- <@${admin.discordUserId}> ${admin.addedAt ? `(${admin.addedAt})` : ''}`)
        .join('\n');
      message += '\n\n';
    }
  }

  if (type === 'bans' || type === 'all') {
    message += `**BAN (${bans.length})**\n`;
    if (bans.length === 0) {
      message += '（なし）';
    } else {
      message += bans
        .map((ban) => {
          const reason = ban.reason ? ` - ${ban.reason}` : '';
          return `- <@${ban.discordUserId}> ${ban.bannedAt ? `(${ban.bannedAt})` : ''}${reason}`;
        })
        .join('\n');
    }
  }

  await interaction.reply({ content: message.trimEnd(), ephemeral: true });
}
