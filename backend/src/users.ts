export type Role = 'admin' | 'member';

export interface AllowlistEntry {
  email: string;
  googleSubject: string;
  displayName: string;
  role: Role;
  enabled: boolean;
  createdAt: Date;
}

export interface UserStore {
  findByEmail(email: string): AllowlistEntry | undefined;
  add(entry: AllowlistEntry): void;
  recordGoogleSubject(email: string, subject: string): void;
}
