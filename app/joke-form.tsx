"use client";

import { Alert, Button, Card, Chip, Description, FieldError, Form, Label, Skeleton, Spinner, TextArea, TextField, Typography, toast } from "@heroui/react";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { explanationLength, jokeLength, type Joke, type JokeAnalysis } from "@/lib/jokes";
import { ApiError, apiErrorMessage, errorStatus } from "./api-errors";
import { AuthControls, authClient } from "./auth-controls";
import { cultureColors } from "./cultures";
import { audienceNames, htmlLang, useLocale, type Locale, type Messages } from "./locale";

const en = {
  title: "Share a joke",
  signedOut: "Sign in to share a joke in English, Spanish, or Chinese and rate how each version travels. Anyone can read the adaptations.",
  signedIn: "Write it in English, Spanish, or Chinese. First we tell you what we think makes it funny so you can confirm or correct it; then we keep your wording as the original and make versions for the other two cultures that keep your punchline.",
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
  analyze: "Find the punchline",
  analyzing: "Finding the punchline…",
  analyzeFailedTitle: "Couldn’t read the joke",
  analyzeFailed: "We couldn’t work out this joke right now. Please try again.",
  notAJoke: "That doesn’t look like a joke in English, Spanish, or Chinese. Try a different one.",
  yourJoke: "Your joke",
  reviewTitle: "Here’s what we think makes it funny",
  original: (language: string) => `Original · ${language}`,
  adult: "18+",
  adultLabel: "Adult humor, labeled 18+",
  explanationLabel: "Why it’s funny",
  explanationHint: "Correct it if we misread it, for example a hidden pun, a homophone, or an innuendo. All three versions follow this explanation, and it is shown on your joke with your first name.",
  explanationCount: (length: number) => `${length} / ${explanationLength.max} characters · at least ${explanationLength.min}`,
  explanationTooShort: `Write at least ${explanationLength.min} characters.`,
  explanationTooLong: `Keep it under ${explanationLength.max} characters.`,
  editJoke: "Edit joke",
  failedTitle: "Not adapted",
  failed: "Your joke could not be adapted. Please try again.",
  success: "Your joke is ready in three cultures.",
  pending: "Making 3 versions…",
  submit: "Make 3 versions",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    title: "Comparte un chiste",
    signedOut: "Inicia sesión para compartir un chiste en inglés, español o chino y calificar cómo viaja cada versión. Cualquiera puede leer las adaptaciones.",
    signedIn: "Escríbelo en inglés, español o chino. Primero te contamos qué creemos que lo hace gracioso para que lo confirmes o lo corrijas; después conservamos tu texto como original y creamos versiones para las otras dos culturas que mantienen tu remate.",
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
    analyze: "Encontrar el remate",
    analyzing: "Buscando el remate…",
    analyzeFailedTitle: "No pudimos leer el chiste",
    analyzeFailed: "No pudimos entender este chiste en este momento. Inténtalo de nuevo.",
    notAJoke: "Eso no parece un chiste en inglés, español o chino. Prueba con otro.",
    yourJoke: "Tu chiste",
    reviewTitle: "Esto es lo que creemos que lo hace gracioso",
    original: (language) => `Original · ${language}`,
    adult: "18+",
    adultLabel: "Humor para adultos, marcado como 18+",
    explanationLabel: "Por qué tiene gracia",
    explanationHint: "Corrígelo si lo entendimos mal, por ejemplo un juego de palabras oculto, un homófono o un doble sentido. Las tres versiones siguen esta explicación, y se muestra en tu chiste con tu nombre de pila.",
    explanationCount: (length) => `${length} / ${explanationLength.max} caracteres · mínimo ${explanationLength.min}`,
    explanationTooShort: `Escribe al menos ${explanationLength.min} caracteres.`,
    explanationTooLong: `Usa menos de ${explanationLength.max} caracteres.`,
    editJoke: "Editar chiste",
    failedTitle: "No se pudo adaptar",
    failed: "No se pudo adaptar tu chiste. Inténtalo de nuevo.",
    success: "Tu chiste ya está listo en tres culturas.",
    pending: "Creando 3 versiones…",
    submit: "Crear 3 versiones",
  },
  zh: {
    title: "分享一个笑话",
    signedOut: "登录后即可用英文、西班牙文或中文分享笑话，并为每个版本的“旅行效果”评分。所有人都可以阅读改编版本。",
    signedIn: "用英文、西班牙文或中文写下你的笑话。我们会先说出我们理解的笑点，请你确认或修改；然后保留你的原文，并为另外两种文化写出保留笑点的版本。",
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
    analyze: "分析笑点",
    analyzing: "正在分析笑点…",
    analyzeFailedTitle: "未能读懂笑话",
    analyzeFailed: "我们暂时无法分析这个笑话，请重试。",
    notAJoke: "这看起来不像英文、西班牙文或中文的笑话。换一个试试吧。",
    yourJoke: "你的笑话",
    reviewTitle: "我们认为它的笑点在这里",
    original: (language) => `原文 · ${language}`,
    adult: "18+",
    adultLabel: "成人幽默，标记为 18+",
    explanationLabel: "笑点说明",
    explanationHint: "如果我们理解错了，请直接修改，比如隐藏的双关、谐音或暗示。三个版本都会按照这段说明来改编，它也会以你的名字显示在笑话上。",
    explanationCount: (length) => `${length} / ${explanationLength.max} 个字符 · 至少 ${explanationLength.min} 个`,
    explanationTooShort: `请至少输入 ${explanationLength.min} 个字符。`,
    explanationTooLong: `请控制在 ${explanationLength.max} 个字符以内。`,
    editJoke: "修改笑话",
    failedTitle: "改编失败",
    failed: "你的笑话未能改编，请重试。",
    success: "你的笑话已有三种文化版本。",
    pending: "正在生成 3 个版本…",
    submit: "生成 3 个版本",
  },
};

