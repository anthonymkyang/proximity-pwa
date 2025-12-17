// One-time migration script to add 'link' message type
// Run with: npx tsx scripts/migrate-link-type.ts

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  console.log("Adding 'link' to message_type constraint...");

  const { error } = await supabase.rpc("exec_sql", {
    sql: `
      ALTER TABLE messages
      DROP CONSTRAINT IF EXISTS messages_message_type_check;

      ALTER TABLE messages
      ADD CONSTRAINT messages_message_type_check
      CHECK (message_type IN ('text', 'location', 'link'));
    `,
  });

  if (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }

  console.log("Migration completed successfully!");
}

migrate();
