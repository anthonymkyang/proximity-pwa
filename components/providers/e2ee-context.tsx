"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  decryptAesGcm,
  derivePinKey,
  encryptAesGcm,
  exportAesKey,
  formatRecoveryKey,
  generateAesKey,
  generateDeviceKeyPair,
  importAesKey,
  importPublicKey,
  parseRecoveryKey,
  randomBytes,
  toBase64,
  fromBase64,
  deriveSharedKey,
} from "@/lib/crypto/e2ee";
import {
  getDevice,
  getDeviceUuid,
  getRememberedBundle,
  setDevice,
  setRememberedBundle,
  clearDevice,
  clearRememberedBundle,
} from "@/lib/crypto/deviceStore";

type E2EEStatus = "disabled" | "locked" | "unlocked";

type ConversationKeyMap = Map<string, CryptoKey>;

type E2EEContextValue = {
  status: E2EEStatus;
  loading: boolean;
  unlockWithPin: (pin: string, remember?: boolean) => Promise<void>;
  unlockWithRecoveryKey: (recoveryKey: string, remember?: boolean) => Promise<void>;
  enableWithPin: (pin: string, remember?: boolean) => Promise<string>;
  getConversationKey: (conversationId: string) => CryptoKey | null;
  ensureConversationKey: (conversationId: string) => Promise<CryptoKey | null>;
  refreshDeviceKeys: () => Promise<number>;
  reshareConversationKey: (conversationId: string) => Promise<number>;
};

const E2EEContext = createContext<E2EEContextValue | null>(null);

const PIN_ITERATIONS = 200_000;

function buildDeviceLabel() {
  if (typeof navigator === "undefined") return "Unknown device";
  return navigator.userAgent;
}

