"use client";

import { Alert, Button, Card, Description, FieldError, Form, Label, Skeleton, Spinner, TextArea, TextField, toast } from "@heroui/react";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { jokeLength, type Joke } from "@/lib/jokes";
import { ApiError, apiErrorMessage, errorStatus } from "./api-errors";
import { AuthControls, authClient } from "./auth-controls";
import { htmlLang, useLocale, type Messages } from "./locale";

const en = {
  title: "Share a joke",
  signedOut: "Sign in to share a joke in English, Spanish, or Chinese and rate how each version travels. Anyone can read the adaptations.",
  signedIn: "Write it in English, Spanish, or Chinese. We keep your wording as the original and make versions for the other two cultures that keep your punchline. It takes a few seconds.",
  label: "Your joke (English, Spanish, or Chinese)",
  placeholder: "I’m reading a book about anti-gravity. It’s impossible to put down.",
  count: (length: number) => `${length} / ${jokeLength.max} characters · at least ${jokeLength.min}`,
  tooShort: `Write at least ${jokeLength.min} characters.`,
  tooLong: `Keep it under ${jokeLength.max} characters.`,
  examples: "Need inspiration? Try one:",
  examplesLabel: "Example jokes",
  // Sample one-liners in the interface language; any of the three languages is accepted.
  samples: [
    "I told my plants a joke. Now they’re in stitches… of moss.",
    "I’m reading a book about anti-gravity. It’s impossible to put down.",
    "Why don’t skeletons fight each other? They don’t have the guts.",
    "My phone battery lasts longer than my New Year’s resolutions.",
  ],
  failedTitle: "Not adapted",
  failed: "Your joke could not be adapted. Please try again.",
  success: "Your joke is ready in three cultures.",
  pending: "Making 3 versions…",
  submit: "Adapt my joke",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    title: "Comparte un chiste",
    signedOut: "Inicia sesión para compartir un chiste en inglés, español o chino y calificar cómo viaja cada versión. Cualquiera puede leer las adaptaciones.",
    signedIn: "Escríbelo en inglés, español o chino. Conservamos tu texto como original y creamos versiones para las otras dos culturas que mantienen tu remate. Tarda unos segundos.",
    label: "Tu chiste (en inglés, español o chino)",
    placeholder: "—Camarero, hay una mosca en mi sopa. —Tranquilo, no come mucho.",
    count: (length) => `${length} / ${jokeLength.max} caracteres · mínimo ${jokeLength.min}`,
    tooShort: `Escribe al menos ${jokeLength.min} caracteres.`,
    tooLong: `Usa menos de ${jokeLength.max} caracteres.`,
    examples: "¿Necesitas inspiración? Prueba uno:",
    examplesLabel: "Chistes de ejemplo",
    samples: [
      "—Camarero, hay una mosca en mi sopa. —Tranquilo, no come mucho.",
      "Mi médico me dijo que caminara diez kilómetros al día. Llevo una semana y ya estoy a setenta de casa.",
      "—¿Por qué los pájaros no usan Facebook? —Porque ya tienen Twitter.",
      "La batería de mi móvil dura más que mis propósitos de Año Nuevo.",
    ],
    failedTitle: "No se pudo adaptar",
    failed: "No se pudo adaptar tu chiste. Inténtalo de nuevo.",
    success: "Tu chiste ya está listo en tres culturas.",
    pending: "Creando 3 versiones…",
    submit: "Adaptar mi chiste",
  },
  zh: {
    title: "分享一个笑话",
    signedOut: "登录后即可用英文、西班牙文或中文分享笑话，并为每个版本的“旅行效果”评分。所有人都可以阅读改编版本。",
    signedIn: "用你的语言分享笑话——英文、西班牙文或中文都可以。我们会保留你的原文，并为另外两种文化写出保留笑点的版本，只需几秒钟。",
    label: "你的笑话（英文、西班牙文或中文）",
    placeholder: "我在读一本关于反重力的书，根本放不下来。",
    count: (length) => `${length} / ${jokeLength.max} 个字符 · 至少 ${jokeLength.min} 个`,
    tooShort: `请至少输入 ${jokeLength.min} 个字符。`,
    tooLong: `请控制在 ${jokeLength.max} 个字符以内。`,
    examples: "需要灵感？试试这些：",
    examplesLabel: "示例笑话",
    samples: [
      "我在读一本关于反重力的书，根本放不下来。",
      "我的减肥计划非常成功：成功坚持了三天。",
      "我跟家里的绿萝讲了个笑话，它笑得叶子都黄了。",
      "手机电池都比我的新年计划坚持得久。",
    ],
    failedTitle: "改编失败",
    failed: "你的笑话未能改编，请重试。",
    success: "你的笑话已有三种文化版本。",
    pending: "正在生成 3 个版本…",
    submit: "改编我的笑话",
  },
};

