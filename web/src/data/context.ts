import { createContext, useContext } from 'react';
import type { ChangeEvent, ProjectResponse } from '../../../src/core/model.ts';
import type { ConnectionState, DataSource } from './source.ts';

export interface DataState {
  source: DataSource;
  project: ProjectResponse | null;
  projectError: string | null;
  /** Increments whenever project-level data changed (structure, counts). */
  projectVersion: number;
  lastChange: ChangeEvent | null;
  connection: ConnectionState;
  reloadProject: () => void;
}

export const DataContext = createContext<DataState | null>(null);

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('DataContext missing');
  return ctx;
}
