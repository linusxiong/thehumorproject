"use client";

import { Alert, Typography } from "@heroui/react";
import { AuthControls } from "../auth-controls";

export function LoginPrompt({ failed }: { failed: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-start gap-6">
      <div className="flex flex-col gap-2">
        <Typography.Heading level={1}>A little more humor.</Typography.Heading>
        <Typography.Paragraph color="muted">Sign in with Google to visit the members area. The collection is always open to everyone.</Typography.Paragraph>
      </div>
      {failed && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Sign-in was not completed</Alert.Title>
            <Alert.Description>We could not complete your Google sign-in. Please try again.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <AuthControls />
    </div>
  );
}
