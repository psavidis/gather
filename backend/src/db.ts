import { Table, type Codec, type Spreadsheet } from './spreadsheet';

export type Role = 'admin' | 'member';

export interface User {
  userId: string;
  email: string;
  googleSubject: string;
  displayName: string;
  role: Role;
  enabled: boolean;
  createdAt: string;
}

const bool = (value: boolean) => (value ? 'TRUE' : 'FALSE');
const parseBool = (cell: string) => cell.trim().toUpperCase() === 'TRUE';

const userCodec: Codec<User> = {
  columns: ['userId', 'email', 'googleSubject', 'displayName', 'role', 'enabled', 'createdAt'],
  toRow: (u) => [
    u.userId,
    u.email,
    u.googleSubject,
    u.displayName,
    u.role,
    bool(u.enabled),
    u.createdAt,
  ],
  fromRow: ([userId, email, googleSubject, displayName, role, enabled, createdAt]) => ({
    userId,
    email: email.trim().toLowerCase(),
    googleSubject,
    displayName,
    role: role.trim() === 'admin' ? 'admin' : 'member',
    enabled: parseBool(enabled),
    createdAt,
  }),
};

/** Table name → codec; also defines each sheet's header row. */
export const SCHEMA = {
  Users: userCodec,
} as const;

export type Db = ReturnType<typeof openDb>;

export function openDb(sheet: Spreadsheet) {
  return {
    users: new Table(sheet, 'Users', SCHEMA.Users),
  };
}
