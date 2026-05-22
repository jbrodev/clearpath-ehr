"use client";

import { useEffect, useState, useCallback } from "react";

import { ROLE_STORAGE_KEY, type Role, isRole } from "./roles";

export function useRole() {
  const [role, setRoleState] = useState<Role | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(ROLE_STORAGE_KEY) : null;
    if (isRole(stored)) {
      setRoleState(stored);
    }
    setHydrated(true);
  }, []);

  const setRole = useCallback((next: Role | null) => {
    if (typeof window === "undefined") return;
    if (next === null) {
      window.localStorage.removeItem(ROLE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(ROLE_STORAGE_KEY, next);
    }
    setRoleState(next);
  }, []);

  return { role, setRole, hydrated };
}
