import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    // Validate URL
    let validUrl: URL;
    try {
      validUrl = new URL(url);
      // Only allow http and https protocols
      if (!["http:", "https:"].includes(validUrl.protocol)) {
        return NextResponse.json(
          { error: "Invalid URL protocol" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Fetch the page
    const response = await fetch(validUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ProximityBot/1.0; +https://proximity.app)",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch URL" },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Extract Open Graph and meta tags
    const preview: LinkPreviewData = {
      url: validUrl.toString(),
    };

    // Extract OG title
    const ogTitleMatch = html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i
    );
    if (ogTitleMatch) {
      preview.title = ogTitleMatch[1];
    } else {
      // Fallback to regular title tag
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch) {
        preview.title = titleMatch[1];
      }
    }

    // Extract OG description
    const ogDescMatch = html.match(
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i
    );
    if (ogDescMatch) {
      preview.description = ogDescMatch[1];
    } else {
      // Fallback to meta description
      const descMatch = html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i
      );
      if (descMatch) {
        preview.description = descMatch[1];
      }
    }

    // Extract OG image
    const ogImageMatch = html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i
    );
    if (ogImageMatch) {
      let imageUrl = ogImageMatch[1];
      // Handle relative URLs
      if (imageUrl.startsWith("/")) {
        imageUrl = `${validUrl.origin}${imageUrl}`;
      } else if (!imageUrl.startsWith("http")) {
        imageUrl = `${validUrl.origin}/${imageUrl}`;
      }
      preview.image = imageUrl;
    }

    // Extract site name
    const ogSiteNameMatch = html.match(
      /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["']/i
    );
    if (ogSiteNameMatch) {
      preview.siteName = ogSiteNameMatch[1];
    } else {
      // Use hostname as fallback
      preview.siteName = validUrl.hostname.replace("www.", "");
    }

    // Extract favicon
    // Try various favicon patterns
    const faviconPatterns = [
      /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i,
      /<link[^>]*href=["']([^"']*)["'][^>]*rel=["'](?:shortcut )?icon["']/i,
    ];

    for (const pattern of faviconPatterns) {
      const faviconMatch = html.match(pattern);
      if (faviconMatch) {
        let faviconUrl = faviconMatch[1];
        // Handle relative URLs
        if (faviconUrl.startsWith("//")) {
          faviconUrl = `https:${faviconUrl}`;
        } else if (faviconUrl.startsWith("/")) {
          faviconUrl = `${validUrl.origin}${faviconUrl}`;
        } else if (!faviconUrl.startsWith("http")) {
          faviconUrl = `${validUrl.origin}/${faviconUrl}`;
        }
        preview.favicon = faviconUrl;
        break;
      }
    }

    // Fallback to standard favicon location if not found
    if (!preview.favicon) {
      preview.favicon = `${validUrl.origin}/favicon.ico`;
    }

    return NextResponse.json(preview);
  } catch (error) {
    console.error("Error fetching link preview:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