export function JokeForm({ onCreated }: { onCreated: (joke: Joke) => void }) {
  const { data: session, isPending } = authClient.useSession();
  const locale = useLocale();
  const t = messages[locale];
  // The session store can resolve mid-hydration; render the server's placeholder until hydration finishes.
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Keep the status, not the text, so the message follows language switches.
  const [failure, setFailure] = useState<{ status: number | null } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFailure(null);
    try {
      const response = await fetch("/api/jokes", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: body.trim() }),
      });
      if (response.status !== 201) throw new ApiError(response.status);
      onCreated(await response.json() as Joke);
      setBody("");
      toast.success(t.success);
    } catch (reason) {
      setFailure({ status: errorStatus(reason) });
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated || isPending) return <Skeleton className="h-56 rounded-3xl" />;

  if (!session) {
    return (
      <Card aria-labelledby="share-title">
        <Card.Header>
          <Card.Title id="share-title">{t.title}</Card.Title>
          <Card.Description>{t.signedOut}</Card.Description>
        </Card.Header>
        <Card.Footer>
          <AuthControls />
        </Card.Footer>
      </Card>
    );
  }

  const length = body.trim().length;

  return (
    <Card aria-labelledby="share-title" aria-busy={submitting}>
      <Card.Header>
        <Card.Title id="share-title">{t.title}</Card.Title>
        <Card.Description>{t.signedIn}</Card.Description>
      </Card.Header>
      <Card.Content>
        <Form className="flex flex-col gap-4" onSubmit={submit}>
          <TextField name="body" isRequired value={body} onChange={setBody} maxLength={jokeLength.max} isDisabled={submitting}
            validate={(value) => {
              const trimmed = value.trim().length;
              if (trimmed < jokeLength.min) return t.tooShort;
              if (trimmed > jokeLength.max) return t.tooLong;
              return null;
            }}>
            <Label>{t.label}</Label>
            <TextArea rows={4} placeholder={t.placeholder} />
            <Description>{t.count(length)}</Description>
            <FieldError />
          </TextField>
          <div className="flex flex-col gap-2">
            <Description>{t.examples}</Description>
            <ul aria-label={t.examplesLabel} className="flex flex-wrap gap-2">
              {t.samples.map((example) => (
                <li key={example}>
                  <Button size="sm" variant="tertiary" className="h-auto rounded-full py-1.5 text-left whitespace-normal" lang={htmlLang[locale]}
                    isDisabled={submitting} onPress={() => setBody(example)}>
                    {example}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          {failure && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t.failedTitle}</Alert.Title>
                <Alert.Description>{apiErrorMessage(locale, failure.status, t.failed)}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <div className="flex">
            <Button type="submit" isPending={submitting}>
              {({ isPending: pending }) => (
                <>
                  {pending && <Spinner size="sm" color="current" />}
                  {pending ? t.pending : t.submit}
                </>
              )}
            </Button>
          </div>
        </Form>
      </Card.Content>
    </Card>
  );
}