export function E2EEProvider({ children }: { children: React.ReactNode }) {
  const supabase = useRef(createClient()).current;
  const [status, setStatus] = useState<E2EEStatus>("disabled");
  const [loading, setLoading] = useState(true);
  const statusRef = useRef<E2EEStatus>("disabled");
  const loadStatusInFlightRef = useRef(false);
  const lastStatusRef = useRef<{
    userId: string | null;
    remembered: boolean;
    backup: boolean;
  } | null>(null);
  const [conversationKeys, setConversationKeys] = useState<ConversationKeyMap>(
    () => new Map()
  );
  const hydratedRef = useRef(false);
  const sharedKeysRef = useRef<Set<string>>(new Set());
  const backupKeyRef = useRef<CryptoKey | null>(null);
  const bundleRef = useRef<{ version: number; conversations: Record<string, string> } | null>(
    null
  );
  const deviceRef = useRef<{
    userId: string;
    deviceId: string;
    deviceUuid: string;
    publicKey: string;
    privateKey: CryptoKey;
  } | null>(null);
  const ensureDeviceInFlightRef = useRef<Promise<
    | {
        userId: string;
        deviceId: string;
        deviceUuid: string;
        publicKey: string;
        privateKey: CryptoKey;
      }
    | null
  > | null>(null);

  const setKeysFromBundle = useCallback(
    async (bundle: Record<string, string>) => {
      const next = new Map<string, CryptoKey>();
      const entries = Object.entries(bundle);
      for (const [conversationId, keyBase64] of entries) {
        const raw = fromBase64(keyBase64);
        const key = await importAesKey(raw);
        next.set(conversationId, key);
      }
      setConversationKeys(next);
    },
    []
  );

  React.useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const upsertConversationKeys = useCallback(
    async (conversationId: string, rows: any[]) => {
      if (!rows.length) return;
      if (process.env.NODE_ENV !== "production") {
        console.log("[e2ee] upsert keys", {
          conversationId,
          rows: rows.length,
        });
      }
      try {
        const { error } = await supabase.rpc("upsert_conversation_keys", {
          convo_id: conversationId,
          payload: rows,
        });
        if (!error) {
          if (process.env.NODE_ENV !== "production") {
            console.log("[e2ee] rpc upsert ok");
          }
          return;
        }
        if (process.env.NODE_ENV !== "production") {
          console.warn("[e2ee] rpc upsert failed", error);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[e2ee] rpc upsert failed", err);
        }
      }

      const { error: upsertErr } = await supabase
        .from("conversation_keys")
        .upsert(rows, {
          onConflict: "conversation_id,user_id,device_id",
        });
      if (upsertErr && process.env.NODE_ENV !== "production") {
        console.warn("[e2ee] conversation_keys upsert failed", upsertErr);
      }
    },
    [supabase]
  );

  const ensureDevice = useCallback(
    async (userId: string) => {
      if (deviceRef.current?.userId === userId) return deviceRef.current;
      if (ensureDeviceInFlightRef.current) {
        return await ensureDeviceInFlightRef.current;
      }
      const task = (async () => {
        const stored = await getDevice(userId);
        if (stored) {
          const { data: existing } = await supabase
            .from("user_devices")
            .select("id, device_uuid")
            .eq("device_uuid", stored.deviceUuid)
            .eq("user_id", userId)
            .maybeSingle();
          if (existing?.id) {
            if (stored.deviceId !== existing.id) {
              const updated = { ...stored, deviceId: existing.id };
              await setDevice(updated);
              deviceRef.current = updated;
              return updated;
            }
            deviceRef.current = stored;
            return stored;
          }
        }

        const deviceLabel = buildDeviceLabel();
        const { data: existingByLabel } = await supabase
          .from("user_devices")
          .select("id, device_uuid")
          .eq("user_id", userId)
          .eq("device_label", deviceLabel)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (process.env.NODE_ENV !== "production") {
          console.log("[e2ee] registering device", {
            hasStored: Boolean(stored),
            reuseByLabel: Boolean(existingByLabel?.id),
          });
        }

        const pair = await generateDeviceKeyPair();
        const publicKey = await crypto.subtle.exportKey("spki", pair.publicKey);
        const publicKeyBase64 = toBase64(publicKey);
        const deviceUuid =
          existingByLabel?.device_uuid ?? stored?.deviceUuid ?? getDeviceUuid(userId);
        const { data: row, error } = await supabase
          .from("user_devices")
          .upsert(
            {
              user_id: userId,
              device_uuid: deviceUuid,
              public_key: publicKeyBase64,
              device_label: deviceLabel,
            },
            { onConflict: "user_id,device_uuid" }
          )
          .select("id")
          .single();
        if (error || !row) {
          throw new Error(error?.message || "Failed to register device");
        }
        const device = {
          userId,
          deviceId: row.id,
          deviceUuid,
          publicKey: publicKeyBase64,
          privateKey: pair.privateKey,
        };
        await setDevice(device);
        deviceRef.current = device;
        return device;
      })();
      ensureDeviceInFlightRef.current = task;
      try {
        return await task;
      } finally {
        ensureDeviceInFlightRef.current = null;
      }
    },
    [supabase]
  );

  const persistBackupBundle = useCallback(
    async (userId: string) => {
      if (!backupKeyRef.current || !bundleRef.current) return;
      const bundleEncrypted = await encryptAesGcm(
        backupKeyRef.current,
        JSON.stringify(bundleRef.current)
      );
      const { data: backup } = await supabase
        .from("user_key_backups")
        .select("backup_ciphertext, backup_salt, kdf_params")
        .eq("user_id", userId)
        .maybeSingle();
      if (!backup) return;
      const payload = JSON.parse(backup.backup_ciphertext);
      const updatedPayload = JSON.stringify({
        ...payload,
        bundle_ciphertext: bundleEncrypted.ciphertext,
        bundle_nonce: bundleEncrypted.nonce,
      });
      await supabase.from("user_key_backups").upsert({
        user_id: userId,
        backup_ciphertext: updatedPayload,
        backup_salt: backup.backup_salt,
        kdf_params: backup.kdf_params,
      });

      const remembered = await getRememberedBundle(userId);
      if (remembered && backupKeyRef.current && bundleRef.current) {
        await setRememberedBundle({
          userId,
          backupKeyBase64: toBase64(await exportAesKey(backupKeyRef.current)),
          bundleJson: JSON.stringify(bundleRef.current),
        });
      }
    },
    [supabase]
  );

  const loadDeviceKeys = useCallback(
    async (userId: string) => {
      const device = await ensureDevice(userId);
      const { data: rows, error } = await supabase
        .from("conversation_keys")
        .select("conversation_id, key_ciphertext, created_at")
        .eq("user_id", userId)
        .eq("device_id", device.deviceId);
      if (process.env.NODE_ENV !== "production") {
        console.log("[e2ee] loadDeviceKeys", {
          userId,
          deviceId: device.deviceId,
          rows: rows?.length ?? 0,
          error: error?.message ?? null,
        });
      }
      if (error || !rows || rows.length === 0) return 0;

      const nextBundle = bundleRef.current?.conversations
        ? { ...bundleRef.current.conversations }
        : {};
      const entries: Array<{ convoId: string; key: CryptoKey }> = [];
      let added = 0;
      const sortedRows = [...rows].sort((a, b) => {
        const aTime = a.created_at ? Date.parse(a.created_at) : 0;
        const bTime = b.created_at ? Date.parse(b.created_at) : 0;
        return bTime - aTime;
      });
      for (const row of sortedRows) {
        const convoId = row.conversation_id;
        if (!convoId) continue;
        try {
          const payload = JSON.parse(row.key_ciphertext);
          const epk = await importPublicKey(payload.epk);
          const sharedKey = await deriveSharedKey(device.privateKey, epk);
          const wrapped = await decryptAesGcm(
            sharedKey,
            payload.ciphertext,
            payload.nonce
          );
          nextBundle[convoId] = wrapped;
          const key = await importAesKey(fromBase64(wrapped));
          entries.push({ convoId, key });
          added += 1;
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[e2ee] loadDeviceKeys failed", {
              conversationId: convoId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
      bundleRef.current = {
        version: bundleRef.current?.version || 1,
        conversations: nextBundle,
      };
      if (entries.length) {
        setConversationKeys((prev) => {
          const next = new Map(prev);
          entries.forEach(({ convoId, key }) => {
            next.set(convoId, key);
          });
          return next;
        });
        if (process.env.NODE_ENV !== "production") {
          console.log("[e2ee] loadDeviceKeys added", entries.length);
        }
      }
      await persistBackupBundle(userId);
      return added;
    },
    [ensureDevice, persistBackupBundle, supabase]
  );

  const loadStatus = useCallback(async () => {
    if (loadStatusInFlightRef.current) return;
    loadStatusInFlightRef.current = true;
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let activeUser = user ?? null;
      if (!activeUser) {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData.session?.user ?? null;
      }
      if (!activeUser) {
        setStatus("disabled");
        setLoading(false);
        hydratedRef.current = false;
        lastStatusRef.current = null;
        loadStatusInFlightRef.current = false;
        return;
      }
      await ensureDevice(activeUser.id);
      const remembered = await getRememberedBundle(activeUser.id);
      if (process.env.NODE_ENV !== "production") {
        console.log("[e2ee] remembered bundle", Boolean(remembered));
      }
      const { data: backupRow } = await supabase
        .from("user_key_backups")
        .select("user_id")
        .eq("user_id", activeUser.id)
        .maybeSingle();
      const rememberedOk = Boolean(
        remembered?.backupKeyBase64 && remembered.bundleJson
      );
      const snapshot = {
        userId: activeUser.id,
        remembered: rememberedOk,
        backup: Boolean(backupRow),
      };
      const last = lastStatusRef.current;
      if (
        last &&
        last.userId === snapshot.userId &&
        last.remembered === snapshot.remembered &&
        last.backup === snapshot.backup &&
        statusRef.current === "locked" &&
        !snapshot.remembered &&
        snapshot.backup
      ) {
        setLoading(false);
        loadStatusInFlightRef.current = false;
        return;
      }
      lastStatusRef.current = snapshot;
      if (!backupRow) {
        backupKeyRef.current = null;
        bundleRef.current = null;
        setConversationKeys(new Map());
        hydratedRef.current = false;
        if (remembered) {
          await clearRememberedBundle(activeUser.id);
        }
        setStatus("disabled");
        loadStatusInFlightRef.current = false;
        return;
      }
      if (rememberedOk) {
        if (hydratedRef.current) {
          setStatus("unlocked");
          setLoading(false);
          loadStatusInFlightRef.current = false;
          return;
        }
        const backupKey = await importAesKey(fromBase64(remembered.backupKeyBase64));
        backupKeyRef.current = backupKey;
        const parsed = JSON.parse(remembered.bundleJson) || {};
        const bundle = parsed.conversations || {};
        bundleRef.current = {
          version: parsed.version || 1,
          conversations: { ...bundle },
        };
        await setKeysFromBundle(bundle);
        setStatus("unlocked");
        await loadDeviceKeys(activeUser.id);
        hydratedRef.current = true;
        setLoading(false);
        loadStatusInFlightRef.current = false;
        return;
      }
      setStatus("locked");
    } finally {
      setLoading(false);
      loadStatusInFlightRef.current = false;
    }
  }, [ensureDevice, loadDeviceKeys, setKeysFromBundle, supabase]);

  React.useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  React.useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const subscribe = async () => {
      if (status === "disabled") return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let activeUser = user ?? null;
      if (!activeUser) {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData.session?.user ?? null;
      }
      if (!activeUser) return;
      const device = await ensureDevice(activeUser.id);
      if (!active) return;
      channel = supabase
        .channel(`e2ee-keys-${activeUser.id}-${device.deviceId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversation_keys",
            filter: `device_id=eq.${device.deviceId}`,
          },
          async () => {
            await loadDeviceKeys(activeUser.id);
          }
        )
        .subscribe();
    };
    void subscribe();
    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [ensureDevice, loadDeviceKeys, status, supabase]);

  const enableWithPin = useCallback(
    async (pin: string, remember?: boolean) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let activeUser = user ?? null;
      if (!activeUser) {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData.session?.user ?? null;
      }
      if (!activeUser) throw new Error("Unauthenticated");

      const device = await ensureDevice(activeUser.id);

      const { data: memberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", activeUser.id);
      const convoIds = Array.from(
        new Set((memberships ?? []).map((m) => m.conversation_id))
      );
      const { data: convoRows } = await supabase
        .from("conversations")
        .select("id, type")
        .in("id", convoIds);
      const directIds = (convoRows ?? [])
        .filter((c) => String(c.type || "").toLowerCase() === "direct")
        .map((c) => c.id);

      const bundle: Record<string, string> = {};
      for (const convoId of directIds) {
        const key = await generateAesKey();
        const raw = await exportAesKey(key);
        bundle[convoId] = toBase64(raw);
      }

      const backupKey = await generateAesKey();
      backupKeyRef.current = backupKey;
      const bundlePayload = JSON.stringify({
        version: 1,
        conversations: bundle,
      });
      bundleRef.current = { version: 1, conversations: { ...bundle } };
      const bundleEncrypted = await encryptAesGcm(backupKey, bundlePayload);

      const salt = randomBytes(16);
      const pinKey = await derivePinKey(pin, salt, PIN_ITERATIONS);
      const backupKeyRaw = await exportAesKey(backupKey);
      const wrappedKey = await encryptAesGcm(
        pinKey,
        toBase64(backupKeyRaw)
      );

      const recoveryBytes = randomBytes(32);
      const recoveryKey = formatRecoveryKey(recoveryBytes);
      const recoveryAes = await importAesKey(recoveryBytes);
      const recoveryWrapped = await encryptAesGcm(
        recoveryAes,
        toBase64(backupKeyRaw)
      );

      const backupPayload = JSON.stringify({
        bundle_ciphertext: bundleEncrypted.ciphertext,
        bundle_nonce: bundleEncrypted.nonce,
        wrapped_key_ciphertext: wrappedKey.ciphertext,
        wrapped_key_nonce: wrappedKey.nonce,
      });

      await supabase.from("user_key_backups").upsert({
        user_id: activeUser.id,
        backup_ciphertext: backupPayload,
        backup_salt: toBase64(salt),
        kdf_params: {
          iterations: PIN_ITERATIONS,
          hash: "SHA-256",
        },
      });

      await supabase.from("user_recovery_keys").upsert({
        user_id: activeUser.id,
        recovery_ciphertext: JSON.stringify({
          wrapped_key_ciphertext: recoveryWrapped.ciphertext,
          wrapped_key_nonce: recoveryWrapped.nonce,
        }),
      });

      if (directIds.length) {
        const { data: memberRows } = await supabase
          .from("conversation_members")
          .select("conversation_id, user_id")
          .in("conversation_id", directIds);
        const memberIds = Array.from(
          new Set((memberRows ?? []).map((row) => row.user_id))
        );
        let deviceRows: any[] | null = null;
        try {
          const { data: rpcRows, error: rpcErr } = await supabase.rpc(
            "get_conversation_member_devices",
            { convo_id: directIds[0] }
          );
          if (!rpcErr && Array.isArray(rpcRows)) {
            deviceRows = rpcRows;
          }
        } catch {
          // ignore
        }
        if (!deviceRows) {
          const { data: fallbackRows } = await supabase
            .from("user_devices")
            .select("id, user_id, public_key")
            .in("user_id", memberIds);
          deviceRows = fallbackRows ?? [];
        }

        const rows: any[] = [];
        for (const conversationId of directIds) {
          const keyBase64 = bundle[conversationId];
          if (!keyBase64) continue;
          const raw = fromBase64(keyBase64);
          for (const deviceRow of deviceRows ?? []) {
            try {
              const publicKey = await importPublicKey(deviceRow.public_key);
              const epkPair = await generateDeviceKeyPair();
              const epkPublic = await crypto.subtle.exportKey(
                "spki",
                epkPair.publicKey
              );
              const sharedKey = await deriveSharedKey(
                epkPair.privateKey,
                publicKey
              );
              const wrapped = await encryptAesGcm(
                sharedKey,
                toBase64(raw)
              );
              rows.push({
                conversation_id: conversationId,
                user_id: deviceRow.user_id,
                device_id: deviceRow.id,
                key_ciphertext: JSON.stringify({
                  ciphertext: wrapped.ciphertext,
                  nonce: wrapped.nonce,
                  epk: toBase64(epkPublic),
                }),
              });
            } catch {
              // ignore per-device failures
            }
          }
        }
        if (rows.length) {
          const grouped = rows.reduce<Record<string, any[]>>((acc, row) => {
            if (!row?.conversation_id) return acc;
            if (!acc[row.conversation_id]) acc[row.conversation_id] = [];
            acc[row.conversation_id].push(row);
            return acc;
          }, {});
          for (const [convoId, convoRows] of Object.entries(grouped)) {
            await upsertConversationKeys(convoId, convoRows);
          }
        }
      }

      await setKeysFromBundle(bundle);
      setStatus("unlocked");
      if (remember && backupKeyRef.current && bundleRef.current) {
        try {
          await setRememberedBundle({
            userId: activeUser.id,
            backupKeyBase64: toBase64(
              await exportAesKey(backupKeyRef.current)
            ),
            bundleJson: JSON.stringify(bundleRef.current),
          });
          if (process.env.NODE_ENV !== "production") {
            console.log("[e2ee] remembered bundle saved");
          }
        } catch {
          if (process.env.NODE_ENV !== "production") {
            console.log("[e2ee] failed to save remembered bundle");
          }
          // ignore local storage failures
        }
      }
      return recoveryKey;
    },
    [ensureDevice, setKeysFromBundle, supabase, upsertConversationKeys]
  );

  const unlockWithPin = useCallback(
    async (pin: string, remember?: boolean) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let activeUser = user ?? null;
      if (!activeUser) {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData.session?.user ?? null;
      }
      if (!activeUser) throw new Error("Unauthenticated");

      const { data: backup } = await supabase
        .from("user_key_backups")
        .select("backup_ciphertext, backup_salt, kdf_params")
        .eq("user_id", activeUser.id)
        .maybeSingle();
      if (!backup) throw new Error("No backup found");

      const salt = fromBase64(backup.backup_salt);
      const iterations = backup.kdf_params?.iterations ?? PIN_ITERATIONS;
      const pinKey = await derivePinKey(pin, salt, iterations);

      const payload = JSON.parse(backup.backup_ciphertext);
      const wrappedKey = await decryptAesGcm(
        pinKey,
        payload.wrapped_key_ciphertext,
        payload.wrapped_key_nonce
      );
      const backupKey = await importAesKey(fromBase64(wrappedKey));
      backupKeyRef.current = backupKey;
      const bundleJson = await decryptAesGcm(
        backupKey,
        payload.bundle_ciphertext,
        payload.bundle_nonce
      );
      const parsed = JSON.parse(bundleJson) || {};
      const bundle = parsed.conversations || {};
      bundleRef.current = {
        version: parsed.version || 1,
        conversations: { ...bundle },
      };
      await setKeysFromBundle(bundle);
      await loadDeviceKeys(activeUser.id);
      setStatus("unlocked");
      if (remember && backupKeyRef.current && bundleRef.current) {
        try {
          await setRememberedBundle({
            userId: activeUser.id,
            backupKeyBase64: toBase64(
              await exportAesKey(backupKeyRef.current)
            ),
            bundleJson: JSON.stringify(bundleRef.current),
          });
          if (process.env.NODE_ENV !== "production") {
            console.log("[e2ee] remembered bundle saved");
          }
        } catch {
          if (process.env.NODE_ENV !== "production") {
            console.log("[e2ee] failed to save remembered bundle");
          }
          // ignore local storage failures
        }
      }
    },
    [loadDeviceKeys, setKeysFromBundle, supabase]
  );

  const unlockWithRecoveryKey = useCallback(
    async (recoveryKey: string, remember?: boolean) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let activeUser = user ?? null;
      if (!activeUser) {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData.session?.user ?? null;
      }
      if (!activeUser) throw new Error("Unauthenticated");

      const [{ data: backup }, { data: recovery }] = await Promise.all([
        supabase
          .from("user_key_backups")
          .select("backup_ciphertext")
          .eq("user_id", activeUser.id)
          .maybeSingle(),
        supabase
          .from("user_recovery_keys")
          .select("recovery_ciphertext")
          .eq("user_id", activeUser.id)
          .maybeSingle(),
      ]);
      if (!backup || !recovery) throw new Error("Missing recovery data");

      const recoveryRaw = parseRecoveryKey(recoveryKey);
      const recoveryAes = await importAesKey(recoveryRaw);
      const recoveryPayload = JSON.parse(recovery.recovery_ciphertext);
      const wrappedKey = await decryptAesGcm(
        recoveryAes,
        recoveryPayload.wrapped_key_ciphertext,
        recoveryPayload.wrapped_key_nonce
      );
      const backupKey = await importAesKey(fromBase64(wrappedKey));
      backupKeyRef.current = backupKey;
      const payload = JSON.parse(backup.backup_ciphertext);
      const bundleJson = await decryptAesGcm(
        backupKey,
        payload.bundle_ciphertext,
        payload.bundle_nonce
      );
      const parsed = JSON.parse(bundleJson) || {};
      const bundle = parsed.conversations || {};
      bundleRef.current = {
        version: parsed.version || 1,
        conversations: { ...bundle },
      };
      await setKeysFromBundle(bundle);
      await loadDeviceKeys(activeUser.id);
      setStatus("unlocked");
      if (remember && backupKeyRef.current && bundleRef.current) {
        try {
          await setRememberedBundle({
            userId: activeUser.id,
            backupKeyBase64: toBase64(
              await exportAesKey(backupKeyRef.current)
            ),
            bundleJson: JSON.stringify(bundleRef.current),
          });
          if (process.env.NODE_ENV !== "production") {
            console.log("[e2ee] remembered bundle saved");
          }
        } catch {
          if (process.env.NODE_ENV !== "production") {
            console.log("[e2ee] failed to save remembered bundle");
          }
          // ignore local storage failures
        }
      }
    },
    [loadDeviceKeys, setKeysFromBundle, supabase]
  );

  const getConversationKey = useCallback(
    (conversationId: string) => {
      return conversationKeys.get(conversationId) ?? null;
    },
    [conversationKeys]
  );

  const refreshDeviceKeys = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let activeUser = user ?? null;
    if (!activeUser) {
      const { data: sessionData } = await supabase.auth.getSession();
      activeUser = sessionData.session?.user ?? null;
    }
    if (!activeUser) return 0;
    const added = await loadDeviceKeys(activeUser.id);
    return added;
  }, [loadDeviceKeys, supabase]);

  const reshareConversationKey = useCallback(
    async (conversationId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let activeUser = user ?? null;
      if (!activeUser) {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData.session?.user ?? null;
      }
      if (!activeUser) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[e2ee] reshare missing user");
        }
        return 0;
      }
      const key = conversationKeys.get(conversationId);
      if (!key) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[e2ee] reshare missing key", conversationId);
        }
        return 0;
      }

      const raw = await exportAesKey(key);
      let deviceRows: any[] | null = null;
      try {
        const { data: rpcRows, error: rpcErr } = await supabase.rpc(
          "get_conversation_member_devices",
          { convo_id: conversationId }
        );
        if (!rpcErr && Array.isArray(rpcRows)) {
          deviceRows = rpcRows;
          if (process.env.NODE_ENV !== "production") {
            console.log("[e2ee] reshare rpc devices", rpcRows.length);
          }
        }
      } catch {
        // ignore
      }
      if (!deviceRows) {
        const { data: members } = await supabase
          .from("conversation_members")
          .select("user_id")
          .eq("conversation_id", conversationId);
        const memberIds = Array.from(
          new Set((members ?? []).map((m) => m.user_id))
        );
        if (!memberIds.length) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[e2ee] reshare no members", conversationId);
          }
          return 0;
        }
        const { data: fallbackRows } = await supabase
          .from("user_devices")
          .select("id, user_id, public_key")
          .in("user_id", memberIds);
        deviceRows = fallbackRows ?? [];
        if (process.env.NODE_ENV !== "production") {
          console.log("[e2ee] reshare fallback devices", deviceRows.length);
        }
      }
      if (!deviceRows?.length) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[e2ee] reshare no devices", conversationId);
        }
        return 0;
      }

      const rows: any[] = [];
      for (const deviceRow of deviceRows) {
        try {
          const publicKey = await importPublicKey(deviceRow.public_key);
          const epkPair = await generateDeviceKeyPair();
          const epkPublic = await crypto.subtle.exportKey(
            "spki",
            epkPair.publicKey
          );
          const sharedKey = await deriveSharedKey(
            epkPair.privateKey,
            publicKey
          );
          const wrapped = await encryptAesGcm(sharedKey, toBase64(raw));
          rows.push({
            conversation_id: conversationId,
            user_id: deviceRow.user_id,
            device_id: deviceRow.id,
            key_ciphertext: JSON.stringify({
              ciphertext: wrapped.ciphertext,
              nonce: wrapped.nonce,
              epk: toBase64(epkPublic),
            }),
          });
        } catch {
          // ignore per-device failures
        }
      }
      if (rows.length) {
        await upsertConversationKeys(conversationId, rows);
        if (process.env.NODE_ENV !== "production") {
          console.log("[e2ee] reshare upserted", rows.length);
        }
      } else if (process.env.NODE_ENV !== "production") {
        console.warn("[e2ee] reshare no rows", conversationId);
      }
      return rows.length;
    },
    [conversationKeys, supabase, upsertConversationKeys]
  );

  const ensureConversationKey = useCallback(
    async (conversationId: string) => {
      if (!conversationId) return null;
      const existing = conversationKeys.get(conversationId) ?? null;
      if (existing) {
        if (
          statusRef.current === "unlocked" &&
          !sharedKeysRef.current.has(conversationId)
        ) {
          if (process.env.NODE_ENV !== "production") {
            console.log("[e2ee] reshare existing key", conversationId);
          }
          const shared = await reshareConversationKey(conversationId);
          if (shared > 0) sharedKeysRef.current.add(conversationId);
        }
        return existing;
      }
      if (statusRef.current !== "unlocked") return null;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      let activeUser = user ?? null;
      if (!activeUser) {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData.session?.user ?? null;
      }
      if (!activeUser) return null;

      await ensureDevice(activeUser.id);
      const key = await generateAesKey();
      const raw = await exportAesKey(key);
      const next = new Map(conversationKeys);
      next.set(conversationId, key);
      setConversationKeys(next);

      try {
        let deviceRows: any[] | null = null;
        try {
          const { data: rpcRows, error: rpcErr } = await supabase.rpc(
            "get_conversation_member_devices",
            { convo_id: conversationId }
          );
          if (!rpcErr && Array.isArray(rpcRows)) {
            deviceRows = rpcRows;
            if (process.env.NODE_ENV !== "production") {
              console.log("[e2ee] member devices rpc", rpcRows.length);
            }
          }
        } catch {
          // ignore
        }

        if (!deviceRows) {
          const { data: members } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", conversationId);
          const memberIds = Array.from(
            new Set((members ?? []).map((m) => m.user_id))
          );
          if (process.env.NODE_ENV !== "production") {
            console.log("[e2ee] member ids", memberIds.length);
          }
          if (memberIds.length) {
            const { data: fallbackRows } = await supabase
              .from("user_devices")
              .select("id, user_id, public_key")
              .in("user_id", memberIds);
            deviceRows = fallbackRows ?? [];
          } else {
            deviceRows = [];
          }
        }

        if (deviceRows?.length) {
          const rows: any[] = [];
          for (const deviceRow of deviceRows) {
            try {
              const publicKey = await importPublicKey(deviceRow.public_key);
              const epkPair = await generateDeviceKeyPair();
              const epkPublic = await crypto.subtle.exportKey(
                "spki",
                epkPair.publicKey
              );
              const sharedKey = await deriveSharedKey(
                epkPair.privateKey,
                publicKey
              );
              const wrapped = await encryptAesGcm(sharedKey, toBase64(raw));
              rows.push({
                conversation_id: conversationId,
                user_id: deviceRow.user_id,
                device_id: deviceRow.id,
                key_ciphertext: JSON.stringify({
                  ciphertext: wrapped.ciphertext,
                  nonce: wrapped.nonce,
                  epk: toBase64(epkPublic),
                }),
              });
            } catch {
              // ignore per-device failures
            }
          }
          if (process.env.NODE_ENV !== "production") {
            console.log("[e2ee] wrapped key rows", rows.length);
          }
          if (rows.length) {
            await upsertConversationKeys(conversationId, rows);
            sharedKeysRef.current.add(conversationId);
          }
        }
      } catch {
        // best-effort
      }

      if (!backupKeyRef.current || !bundleRef.current) return key;
      bundleRef.current.conversations[conversationId] = toBase64(raw);
      await persistBackupBundle(activeUser.id);
      return key;
    },
    [
      conversationKeys,
      ensureDevice,
      persistBackupBundle,
      reshareConversationKey,
      supabase,
      upsertConversationKeys,
    ]
  );

  const value = useMemo(
    () => ({
      status,
      loading,
      unlockWithPin,
      unlockWithRecoveryKey,
      enableWithPin,
      getConversationKey,
      ensureConversationKey,
      refreshDeviceKeys,
      reshareConversationKey,
    }),
    [
      status,
      loading,
      unlockWithPin,
      unlockWithRecoveryKey,
      enableWithPin,
      getConversationKey,
      ensureConversationKey,
      refreshDeviceKeys,
      reshareConversationKey,
    ]
  );

  return <E2EEContext.Provider value={value}>{children}</E2EEContext.Provider>;
}

export function useE2EE() {
  const ctx = useContext(E2EEContext);
  if (!ctx) {
    throw new Error("useE2EE must be used within E2EEProvider");
  }
  return ctx;
}
