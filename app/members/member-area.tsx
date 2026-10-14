"use client";

import { Chip, Typography } from "@heroui/react";
import { AvatarSettings } from "../avatar-settings";
import { useLocale, type Messages } from "../locale";
import { MyJokes } from "./my-jokes";
import { MyRatings } from "./my-ratings";

const en = {
  badge: "Personal center",
  welcome: (name: string) => `Welcome, ${name}.`,
  signedInAs: (email: string) => `You are signed in as ${email}.`,
};

const messages: Messages<typeof en> = {
  en,
  es: {
    badge: "Centro personal",
    welcome: (name) => `Te damos la bienvenida, ${name}.`,
    signedInAs: (email) => `Iniciaste sesión como ${email}.`,
  },
  zh: {
    badge: "个人中心",
    welcome: (name) => `欢迎，${name}。`,
    signedInAs: (email) => `你当前登录的账号是 ${email}。`,
  },
};

export function MemberArea({ userId, name, email }: { userId: string; name: string; email: string }) {
  const t = messages[useLocale()];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Chip color="accent" variant="soft" className="w-fit">{t.badge}</Chip>
        <Typography.Heading level={1}>{t.welcome(name)}</Typography.Heading>
        <Typography.Paragraph color="muted">{t.signedInAs(email)}</Typography.Paragraph>
      </div>
      <MyJokes />
      <MyRatings />
      <AvatarSettings userId={userId} name={name} />
    </div>
  );
}
