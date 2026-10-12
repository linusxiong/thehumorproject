"use client";

import { Card, Typography } from "@heroui/react";
import { AvatarSettings } from "../avatar-settings";

export function MemberArea({ userId, name, email }: { userId: string; name: string; email: string }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Typography.Heading level={1}>Welcome, {name}.</Typography.Heading>
        <Typography.Paragraph color="muted">You are signed in as {email}.</Typography.Paragraph>
      </div>
      <AvatarSettings userId={userId} name={name} />
      <Card>
        <Card.Header>
          <Card.Title>Your members-only moment</Card.Title>
        </Card.Header>
        <Card.Content>
          <Typography.Paragraph>I finally found the key to work-life balance. Unfortunately, it opens the snack drawer.</Typography.Paragraph>
        </Card.Content>
      </Card>
    </div>
  );
}
