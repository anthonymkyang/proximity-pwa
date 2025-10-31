"use client";

import * as React from "react";
import { useEffect } from "react";
import Link from "next/link";
import BackButton from "@/components/ui/back-button";
import TopBar from "@/components/nav/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
  InputGroupText,
} from "@/components/ui/input-group";
import { ChevronLeft } from "lucide-react";

import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createClient } from "@/utils/supabase/client";
import { toast, Toaster } from "sonner";
import { Spinner } from "@/components/ui/spinner";

export default function EditProfilePage() {
  const form = useForm<{
    name: string;
    username: string;
    title: string;
    bio: string;
  }>({
    defaultValues: {
      name: "",
      username: "",
      title: "",
      bio: "",
    },
  });

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, username, profile_title, bio")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        form.reset({
          name: profile.name ?? "",
          username: profile.username ?? "",
          title: profile.profile_title ?? "",
          bio: profile.bio ?? "",
        });
      }

      setLoading(false);
    };
    loadProfile();
  }, [form]);

  async function onSubmit(values: {
    name: string;
    username: string;
    title: string;
    bio: string;
  }) {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Not authenticated");
      toast.error("You’re not signed in.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      name: values.name,
      username: values.username,
      profile_title: values.title,
      bio: values.bio,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error(error);
      toast.error("Couldn’t save your profile. Try again.");
      setSaving(false);
      return;
    }

    toast.success("Profile saved");
    setSaving(false);
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
      <TopBar
        leftContent={<BackButton />}
        rightContent={
          <Button
            onClick={() => form.handleSubmit(onSubmit)()}
            size="sm"
            className="rounded-full flex items-center gap-2"
            aria-label="Save profile"
            disabled={loading || saving}
          >
            {saving ? (
              <>
                <Spinner />
              </>
            ) : (
              "Save"
            )}
          </Button>
        }
      >
        <h1 className="px-1 pb-2 text-3xl font-extrabold tracking-tight">
          Edit profile
        </h1>
      </TopBar>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading profile…</p>
      ) : (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5 mt-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Anthony"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>What should we call you?</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <InputGroup>
                      <InputGroupAddon>
                        <Label htmlFor="email">@</Label>
                      </InputGroupAddon>
                      <Input
                        id="username"
                        type="text"
                        placeholder="username"
                        {...field}
                      />
                    </InputGroup>
                  </FormControl>
                  <FormDescription>Your unique handle.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profile title</FormLabel>
                  <FormControl>
                    <Input
                      id="title"
                      type="text"
                      placeholder="Weekend hiker, coffee lover"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A short tagline that describes you.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <InputGroup>
                      <InputGroupTextarea
                        id="bio"
                        placeholder="Tell people a bit about you..."
                        className="min-h-[120px]"
                        {...field}
                      />
                      <InputGroupAddon align="block-end">
                        <InputGroupText className="text-[10px]">
                          About you
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                  </FormControl>
                  <FormDescription>
                    You can add hobbies, interests, schedules, etc.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-2">
              <Button
                type="submit"
                className="rounded-full mx-auto flex items-center gap-2"
                disabled={saving}
              >
                {saving ? <Spinner /> : "Save changes"}
              </Button>
            </div>
          </form>
        </Form>
      )}
      <Toaster richColors position="top-center" />
    </div>
  );
}
