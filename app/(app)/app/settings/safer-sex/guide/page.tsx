"use client";

import Link from "next/link";
import TopBar from "@/components/nav/TopBar";
import BackButton from "@/components/ui/back-button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Syringe,
  Pill,
  MapPin,
  Globe2,
  Phone,
  BookOpen,
  ArrowRight,
} from "lucide-react";

export default function SaferSexGuidePage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
      <TopBar leftContent={<BackButton />}>
        <h1 className="px-1 pb-2 text-4xl font-extrabold tracking-tight">
          Guide to Safer Sex
        </h1>
      </TopBar>

      {/* Lead card */}
      <div className="mt-4">
        <Card className="bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">How this works</CardTitle>
            </div>
            <CardDescription>
              Places to get PrEP, DoxyPEP, free condoms, testing and vaccines.
              Some services may vary by country.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Tip: keep your status, vaccine and condom preferences up to date in
            the main **Safer sex** screen so guys know what you’re into and what
            your boundaries are.
          </CardContent>
        </Card>
      </div>

      {/* Sections */}
      <div className="mt-6 space-y-4">
        {/* PrEP & DoxyPEP */}
        <Card className="bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">PrEP & DoxyPEP</CardTitle>
                <CardDescription>
                  Daily, on-demand, or after-sex protection.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Most sexual health clinics and LGBTQ+ services can prescribe{" "}
              <strong>PrEP</strong> (to prevent HIV) and{" "}
              <strong>DoxyPEP</strong> (to reduce some STIs after sex).
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ask for “PrEP pathway” or “HIV prevention clinic”.</li>
              <li>
                Some services do remote / postal PrEP if you can’t attend in
                person.
              </li>
              <li>
                If you had a high-risk exposure, ask about <strong>PEP</strong>{" "}
                (within 72 hours).
              </li>
            </ul>
            <Separator className="my-2" />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Not sure what to ask for?
              </p>
              <Link
                href="https://www.iwantprepnow.co.uk"
                className="inline-flex items-center text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                I Want PrEP Now
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Free condoms & lube */}
        <Card className="bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Free condoms & lube</CardTitle>
                <CardDescription>
                  Where to pick them up discreetly.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>You can usually get free condoms and lube at:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Local sexual health / GUM clinics</li>
              <li>LGBTQ+ community centres and bars</li>
              <li>University / college health teams</li>
              <li>Some charities / outreach workers</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Tell them you want condoms for receptive / anal sex — they often
              have better sizes, thicker options, and water-based lube.
            </p>
          </CardContent>
        </Card>

        {/* STI testing & vaccines */}
        <Card className="bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Syringe className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">
                  STI testing & vaccines
                </CardTitle>
                <CardDescription>
                  Keep this in your 3–6 month rotation.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Most clinics will test for chlamydia, gonorrhoea, HIV, and
              syphilis. Many also offer:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Mpox vaccine (depending on outbreaks)</li>
              <li>HPV vaccine</li>
              <li>Hep A and Hep B, especially for MSM</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              If you’ve set your Vaccines and Status in Proximity, you can tell
              people what you’ve already had.
            </p>
          </CardContent>
        </Card>

        {/* Finding services near you */}
        <Card className="bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Find a clinic</CardTitle>
                <CardDescription>
                  What to search for in your area.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Try searching for:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>“sexual health clinic near me”</li>
              <li>“MSM sexual health London” (change to your city)</li>
              <li>“LGBTQ STI testing”</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Some services require you to register with your local NHS / public
              health trust before giving PrEP.
            </p>
          </CardContent>
        </Card>

        {/* Other resources */}
        <Card className="bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Other resources</CardTitle>
                <CardDescription>
                  For people who travel or don’t want to be seen locally.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Some online / mail services (country-dependent):</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <Link
                  href="https://www.iwantprepnow.co.uk"
                  className="underline underline-offset-2"
                >
                  I Want PrEP Now
                </Link>
              </li>
              <li>
                <Link
                  href="https://www.tht.org.uk/"
                  className="underline underline-offset-2"
                >
                  Terrence Higgins Trust
                </Link>
              </li>
              <li>
                <Link
                  href="https://www.nhs.uk/live-well/sexual-health/"
                  className="underline underline-offset-2"
                >
                  NHS Sexual Health
                </Link>
              </li>
            </ul>
            <Separator className="my-2" />
            <div className="flex items-center gap-2 text-xs">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>
                If you’re unsure, call your local sexual health clinic — they’re
                used to these questions.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
