export async function updateGroup(id: string, patch: Record<string, unknown>) {
  const res = await fetch(`/api/groups/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, patch }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update group: ${text || res.statusText}`);
  }

  return res.json();
}
