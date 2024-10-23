// Some of this code is based on the code from https://github.com/val-town/codemirror-khulnasoft/blob/main/src/khulnasoft.ts
// licensed under the ISC License: https://github.com/val-town/codemirror-khulnasoft/blob/main/LICENSE

import { UUID } from '@lumino/coreutils';

import { PromiseClient } from '@connectrpc/connect';
import { LanguageServerService } from './api/proto/exa/language_server_pb/language_server_connect';
import {
  Language,
  Document
} from './api/proto/exa/khulnasoft_common_pb/khulnasoft_common_pb';
import { GetCompletionsResponse } from './api/proto/exa/language_server_pb/language_server_pb';
import { IKhulnasoftConfig } from './config';
import { type PartialMessage } from '@bufbuild/protobuf';

const sessionId = UUID.uuid4();

export async function getKhulnasoftCompletions({
  client,
  text,
  cursorOffset,
  config,
  otherDocuments
}: {
  client: PromiseClient<typeof LanguageServerService>;
  text: string;
  cursorOffset: number;
  config: IKhulnasoftConfig;
  otherDocuments: PartialMessage<Document>[];
}) {
  const lang = config.language;
  const language = Language[lang?.toUpperCase() as keyof typeof Language];
  // TODO(kevin): Propagate extensionVersion and absoluteUri properly
  return await client.getCompletions(
    {
      metadata: {
        ideName: config.ideName,
        ideVersion: config.ideVersion,
        extensionName: 'khulnasoft-jupyter',
        extensionVersion: '2.1.1',
        apiKey: config.apiKey,
        sessionId: sessionId,
        authSource: config.authSource
      },
      document: {
        text: text,
        cursorOffset: BigInt(cursorOffset),
        language,
        editorLanguage: lang ?? 'python',
        lineEnding: '\n',
        absoluteUri: 'file:///untitled.ipynb',
      },
      editorOptions: {
        tabSize: 4n,
        insertSpaces: true
      },
      otherDocuments: otherDocuments,
      multilineConfig: undefined
    },
    {
      // signal,
      headers: {
        Authorization: `Basic ${config.apiKey}-${sessionId}`
      }
    }
  );
}

// TODO (kevin): There are still occasional indentation errors
export function simplifyCompletions(completions: GetCompletionsResponse) {
  return completions.completionItems.map(item => {
    let offset = 0;
    let firstLine = '';
    let remainingLines = '';

    for (const part of item.completionParts) {
      if (part.type === 1) {
        firstLine += part.text;
        offset = Number(part.offset);
      }
      if (part.type === 2) {
        remainingLines = '\n' + part.text;
      }
    }

    return {
      ...item,
      offset: offset,
      completion: firstLine + remainingLines
    };
  });
}