// The analysis plus the interface language its punchline was written in.
type Review = JokeAnalysis & { locale: Locale };

export function JokeForm({ onCreated }: { onCreated: (joke: Joke) => void }) {
  const { data: session, isPending } = authClient.useSession();
  const locale = useLocale();
  const t = messages[locale];
  // The session store can resolve mid-hydration; render the server's placeholder until hydration finishes.
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [body, setBody] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState<"analyze" | "adapt" | null>(null);
  // Keep the status, not the text, so the message follows language switches.
  const [failure, setFailure] = useState<{ step: "analyze" | "adapt"; status: number | null } | null>(null);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("analyze");
    setFailure(null);
    try {
      const response = await fetch("/api/jokes/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: body.trim(), locale }),
      });
      if (response.status !== 200) throw new ApiError(response.status);
      const analysis = await response.json() as JokeAnalysis;
      setReview({ ...analysis, locale });
      setExplanation(analysis.punchline);
    } catch (reason) {
      setFailure({ step: "analyze", status: errorStatus(reason) });
    } finally {
      setBusy(null);
    }
  }

  async function adapt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("adapt");
    setFailure(null);
    try {
      const response = await fetch("/api/jokes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), explanation: explanation.trim() }),
      });
      if (response.status !== 201) throw new ApiError(response.status);
      onCreated(await response.json() as Joke);
      setBody("");
      setReview(null);
      setExplanation("");
      toast.success(t.success);
    } catch (reason) {
      setFailure({ step: "adapt", status: errorStatus(reason) });
    } finally {
      setBusy(null);
    }
  }

  function editJoke() {
    setReview(null);
    setFailure(null);
  }

  function failureMessage({ step, status }: { step: "analyze" | "adapt"; status: number | null }) {
    if (step === "analyze") {
      if (status === 422) return t.notAJoke;
      if (status === 502) return t.analyzeFailed;
      return apiErrorMessage(locale, status, t.analyzeFailed);
    }
    return apiErrorMessage(locale, status, t.failed);
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

  const failureAlert = failure && (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{failure.step === "analyze" ? t.analyzeFailedTitle : t.failedTitle}</Alert.Title>
        <Alert.Description>{failureMessage(failure)}</Alert.Description>
      </Alert.Content>
    </Alert>
  );

  if (review) {
    const explanationTrimmed = explanation.trim().length;
    return (
      <Card aria-labelledby="share-title" aria-busy={busy !== null}>
        <Card.Header>
          <Card.Title id="share-title">{t.reviewTitle}</Card.Title>
        </Card.Header>
        <Card.Content>
          <Form className="flex flex-col gap-4" onSubmit={adapt}>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Typography.Paragraph size="sm" weight="medium">{t.yourJoke}</Typography.Paragraph>
                <Chip size="sm" variant="soft" color={cultureColors[review.sourceLanguage]}>
                  {t.original(audienceNames[locale][review.sourceLanguage])}
                </Chip>
                {review.adult && <Chip size="sm" variant="soft" color="danger" title={t.adultLabel}>{t.adult}</Chip>}
              </div>
              <Typography.Paragraph lang={htmlLang[review.sourceLanguage]} className="whitespace-pre-line">{body.trim()}</Typography.Paragraph>
            </div>
            <TextField name="explanation" isRequired value={explanation} onChange={setExplanation} maxLength={explanationLength.max}
              isDisabled={busy !== null}
              validate={(value) => {
                const trimmed = value.trim().length;
                if (trimmed < explanationLength.min) return t.explanationTooShort;
                if (trimmed > explanationLength.max) return t.explanationTooLong;
                return null;
              }}>
              <Label>{t.explanationLabel}</Label>
              <TextArea rows={4} lang={htmlLang[review.locale]} />
              <Description>{t.explanationHint} {t.explanationCount(explanationTrimmed)}</Description>
              <FieldError />
            </TextField>
            {failureAlert}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" isPending={busy === "adapt"}>
                {({ isPending: pending }) => (
                  <>
                    {pending && <Spinner size="sm" color="current" />}
                    {pending ? t.pending : t.submit}
                  </>
                )}
              </Button>
              <Button variant="tertiary" isDisabled={busy !== null} onPress={editJoke}>{t.editJoke}</Button>
            </div>
          </Form>
        </Card.Content>
      </Card>
    );
  }

  const length = body.trim().length;

  return (
    <Card aria-labelledby="share-title" aria-busy={busy !== null}>
      <Card.Header>
        <Card.Title id="share-title">{t.title}</Card.Title>
        <Card.Description>{t.signedIn}</Card.Description>
      </Card.Header>
      <Card.Content>
        <Form className="flex flex-col gap-4" onSubmit={analyze}>
          <TextField name="body" isRequired value={body} onChange={setBody} maxLength={jokeLength.max} isDisabled={busy !== null}
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
                    isDisabled={busy !== null} onPress={() => setBody(example)}>
                    {example}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          {failureAlert}
          <div className="flex">
            <Button type="submit" isPending={busy === "analyze"}>
              {({ isPending: pending }) => (
                <>
                  {pending && <Spinner size="sm" color="current" />}
                  {pending ? t.analyzing : t.analyze}
                </>
              )}
            </Button>
          </div>
        </Form>
      </Card.Content>
    </Card>
  );
}
