// node:sqlite is a Node >=22.13 runtime requirement. Remove when @types/node is upgraded.
declare module 'node:sqlite' {
  type Value = string | number | bigint | null | Uint8Array;
  export class StatementSync {
    get(...values: Value[]): Record<string, Value> | undefined;
    all(...values: Value[]): Record<string, Value>[];
    run(...values: Value[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    readonly isTransaction: boolean;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
