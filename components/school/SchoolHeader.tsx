import { School } from "@/types/school";

interface SchoolHeaderProps {
  school: School;
}

export function SchoolHeader({ school }: SchoolHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
        {school.school_name}
      </h1>
      <p className="text-xl text-muted-foreground mt-2">{school.prefecture}</p>
      <p className="text-md text-muted-foreground">{school.address}</p>
    </div>
  );
}
