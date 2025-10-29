"use client";

import * as React from "react";
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

  function onSubmit(values: {
    name: string;
    username: string;
    title: string;
    bio: string;
  }) {
    // TODO: Wire to API
    console.log(values);
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-[calc(72px+env(safe-area-inset-bottom))]">
      <TopBar
        leftContent={<BackButton />}
        rightContent={
          <Button
            onClick={() => form.handleSubmit(onSubmit)()}
            size="sm"
            className="rounded-full"
            aria-label="Save profile"
          >
            Save
          </Button>
        }
      >
        <h1 className="px-1 pb-2 text-3xl font-extrabold tracking-tight">
          Edit profile
        </h1>
      </TopBar>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">
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
            <Button type="submit" className="rounded-full mx-auto block">
              Save changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
