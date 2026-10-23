import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, ProjectResponse } from '../../../src/core/model.ts';
import type { DataState } from '../data/context.ts';
import type { ConnectionState, DataSource } from '../data/source.ts';

/**
 * Loads the project and keeps it fresh: `project` events reload navigation/overview,
 * `document`/`removed` events are exposed via `lastChange` so open documents can refetch or warn.
 */
export function useLiveData(source: DataSource): DataState {
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectVersion, setProjectVersion] = useState(0);
  const [lastChange, setLastChange] = useState<ChangeEvent | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connected');

  const reloadProject = useCallback(() => {
    source
      .getProject()
      .then((p) => {
        setProject(p);
        setProjectError(null);
        setProjectVersion((v) => v + 1);
      })
      .catch((e: unknown) => setProjectError(e instanceof Error ? e.message : String(e)));
  }, [source]);

  useEffect(() => {
    reloadProject();
    return source.subscribe(
      (e) => {
        setLastChange(e);
        if (e.type === 'project') reloadProject();
      },
      (s) => {
        setConnection(s);
        // After a reconnect we may have missed events.
        if (s === 'connected') reloadProject();
      },
    );
  }, [source, reloadProject]);

  return { source, project, projectError, projectVersion, lastChange, connection, reloadProject };
}
