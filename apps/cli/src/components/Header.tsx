/**
 * 固定ヘッダーコンポーネント
 */

import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  serverName?: string;
  channelName?: string;
}

export function Header({ serverName, channelName }: HeaderProps): React.ReactElement {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginBottom={1}
    >
      <Text bold color="cyan">
        Connpass CLI
      </Text>
      {serverName && (
        <>
          <Text color="gray"> / </Text>
          <Text color="white">{serverName}</Text>
        </>
      )}
      {channelName && (
        <>
          <Text color="gray"> / </Text>
          <Text color="green">#{channelName}</Text>
        </>
      )}
    </Box>
  );
}
