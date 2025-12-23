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
  const [conversationKeys, setConversationKeys] = useState<ConversationKeyMap>(
    () => new Map()
  );
  const backupKeyRef = useRef<CryptoKey | null>(null);
  const bundleRef = useRef<{ version: number; conversations: Record<string, string> } | null>(
    null
  );
  const deviceRef = useRef<{
    userId: string;
    deviceId: string;
    publicKey: string;
    privateKey: CryptoKey;
  } | null>(null);

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

  const ensureDevice = useCallback(
    async (userId: string) => {
      if (deviceRef.current?.userId === userId) return deviceRef.current;
      const stored = await getDevice(userId);
      if (stored) {
        const { data: existing } = await supabase
          .from("user_devices")
          .select("id")
          .eq("id", stored.deviceId)
          .eq("user_id", userId)
          .maybeSingle();
        if (existing?.id) {
          deviceRef.current = stored;
          return stored;
        }
        await clearDevice(userId);
      }
      const pair = await generateDeviceKeyPair();
      const publicKey = await crypto.subtle.exportKey("spki", pair.publicKey);
      const publicKeyBase64 = toBase64(publicKey);
      const { data: row, error } = await supabase
        .from("user_devices")
        .insert({
          user_id: userId,
          public_key: publicKeyBase64,
          device_label: buildDeviceLabel(),
        })
        .select("id")
        .single();
      if (error || !row) {
        throw new Error(error?.message || "Failed to register device");
      }
      const device = {
        userId,
        deviceId: row.id,
        publicKey: publicKeyBase64,
        privateKey: pair.privateKey,
      };
      await setDevice(device);
      deviceRef.current = device;
      return device;
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
      const { data: rows } = await supabase
        .from("conversation_keys")
        .select("conversation_id, key_ciphertext")
        .eq("user_id", userId)
        .eq("device_id", device.deviceId);
      if (!rows || rows.length === 0) return 0;

      const nextBundle = bundleRef.current?.conversations
        ? { ...bundleRef.current.conversations }
        : {};
      const nextMap = new Map(conversationKeys);
      let added = 0;
      for (const row of rows) {
        const convoId = row.conversation_id;
        if (!convoId || nextBundle[convoId]) continue;
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
          nextMap.set(convoId, key);
          added += 1;
        } catch {
          // ignore invalid rows
        }
      }
      bundleRef.current = {
        version: bundleRef.current?.version || 1,
        conversations: nextBundle,
      };
      setConversationKeys(nextMap);
      await persistBackupBundle(userId);
      return added;
    },
    [conversationKeys, ensureDevice, persistBackupBundle, supabase]
  );

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStatus("disabled");
        setLoading(false);
        return;
      }
      await ensureDevice(user.id);
      const remembered = await getRememberedBundle(user.id);
      const { data: backupRow } = await supabase
        .from("user_key_backups")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!backupRow) {
        backupKeyRef.current = null;
        bundleRef.current = null;
        setConversationKeys(new Map());
        if (remembered) {
          await clearRememberedBundle(user.id);
        }
        setStatus("disabled");
        return;
      }
      if (remembered?.backupKeyBase64 && remembered.bundleJson) {
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
        await loadDeviceKeys(user.id);
        setLoading(false);
        return;
      }
      setStatus("locked");
    } finally {
      setLoading(false);
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
      if (!user) return;
      const device = await ensureDevice(user.id);
      if (!active) return;
      channel = supabase
        .channel(`e2ee-keys-${user.id}-${device.deviceId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversation_keys",
            filter: `device_id=eq.${device.deviceId}`,
          },
          async () => {
            await loadDeviceKeys(user.id);
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
      if (!user) throw new Error("Unauthenticated");

      const device = await ensureDevice(user.id);

      const { data: memberships } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", user.id);
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
        user_id: user.id,
        backup_ciphertext: backupPayload,
        backup_salt: toBase64(salt),
        kdf_params: {
          iterations: PIN_ITERATIONS,
          hash: "SHA-256",
        },
      });

      await supabase.from("user_recovery_keys").upsert({
        user_id: user.id,
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
        const { data: deviceRows } = await supabase
          .from("user_devices")
          .select("id, user_id, public_key")
          .in("user_id", memberIds);

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
          await supabase.from("conversation_keys").upsert(rows, {
            onConflict: "conversation_id,user_id,device_id",
          });
        }
      }

      await setKeysFromBundle(bundle);
      setStatus("unlocked");
      if (remember && backupKeyRef.current && bundleRef.current) {
        await setRememberedBundle({
          userId: user.id,
          backupKeyBase64: toBase64(await exportAesKey(backupKeyRef.current)),
          bundleJson: JSON.stringify(bundleRef.current),
        });
      }
      return recoveryKey;
    },
    [ensureDevice, setKeysFromBundle, supabase]
  );

  const unlockWithPin = useCallback(
    async (pin: string, remember?: boolean) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthenticated");

      const { data: backup } = await supabase
        .from("user_key_backups")
        .select("backup_ciphertext, backup_salt, kdf_params")
        .eq("user_id", user.id)
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
      await loadDeviceKeys(user.id);
      setStatus("unlocked");
      if (remember && backupKeyRef.current && bundleRef.current) {
        await setRememberedBundle({
          userId: user.id,
          backupKeyBase64: toBase64(await exportAesKey(backupKeyRef.current)),
          bundleJson: JSON.stringify(bundleRef.current),
        });
      }
    },
    [loadDeviceKeys, setKeysFromBundle, supabase]
  );

  const unlockWithRecoveryKey = useCallback(
    async (recoveryKey: string, remember?: boolean) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthenticated");

      const [{ data: backup }, { data: recovery }] = await Promise.all([
        supabase
          .from("user_key_backups")
          .select("backup_ciphertext")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_recovery_keys")
          .select("recovery_ciphertext")
          .eq("user_id", user.id)
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
      await loadDeviceKeys(user.id);
      setStatus("unlocked");
      if (remember && backupKeyRef.current && bundleRef.current) {
        await setRememberedBundle({
          userId: user.id,
          backupKeyBase64: toBase64(await exportAesKey(backupKeyRef.current)),
          bundleJson: JSON.stringify(bundleRef.current),
        });
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

  const ensureConversationKey = useCallback(
    async (conversationId: string) => {
      const existing = conversationKeys.get(conversationId) ?? null;
      if (existing) return existing;
      if (status !== "unlocked") return null;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const device = await ensureDevice(user.id);
      const key = await generateAesKey();
      const raw = await exportAesKey(key);
      const next = new Map(conversationKeys);
      next.set(conversationId, key);
      setConversationKeys(next);

      try {
        const { data: members } = await supabase
          .from("conversation_members")
          .select("user_id")
          .eq("conversation_id", conversationId);
        const memberIds = Array.from(
          new Set((members ?? []).map((m) => m.user_id))
        );
        const { data: deviceRows } = await supabase
          .from("user_devices")
          .select("id, user_id, public_key")
          .in("user_id", memberIds);
        const rows: any[] = [];
        const safeDeviceRows = Array.isArray(deviceRows) ? deviceRows : [];
        const hasOwnDevice = safeDeviceRows.some(
          (row) => row?.id === device.deviceId
        );
        if (!hasOwnDevice) {
          safeDeviceRows.push({
            id: device.deviceId,
            user_id: user.id,
            public_key: device.publicKey,
          });
        }
        for (const deviceRow of safeDeviceRows) {
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
          const { error: upsertError } = await supabase
            .from("conversation_keys")
            .upsert(rows, {
            onConflict: "conversation_id,user_id,device_id",
          });
          if (upsertError) {
            throw new Error(upsertError.message);
          }
        }
      } catch {
        // best-effort
      }

      if (!backupKeyRef.current || !bundleRef.current) return key;
      bundleRef.current.conversations[conversationId] = toBase64(raw);
      await persistBackupBundle(user.id);

      return key;
    },
    [conversationKeys, status, supabase, ensureDevice, persistBackupBundle]
  );

  const refreshDeviceKeys = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;
    const added = await loadDeviceKeys(user.id);
    return added;
  }, [loadDeviceKeys, supabase]);

  const reshareConversationKey = useCallback(
    async (conversationId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;
      const key = conversationKeys.get(conversationId);
      if (!key) return 0;

      const raw = await exportAesKey(key);
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conversationId);
      const memberIds = Array.from(
        new Set((members ?? []).map((m) => m.user_id))
      );
      if (!memberIds.length) return 0;
      const { data: deviceRows } = await supabase
        .from("user_devices")
        .select("id, user_id, public_key")
        .in("user_id", memberIds);
      if (!deviceRows?.length) return 0;

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
        await supabase.from("conversation_keys").upsert(rows, {
          onConflict: "conversation_id,user_id,device_id",
        });
      }
      return rows.length;
    },
    [conversationKeys, supabase]
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
