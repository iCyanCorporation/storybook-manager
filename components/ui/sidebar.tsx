"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { School } from "@/types/school";
import { useEffect, useState } from "react";
import { fetchSchools } from "@/lib/data";

export function Sidebar() {
  const pathname = usePathname();
  const [schools, setSchools] = useState<School[]>([]);

  useEffect(() => {
    async function getSchools() {
      const schoolData = await fetchSchools();
      const uniqueSchools = Array.from(
        schoolData
          .reduce((map, school) => {
            if (!map.has(school.id)) {
              map.set(school.id, school);
            }
            return map;
          }, new Map<string, School>())
          .values()
      );
      setSchools(uniqueSchools);
    }
    getSchools();
  }, []);

  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="">🎓 OpenSchool</span>
          </Link>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            <Link
              href="/"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                pathname === "/" && "bg-muted text-primary"
              )}
            >
              Dashboard
            </Link>
            <h3 className="my-2 px-3 text-xs font-semibold text-muted-foreground">
              Schools
            </h3>
            {schools.map((school) => (
              <Link
                key={school.id}
                href={`/school/${school.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                  pathname === `/school/${school.id}` && "bg-muted text-primary"
                )}
              >
                {school.school_name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
