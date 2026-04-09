import { Zap, Layers, Database, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Zap,
    title: "FastAPI Backend",
    description:
      "High-performance REST API powered by FastAPI with automatic Swagger docs at /docs.",
  },
  {
    icon: Layers,
    title: "React SPA Frontend",
    description:
      "Single-page application built with React and served by the same FastAPI server in production.",
  },
  {
    icon: Database,
    title: "MySQL + Alembic",
    description:
      "Persistent data storage with SQLAlchemy ORM and version-controlled schema migrations via Alembic.",
  },
];

export default function Home() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-12 space-y-12">
      {/* Hero */}
      <section className="text-center space-y-4">
        <Badge variant="secondary" className="text-sm px-3 py-1">
          PWL2 — Pemrograman Web Lanjut 2
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight">
          FastAPI + React Fullstack
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-lg">
          One server, one port. FastAPI handles the API and serves the React SPA
          via a catch-all route.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button asChild>
            <Link to="/items" className="flex items-center gap-2">
              Try Items CRUD <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="/docs" target="_blank" rel="noreferrer">
              API Docs (Swagger)
            </a>
          </Button>
        </div>
      </section>

      {/* Feature cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader className="pb-2">
              <Icon className="h-8 w-8 text-primary mb-1" />
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
