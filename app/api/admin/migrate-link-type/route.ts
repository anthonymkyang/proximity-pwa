import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// One-time migration endpoint to add 'link' message type
// Access via: POST /api/admin/migrate-link-type

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing environment variables" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Drop existing constraint
    const { error: dropError } = await supabase.rpc("exec_sql", {
      sql: "ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;",
    });

    if (dropError) {
      console.error("Drop constraint error:", dropError);
      return NextResponse.json(
        { error: "Failed to drop constraint", details: dropError },
        { status: 500 }
      );
    }

    // Add new constraint with 'link' type
    const { error: addError } = await supabase.rpc("exec_sql", {
      sql: "ALTER TABLE messages ADD CONSTRAINT messages_message_type_check CHECK (message_type IN ('text', 'location', 'link'));",
    });

    if (addError) {
      console.error("Add constraint error:", addError);
      return NextResponse.json(
        { error: "Failed to add constraint", details: addError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully",
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: "Migration failed", details: error },
      { status: 500 }
    );
  }
}
