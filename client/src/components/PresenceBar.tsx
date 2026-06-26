import { PresenceUser } from '../api';
import { getUserColor, initials } from '../utils/userColors';

interface PresenceBarProps {
  users: PresenceUser[];
  currentUserId?: string;
}

export default function PresenceBar({ users, currentUserId }: PresenceBarProps) {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-soft">
      <span className="text-xs font-medium text-slate-500">Viewing now</span>
      <div className="flex items-center -space-x-2">
        {users.map((user) => {
          const color = getUserColor(user.userId);
          const isYou = user.userId === currentUserId;
          return (
            <div
              key={user.userId}
              title={`${user.name}${user.isEditing ? ' (typing)' : ''}${isYou ? ' — you' : ''}`}
              className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white ${color.bg}`}
            >
              {initials(user.name)}
              {user.isEditing && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse rounded-full ring-2 ring-white"
                  style={{ backgroundColor: color.hex }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="hidden text-xs text-slate-500 sm:block">
        {users.map((u) => {
          const isYou = u.userId === currentUserId;
          return (
            <span key={u.userId} className="mr-2">
              <span className="font-medium" style={{ color: getUserColor(u.userId).hex }}>
                {u.name}
              </span>
              {u.isEditing ? ' is typing…' : ''}
              {isYou ? ' (you)' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}
