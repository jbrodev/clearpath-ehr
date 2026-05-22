"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ROLE_LIST, ROLES, type Role } from "@/lib/roles";
import { useRole } from "@/lib/use-role";

export function TopNav() {
  const { role, setRole, hydrated } = useRole();
  const router = useRouter();

  const onChange = (next: Role) => {
    setRole(next);
    router.push(ROLES[next].homePath);
  };

  return (
    <header className="border-b bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight hover:opacity-80 transition-opacity"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          ClearPath
          <span className="text-muted-foreground text-sm font-normal">
            Pre-Op Clearance
          </span>
        </Link>

        {hydrated && role && (
          <div className="flex items-center gap-3 text-sm">
            <label
              htmlFor="role-switcher"
              className="text-muted-foreground hidden sm:inline"
            >
              Viewing as
            </label>
            <select
              id="role-switcher"
              value={role}
              onChange={(e) => onChange(e.target.value as Role)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {ROLE_LIST.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </header>
  );
}
