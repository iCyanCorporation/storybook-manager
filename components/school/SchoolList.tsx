"use client";

import { useEffect, useState } from "react";
import { fetchSchools } from "@/lib/data";
import { School } from "@/types/school";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export function SchoolList() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getSchools() {
      try {
        const schoolData = await fetchSchools();
        // Aggregate schools by ID to show the latest year's data
        const latestSchools = Array.from(
          schoolData
            .reduce((map, school) => {
              const existing = map.get(school.id);
              if (!existing || school.year > existing.year) {
                map.set(school.id, school);
              }
              return map;
            }, new Map<string, School>())
            .values()
        );
        setSchools(latestSchools);
      } catch (err) {
        setError("Failed to fetch school data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    getSchools();
  }, []);

  if (loading) {
    return <div>Loading schools...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schools</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School Name</TableHead>
              <TableHead>Prefecture</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>National Ranking</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.map((school) => (
              <TableRow key={school.id}>
                <TableCell>
                  <Link href={`/school/${school.id}`}>
                    {school.school_name}
                  </Link>
                </TableCell>
                <TableCell>{school.prefecture}</TableCell>
                <TableCell>{school.year}</TableCell>
                <TableCell>{school.ranking_national}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
