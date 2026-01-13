export interface AccessControlConfig {
  allowedUserIds: string[];
  blockedUserIds: string[];
  allowedRoleIds: string[];
  blockedRoleIds: string[];
}

export function parseIdList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getAccessControlConfigFromEnv(prefix: string): AccessControlConfig {
  return {
    allowedUserIds: parseIdList(process.env[`${prefix}_ALLOWED_USER_IDS`]),
    blockedUserIds: parseIdList(process.env[`${prefix}_BLOCKED_USER_IDS`]),
    allowedRoleIds: parseIdList(process.env[`${prefix}_ALLOWED_ROLE_IDS`]),
    blockedRoleIds: parseIdList(process.env[`${prefix}_BLOCKED_ROLE_IDS`]),
  };
}

export function isAccessAllowed(
  userId: string,
  roleIds: string[],
  config: AccessControlConfig
): boolean {
  if (config.blockedUserIds.includes(userId)) return false;
  if (roleIds.some((roleId) => config.blockedRoleIds.includes(roleId))) return false;

  const hasAllowList =
    config.allowedUserIds.length > 0 || config.allowedRoleIds.length > 0;
  if (!hasAllowList) return true;

  if (config.allowedUserIds.includes(userId)) return true;
  if (roleIds.some((roleId) => config.allowedRoleIds.includes(roleId))) return true;

  return false;
}
