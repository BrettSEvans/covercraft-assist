import { Link } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";

interface StaticPageProps {
  title: string;
}

export default function StaticPage({ title }: StaticPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link to="/" aria-label="Back to home" className="inline-flex">
            <BrandLogo iconSize="2em" />
          </Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="font-heading text-4xl md:text-5xl tracking-tight text-foreground">{title}</h1>
      </main>
    </div>
  );
}
