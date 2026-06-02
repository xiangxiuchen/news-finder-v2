'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CollectionItem } from '@/types';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token: string; error?: string }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
    gapi?: {
      load: (api: string, callback: () => void) => void;
      client: {
        setToken: (token: { access_token: string }) => void;
        request: (config: { path: string; method: string; body?: string }) => Promise<{ result: unknown; status: number }>;
      };
    };
  }
}

const FILE_NAME = 'newsfinder-collections.json';
const MIME_FOLDER = 'application/vnd.google-apps.folder';
const MIME_JSON = 'application/json';

type SyncStatus = 'idle' | 'connecting' | 'syncing' | 'success' | 'error';

export function useGoogleDrive() {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  const signIn = useCallback(() => {
    if (!clientId) {
      setError('请在 .env.local 中设置 NEXT_PUBLIC_GOOGLE_CLIENT_ID');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setError(null);

    const client = window.google?.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        if (response.access_token) {
          setAccessToken(response.access_token);
          setStatus('idle');
        } else {
          setError(response.error || '认证失败');
          setStatus('error');
        }
      },
    });
    client?.requestAccessToken();
  }, [clientId]);

  const signOut = useCallback(() => {
    setAccessToken(null);
    setStatus('idle');
    setError(null);
  }, []);

  const ensureFolder = async (token: string): Promise<string> => {
    // Search for existing folder
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME.replace("'", "\\'")}' and mimeType='${MIME_FOLDER}' and trashed=false&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();

    if (searchData.files?.length > 0) {
      return searchData.files[0].id;
    }

    // Create folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'NewsFinder',
        mimeType: MIME_FOLDER,
      }),
    });
    const folder = await createRes.json();
    return folder.id;
  };

  const findFile = async (token: string, folderId: string): Promise<string | null> => {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and '${folderId}' in parents and trashed=false&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    return data.files?.length > 0 ? data.files[0].id : null;
  };

  const upload = useCallback(
    async (items: CollectionItem[]) => {
      if (!accessToken) return;
      setStatus('syncing');
      setError(null);

      try {
        const folderId = await ensureFolder(accessToken);
        const existingId = await findFile(accessToken, folderId);

        const body = JSON.stringify({
          exportedAt: new Date().toISOString(),
          items,
        });

        if (existingId) {
          // Update existing file
          await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': MIME_JSON,
              },
              body,
            }
          );
        } else {
          // Create new file
          const metadataRes = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}` },
              body: (() => {
                const boundary = 'boundary' + Date.now();
                const parts = [
                  `--${boundary}`,
                  'Content-Type: application/json; charset=UTF-8',
                  '',
                  JSON.stringify({ name: FILE_NAME, parents: [folderId] }),
                  `--${boundary}`,
                  'Content-Type: application/json',
                  '',
                  body,
                  `--${boundary}--`,
                ];
                return new Blob(parts, { type: `multipart/related; boundary=${boundary}` });
              })(),
            }
          );
          if (!metadataRes.ok) throw new Error('上传失败');
        }

        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : '同步失败');
        setStatus('error');
      }
    },
    [accessToken]
  );

  const download = useCallback(async (): Promise<CollectionItem[] | null> => {
    if (!accessToken) return null;
    setStatus('syncing');

    try {
      const folderId = await ensureFolder(accessToken);
      const fileId = await findFile(accessToken, folderId);
      if (!fileId) {
        setStatus('idle');
        return null;
      }

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!res.ok) throw new Error('下载失败');
      const data = await res.json();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
      return data.items || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载失败');
      setStatus('error');
      return null;
    }
  }, [accessToken]);

  return {
    status,
    error,
    accessToken,
    signedIn: !!accessToken,
    signIn,
    signOut,
    upload,
    download,
  };
}
