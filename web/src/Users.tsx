import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Role } from '../../backend/src/db';
import type { UserListing } from '../../backend/src/users';
import { useSession } from './session';

export function Users() {
  const { call, user: me } = useSession();
  const [users, setUsers] = useState<UserListing[]>();
  const [problem, setProblem] = useState<string>();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');

  const run = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      setProblem(undefined);
      try {
        await call(action, payload);
        setUsers(await call<UserListing[]>('listUsers'));
        return true;
      } catch (error) {
        setProblem((error as Error).message);
        return false;
      }
    },
    [call],
  );

  useEffect(() => {
    call<UserListing[]>('listUsers').then(setUsers, (error: Error) => setProblem(error.message));
  }, [call]);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (await run('addUser', { email, role })) setEmail('');
  }

  function remove(user: UserListing) {
    if (window.confirm(`Remove ${user.email}? They will no longer be able to sign in.`)) {
      void run('removeUser', { userId: user.userId });
    }
  }

  return (
    <section>
      <h2>Users</h2>
      <form className="inline-form" onSubmit={add}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit">Add user</button>
      </form>
      {problem && <p role="alert">{problem}</p>}
      {!users && !problem && <p>Loading…</p>}
      <ul className="cards" aria-label="Authorized users">
        {users?.map((user) => (
          <li key={user.userId} aria-label={user.email}>
            <div>
              <strong>{user.email}</strong>
              {user.displayName && <span className="muted"> · {user.displayName}</span>}
            </div>
            <div className="muted">
              {user.role} · {user.enabled ? 'enabled' : 'disabled'}
              {user.email === me.email && ' · you'}
            </div>
            <div className="actions">
              <button
                onClick={() =>
                  void run('updateUser', {
                    userId: user.userId,
                    role: user.role === 'admin' ? 'member' : 'admin',
                  })
                }
              >
                {user.role === 'admin' ? 'Make member' : 'Make admin'}
              </button>
              <button
                onClick={() =>
                  void run('updateUser', { userId: user.userId, enabled: !user.enabled })
                }
              >
                {user.enabled ? 'Disable' : 'Enable'}
              </button>
              <button className="danger" onClick={() => remove(user)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
