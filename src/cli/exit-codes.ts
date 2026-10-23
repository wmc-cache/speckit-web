// Exit codes — see specs/001-speckit-web-scaffold/contracts/cli.md
export const EXIT = {
  OK: 0,
  RUNTIME_ERROR: 1,
  BAD_ARGS: 2,
  NOT_SPECKIT: 3,
  PREREQ_MISSING: 4,
  CANCELLED: 130,
} as const;

export class CliError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
  }
}
