import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-6">
      <div className="flex flex-col items-center gap-8">
        <Image
          src="/logo.svg"
          alt="Proximity logo"
          width={96}
          height={96}
          className="rounded-full shadow-md"
        />
        <h1 className="text-4xl font-bold tracking-tight bg-linear-to-r from-fuchsia-500 via-pink-500 to-rose-500 bg-clip-text text-transparent">
          Welcome to Proximity
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Connect instantly with guys nearby. Fast. Simple. Discreet.
        </p>
        <div className="flex gap-4">
          <Link href="/auth">
            <Button size="lg" className="rounded-full px-8">
              Let's go
            </Button>
          </Link>
          <Link href="/about">
            <Button variant="outline" size="lg" className="rounded-full px-8">
              Learn More
            </Button>
          </Link>
        </div>
      </div>
      <footer className="mt-12 text-sm text-muted-foreground">
        © {new Date().getFullYear()} Proximity. All rights reserved.
      </footer>
    </main>
  );
}
