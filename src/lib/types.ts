export type DatasetStatus = 'failed' | 'uploaded' | 'parsing' | 'parsed' | 'complete';

export type DatasetMetadata = {
  id: string;
  name: string;
  type: 'youtube_history';
  raw_type: 'json' | 'html';
  raw_path: string;
  db_path: string | null;
  created_at: string;
  status: DatasetStatus;
  error?: string | null;
};