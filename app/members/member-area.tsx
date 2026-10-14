"use client";

import { Card, Typography } from "@heroui/react";
import { AvatarSettings } from "../avatar-settings";
import { useLocale, type Messages } from "../locale";

const en = {
  welcome: (name: string) => `Welcome, ${name}.`,
  signedInAs: (email: string) => `You are signed in as ${email}.`,
  momentTitle: "Your members-only moment",
  momentJoke: "I finally found the key to work-life balance. Unfortunately, it opens the snack drawer.",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    welcome: (name) => `Te damos la bienvenida, ${name}.`,
    signedInAs: (email) => `Iniciaste sesión como ${email}.`,
    momentTitle: "Tu momento exclusivo para miembros",
    momentJoke: "Por fin encontré la llave del equilibrio entre trabajo y vida personal. Lástima que abre el cajón de los snacks.",
  },
  zh: {
    welcome: (name) => `欢迎，${name}。`,
    signedInAs: (email) => `你当前登录的账号是 ${email}。`,
    momentTitle: "会员专属时刻",
    momentJoke: "我终于找到了平衡工作与生活的钥匙。可惜，它只能打开零食抽屉。",
  },
};

export function MemberArea({ userId, name, email }: { userId: string; name: string; email: string }) {
  const t = messages[useLocale()];
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Typography.Heading level={1}>{t.welcome(name)}</Typography.Heading>
        <Typography.Paragraph color="muted">{t.signedInAs(email)}</Typography.Paragraph>
      </div>
      <AvatarSettings userId={userId} name={name} />
      <Card>
        <Card.Header>
          <Card.Title>{t.momentTitle}</Card.Title>
        </Card.Header>
        <Card.Content>
          <Typography.Paragraph>{t.momentJoke}</Typography.Paragraph>
        </Card.Content>
      </Card>
    </div>
  );
}
