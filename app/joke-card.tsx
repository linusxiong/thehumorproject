"use client";

import { Alert, Avatar, Button, Card, Chip, Description, Disclosure, FieldError, Form, Label, Link, Meter, Modal, Separator, Spinner, Surface, Tabs, TextArea, TextField, ToggleButton, Tooltip, Typography, toast } from "@heroui/react";
import { useId, useRef, useState, type FormEvent } from "react";
import { audiences, dailyExplanationLimit, explanationLength, localized, type Adaptation, type AudienceId, type Joke } from "@/lib/jokes";
import { ApiError, apiErrorMessage, errorStatus } from "./api-errors";
import { cultureColors, sourceName } from "./cultures";
import { audienceCultures, audienceNames, htmlLang, useLocale, type Locale, type Messages } from "./locale";
import { LaughIcon, MehIcon } from "./rating-icons";

type Audience = (typeof audiences)[number];

const en = {
  original: "Original",
  demo: "Demo",
  sourceInfo: "about imported jokes",
  by: (name: string) => `by ${name}`,
  versions: "Versions of this joke",
  compare: "Compare",
  missing: (name: string) => `No ${name} version is available: the adaptation for this audience could not be generated.`,
  core: "Core punchline",
  coreHint: "The comic idea every version has to keep, whatever the wording.",
  whatChanged: "What changed",
  translation: "Translation",
  ownPrompt: "As an English speaker, is this still funny for you?",
  otherPrompt: (audience: AudienceId) =>
    `Still funny for ${{ en: "English", es: "Spanish", zh: "Chinese" }[audience]}-speaking readers?`,
  stillFunny: "Still funny",
  notFunny: "Not funny",
  withdraw: (label: string) => `Withdraw your “${label}” rating`,
  signIn: "Sign in to rate this version.",
  withdrawHint: "Select your rating again to withdraw it.",
  saveFailed: "Your rating could not be saved. Please try again.",
  compareIntro: "Does the same punchline land in every culture? Read each culture's version side by side, with its comic core underneath.",
  samePunchline: "Same punchline?",
  meter: (total: number) => `Still funny · ${total} ${total === 1 ? "rating" : "ratings"}`,
  noRatings: "No ratings yet.",
  hidden: "Rate any version to see how it traveled.",
  adult: "18+",
  adultLabel: "Adult humor, labeled 18+",
  explanationTitle: "Why it’s funny",
  explanationSource: { author: "From the author", community: "Added by a community member" },
  suggest: "Suggest the real meaning",
  suggestTitle: "What does this joke really mean?",
  suggestIntro: "If the versions missed the joke, explain what actually makes it funny. We check that your explanation fits the joke, then regenerate all three versions from it. Their ratings are reset, and your explanation is shown on the joke as added by a community member, without your name.",
  suggestLabel: "The real meaning",
  suggestPlaceholder: "Point out any hidden pun, homophone, double meaning, or innuendo, and what the punchline really says.",
  suggestCount: (length: number) => `${length} / ${explanationLength.max} characters · at least ${explanationLength.min}`,
  suggestTooShort: `Write at least ${explanationLength.min} characters.`,
  suggestTooLong: `Keep it under ${explanationLength.max} characters.`,
  suggestSubmit: "Regenerate versions",
  suggestPending: "Regenerating versions…",
  cancel: "Cancel",
  close: "Close",
  suggestSuccess: "Thanks! The versions now follow your explanation.",
  suggestFailedTitle: "Explanation not applied",
  suggestRejected: "We couldn’t match that explanation to the joke. Make sure it explains this joke’s punchline.",
  suggestLimit: `You’ve reached today’s limit of ${dailyExplanationLimit} explanations. Come back in 24 hours.`,
  suggestFailed: "We couldn’t regenerate the versions right now. Please try again.",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    original: "Original",
    demo: "Demo",
    sourceInfo: "sobre los chistes importados",
    by: (name) => `de ${name}`,
    versions: "Versiones de este chiste",
    compare: "Comparar",
    missing: (name) => `No hay versión en ${name.toLocaleLowerCase("es")}: no se pudo generar la adaptación para este público.`,
    core: "Remate central",
    coreHint: "La idea cómica que toda versión debe conservar, cambie lo que cambie la redacción.",
    whatChanged: "Qué cambió",
    translation: "Traducción",
    ownPrompt: "Como hispanohablante, ¿te sigue pareciendo gracioso?",
    otherPrompt: (audience) =>
      `¿Sigue siendo gracioso para lectores ${{ en: "angloparlantes", es: "hispanohablantes", zh: "de habla china" }[audience]}?`,
    stillFunny: "Sigue siendo gracioso",
    notFunny: "No tiene gracia",
    withdraw: (label) => `Retirar tu voto “${label}”`,
    signIn: "Inicia sesión para calificar esta versión.",
    withdrawHint: "Vuelve a seleccionar tu voto para retirarlo.",
    saveFailed: "No se pudo guardar tu voto. Inténtalo de nuevo.",
    compareIntro: "¿El mismo remate funciona en todas las culturas? Lee la versión de cada cultura lado a lado, con su núcleo cómico debajo.",
    samePunchline: "¿El mismo remate?",
    meter: (total) => `Sigue siendo gracioso · ${total} ${total === 1 ? "voto" : "votos"}`,
    noRatings: "Todavía no hay votos.",
    hidden: "Califica cualquier versión para ver cómo viajó.",
    adult: "18+",
    adultLabel: "Humor para adultos, marcado como 18+",
    explanationTitle: "Por qué tiene gracia",
    explanationSource: { author: "Del autor", community: "Aportado por un miembro de la comunidad" },
    suggest: "Sugerir el significado real",
    suggestTitle: "¿Qué significa realmente este chiste?",
    suggestIntro: "Si las versiones no captaron el chiste, explica qué lo hace gracioso de verdad. Comprobamos que tu explicación encaje con el chiste y volvemos a generar las tres versiones a partir de ella. Sus votos se reinician, y tu explicación aparece en el chiste como aporte de un miembro de la comunidad, sin tu nombre.",
    suggestLabel: "El significado real",
    suggestPlaceholder: "Señala cualquier juego de palabras oculto, homófono, doble sentido o insinuación, y qué dice realmente el remate.",
    suggestCount: (length) => `${length} / ${explanationLength.max} caracteres · mínimo ${explanationLength.min}`,
    suggestTooShort: `Escribe al menos ${explanationLength.min} caracteres.`,
    suggestTooLong: `Usa menos de ${explanationLength.max} caracteres.`,
    suggestSubmit: "Regenerar versiones",
    suggestPending: "Regenerando versiones…",
    cancel: "Cancelar",
    close: "Cerrar",
    suggestSuccess: "¡Gracias! Las versiones ya siguen tu explicación.",
    suggestFailedTitle: "No se aplicó la explicación",
    suggestRejected: "No pudimos relacionar esa explicación con el chiste. Asegúrate de que explique el remate de este chiste.",
    suggestLimit: `Llegaste al límite de ${dailyExplanationLimit} explicaciones por día. Vuelve en 24 horas.`,
    suggestFailed: "No pudimos regenerar las versiones en este momento. Inténtalo de nuevo.",
  },
  zh: {
    original: "原文",
    demo: "示例",
    sourceInfo: "关于导入的笑话",
    by: (name) => `${name} 发布`,
    versions: "这个笑话的各个版本",
    compare: "对比",
    missing: (name) => `暂无${name}版本：未能为该读者群生成改编。`,
    core: "核心笑点",
    coreHint: "无论措辞如何变化，每个版本都必须保留的笑点。",
    whatChanged: "改动说明",
    translation: "译文",
    ownPrompt: "作为中文读者，你觉得这个版本还好笑吗？",
    otherPrompt: (audience) => `对${{ en: "英语", es: "西班牙语", zh: "中文" }[audience]}读者来说还好笑吗？`,
    stillFunny: "还好笑",
    notFunny: "不好笑",
    withdraw: (label) => `撤回你的“${label}”评分`,
    signIn: "登录后即可为此版本评分。",
    withdrawHint: "再次点击你的评分即可撤回。",
    saveFailed: "评分未能保存，请重试。",
    compareIntro: "同一个笑点在每种文化里都能成立吗？并排阅读各文化改编后的版本，下方附有核心笑点。",
    samePunchline: "笑点一致吗？",
    meter: (total) => `还好笑 · ${total} 个评分`,
    noRatings: "暂无评分。",
    hidden: "给任意版本评分，即可查看它的旅行成绩。",
    adult: "18+",
    adultLabel: "成人幽默，标记为 18+",
    explanationTitle: "笑点说明",
    explanationSource: { author: "作者说明", community: "社区用户补充" },
    suggest: "补充真实笑点",
    suggestTitle: "这个笑话真正的笑点是什么？",
    suggestIntro: "如果各版本没有理解这个笑话，请说明它真正好笑在哪里。我们会核对你的说明是否符合这个笑话，再据此重新生成三个版本。这些版本的评分会被清零，你的说明会以“社区用户补充”的形式显示在笑话上，不会显示你的名字。",
    suggestLabel: "真实笑点",
    suggestPlaceholder: "指出其中隐藏的双关、谐音、一语双关或暗示，以及笑点真正想说的是什么。",
    suggestCount: (length) => `${length} / ${explanationLength.max} 个字符 · 至少 ${explanationLength.min} 个`,
    suggestTooShort: `请至少输入 ${explanationLength.min} 个字符。`,
    suggestTooLong: `请控制在 ${explanationLength.max} 个字符以内。`,
    suggestSubmit: "重新生成版本",
    suggestPending: "正在重新生成版本…",
    cancel: "取消",
    close: "关闭",
    suggestSuccess: "谢谢！各版本已按照你的说明重新改编。",
    suggestFailedTitle: "说明未被采用",
    suggestRejected: "我们无法将这段说明与这个笑话对应起来。请确认它解释的是这个笑话的笑点。",
    suggestLimit: `你今天已达到 ${dailyExplanationLimit} 条说明的上限，请 24 小时后再来。`,
    suggestFailed: "我们暂时无法重新生成版本，请重试。",
  },
};

const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86_400_000], ["hour", 3_600_000], ["minute", 60_000]];

export function postedAt(iso: string, locale: Locale) {
  const date = new Date(iso);
  const elapsed = date.getTime() - Date.now();
  if (Math.abs(elapsed) < 7 * 86_400_000) {
    const format = new Intl.RelativeTimeFormat(htmlLang[locale], { numeric: "auto" });
    for (const [unit, size] of relativeUnits) {
      if (Math.abs(elapsed) >= size) return format.format(Math.round(elapsed / size), unit);
    }
    return format.format(0, "minute");
  }
  return new Intl.DateTimeFormat(htmlLang[locale], { dateStyle: "medium" }).format(date);
}

// Mirror the server's change locally until the saved joke comes back.
function withRating(adaptation: Adaptation, rating: boolean | null): Adaptation {
  const next = { ...adaptation, user_rating: rating };
  if (next.funny !== undefined && next.not_funny !== undefined) {
    if (adaptation.user_rating === true) next.funny -= 1;
    if (adaptation.user_rating === false) next.not_funny -= 1;
    if (rating === true) next.funny += 1;
    if (rating === false) next.not_funny += 1;
  }
  return next;
}

const avatarColors = ["accent", "success", "warning", "danger", "default"] as const;

export function JokeCard({ joke, signedIn, onChange }: {
  joke: Joke;
  signedIn: boolean;
  onChange: (joke: Joke) => void;
}) {
  const locale = useLocale();
  const t = messages[locale];
  const titleId = useId();
  const versions = audiences.flatMap((audience) => {
    const adaptation = joke.adaptations.find((item) => item.audience === audience.id);
    return adaptation ? [{ audience, adaptation }] : [];
  });
  const missing = audiences.filter((audience) => !versions.some((version) => version.audience.id === audience.id));
  const preferredTab = versions.some((version) => version.audience.id === locale) ? locale : versions[0]?.audience.id ?? "compare";

  // Follow the reader's language until they pick a tab on this card themselves.
  const [tab, setTab] = useState<string>(preferredTab);
  const [followedTab, setFollowedTab] = useState(preferredTab);
  if (followedTab !== preferredTab) {
    setFollowedTab(preferredTab);
    setTab(preferredTab);
  }

  const submitting = useRef(false);
  const [pendingId, setPendingId] = useState<number | null>(null);

  async function rate(adaptation: Adaptation, funny: boolean) {
    if (!signedIn || submitting.current) return;
    submitting.current = true;
    setPendingId(adaptation.id);
    const withdraw = adaptation.user_rating === funny;
    const previous = joke;
    onChange({
      ...joke,
      adaptations: joke.adaptations.map((item) => (item.id === adaptation.id ? withRating(item, withdraw ? null : funny) : item)),
    });
    try {
      const response = await fetch("/api/joke-ratings", {
        method: withdraw ? "DELETE" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withdraw ? { adaptationId: adaptation.id } : { adaptationId: adaptation.id, funny }),
      });
      if (!response.ok) throw new ApiError(response.status);
      onChange(await response.json() as Joke);
    } catch (reason) {
      onChange(previous);
      toast.danger(apiErrorMessage(locale, errorStatus(reason), t.saveFailed));
    } finally {
      submitting.current = false;
      setPendingId(null);
    }
  }

  const initials = joke.author_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  // A stable color per author keeps the feed varied without storing anything.
  const avatarColor = avatarColors[[...joke.author_name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarColors.length];

  return (
    <Card aria-labelledby={titleId}>
      <Card.Header className="gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar size="sm" variant="soft" color={avatarColor} aria-hidden="true">
            {joke.author_avatar_url && <Avatar.Image src={joke.author_avatar_url} alt="" referrerPolicy="no-referrer" />}
            <Avatar.Fallback>{initials || "?"}</Avatar.Fallback>
          </Avatar>
          <Typography.Paragraph size="xs" color="muted">
            {t.by(joke.author_name)} · <time dateTime={joke.created_at} title={new Date(joke.created_at).toLocaleString(htmlLang[locale])}>
              {postedAt(joke.created_at, locale)}
            </time>
          </Typography.Paragraph>
          <div className="flex flex-wrap gap-2">
            <Chip size="sm" variant="soft" color={cultureColors[joke.source_language]}>
              {t.original} · {audienceNames[locale][joke.source_language]}
            </Chip>
            {joke.origin === "demo" && <Chip size="sm" variant="soft" color="warning">{t.demo}</Chip>}
            {joke.origin === "import" && joke.source_label && (
              <Link href="/terms#sources" aria-label={`${sourceName(joke.source_label, locale)} · ${t.sourceInfo}`}>
                <Chip size="sm" variant="soft">{sourceName(joke.source_label, locale)}</Chip>
              </Link>
            )}
            {joke.adult && <Chip size="sm" variant="soft" color="danger" title={t.adultLabel}>{t.adult}</Chip>}
          </div>
        </div>
        <Card.Title id={titleId} lang={htmlLang[joke.source_language]} className="text-lg sm:text-xl">{joke.body}</Card.Title>
      </Card.Header>
      <Card.Content className="gap-4">
        {joke.explanation && (
          <Surface variant="secondary" className="flex flex-col gap-1 rounded-2xl p-4">
            <Typography.Paragraph size="sm" weight="semibold">{t.explanationTitle}</Typography.Paragraph>
            <Typography.Paragraph size="sm" className="whitespace-pre-line">{joke.explanation}</Typography.Paragraph>
            {joke.explanation_source && <Typography.Paragraph size="xs" color="muted">{t.explanationSource[joke.explanation_source]}</Typography.Paragraph>}
          </Surface>
        )}
        <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
          <Tabs.ListContainer>
            <Tabs.List aria-label={t.versions}>
              {versions.map(({ audience }) => (
                <Tabs.Tab key={audience.id} id={audience.id}>
                  {audienceNames[locale][audience.id]}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
              <Tabs.Tab id="compare">
                {t.compare}
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          {versions.map(({ audience, adaptation }) => (
            <Tabs.Panel key={audience.id} id={audience.id} className="flex flex-col gap-4 pt-4">
              <Version audience={audience} adaptation={adaptation} original={audience.id === joke.source_language} signedIn={signedIn}
                pending={pendingId === adaptation.id} locked={pendingId !== null} onRate={(funny) => rate(adaptation, funny)} />
            </Tabs.Panel>
          ))}
          <Tabs.Panel id="compare" className="flex flex-col gap-4 pt-4">
            <Compare joke={joke} versions={versions} />
          </Tabs.Panel>
        </Tabs>
        {missing.map((audience) => (
          <Typography.Paragraph key={audience.id} size="sm" color="muted">
            {t.missing(audienceNames[locale][audience.id])}
          </Typography.Paragraph>
        ))}
      </Card.Content>
      {signedIn && (
        <Card.Footer>
          <SuggestMeaning joke={joke} onChange={onChange} />
        </Card.Footer>
      )}
    </Card>
  );
}

function SuggestMeaning({ joke, onChange }: { joke: Joke; onChange: (joke: Joke) => void }) {
  const locale = useLocale();
  const t = messages[locale];
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [pending, setPending] = useState(false);
  // Keep the status, not the text, so the message follows language switches.
  const [failure, setFailure] = useState<{ status: number | null } | null>(null);

  function openChange(next: boolean) {
    if (pending) return;
    if (next) {
      setExplanation("");
      setFailure(null);
    }
    setOpen(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setFailure(null);
    try {
      const response = await fetch("/api/joke-explanations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jokeId: joke.id, explanation: explanation.trim() }),
      });
      if (response.status !== 200) throw new ApiError(response.status);
      onChange(await response.json() as Joke);
      setOpen(false);
      toast.success(t.suggestSuccess);
    } catch (reason) {
      setFailure({ status: errorStatus(reason) });
    } finally {
      setPending(false);
    }
  }

  function failureMessage(status: number | null) {
    if (status === 422) return t.suggestRejected;
    if (status === 429) return t.suggestLimit;
    if (status === 502) return t.suggestFailed;
    return apiErrorMessage(locale, status, t.suggestFailed);
  }

  const length = explanation.trim().length;

  return (
    <Modal isOpen={open} onOpenChange={openChange}>
      <Button size="sm" variant="tertiary">{t.suggest}</Button>
      <Modal.Backdrop isDismissable={!pending} isKeyboardDismissDisabled={pending}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger isDisabled={pending} aria-label={t.close} />
            <Modal.Header>
              <Modal.Heading>{t.suggestTitle}</Modal.Heading>
            </Modal.Header>
            <Form className="flex flex-col gap-4" onSubmit={submit}>
              <Modal.Body className="flex flex-col gap-4">
                <Typography.Paragraph size="sm" color="muted">{t.suggestIntro}</Typography.Paragraph>
                <Typography.Paragraph lang={htmlLang[joke.source_language]} className="whitespace-pre-line">{joke.body}</Typography.Paragraph>
                <TextField name="explanation" isRequired value={explanation} onChange={setExplanation} maxLength={explanationLength.max}
                  isDisabled={pending}
                  validate={(value) => {
                    const trimmed = value.trim().length;
                    if (trimmed < explanationLength.min) return t.suggestTooShort;
                    if (trimmed > explanationLength.max) return t.suggestTooLong;
                    return null;
                  }}>
                  <Label>{t.suggestLabel}</Label>
                  <TextArea rows={4} placeholder={t.suggestPlaceholder} />
                  <Description>{t.suggestCount(length)}</Description>
                  <FieldError />
                </TextField>
                {failure && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{t.suggestFailedTitle}</Alert.Title>
                      <Alert.Description>{failureMessage(failure.status)}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" isDisabled={pending} onPress={() => openChange(false)}>{t.cancel}</Button>
                <Button type="submit" isPending={pending}>
                  {({ isPending }) => (
                    <>
                      {isPending && <Spinner size="sm" color="current" />}
                      {isPending ? t.suggestPending : t.suggestSubmit}
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function Version({ audience, adaptation, original, signedIn, pending, locked, onRate }: {
  audience: Audience;
  adaptation: Adaptation;
  // True for the version in the joke's source language, which keeps the member's wording.
  original: boolean;
  signedIn: boolean;
  pending: boolean;
  locked: boolean;
  onRate: (funny: boolean) => void;
}) {
  const locale = useLocale();
  const t = messages[locale];
  const promptId = useId();
  const prompt = audience.id === locale ? t.ownPrompt : t.otherPrompt(audience.id);
  const rating = adaptation.user_rating;
  // Replays the icon animation each time the reader picks an answer (not for ratings loaded from the server).
  const [burst, setBurst] = useState<{ funny: boolean; key: number } | null>(null);
  // A translation helps only when the version is in a language other than the reader's.
  const gloss = audience.id === locale ? "" : localized(adaptation.gloss, locale);
  const notes = localized(adaptation.notes, locale);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Chip size="sm" variant="soft" color={cultureColors[audience.id]}>{audienceCultures[locale][audience.id]}</Chip>
        {original && <Chip size="sm" variant="soft" color="accent">{t.original}</Chip>}
      </div>
      <Typography.Paragraph weight="medium" lang={audience.lang} className="text-lg">{adaptation.body}</Typography.Paragraph>
      {gloss && (
        <div className="flex flex-col gap-1">
          <Typography.Paragraph size="xs" color="muted" weight="semibold">{t.translation}</Typography.Paragraph>
          <Typography.Paragraph size="sm">{gloss}</Typography.Paragraph>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Tooltip delay={300}>
          <Tooltip.Trigger tabIndex={0} className="w-fit rounded-sm">
            <Typography.Paragraph size="xs" color="muted" weight="semibold">{t.core}</Typography.Paragraph>
          </Tooltip.Trigger>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            {t.coreHint}
          </Tooltip.Content>
        </Tooltip>
        <Typography.Paragraph size="sm">{localized(adaptation.punchline_core, locale)}</Typography.Paragraph>
      </div>
      {notes && (
        <Disclosure>
          <Disclosure.Heading>
            <Button slot="trigger" size="sm" variant="tertiary">
              {t.whatChanged}
              <Disclosure.Indicator />
            </Button>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="pt-2">
              <Typography.Paragraph size="sm">{notes}</Typography.Paragraph>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      )}
      <Separator />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Typography.Paragraph id={promptId} size="sm" weight="medium">{prompt}</Typography.Paragraph>
        <div className="flex items-center gap-2" role="group" aria-labelledby={promptId} aria-busy={pending}>
          {([true, false] as const).map((funny) => {
            const label = funny ? t.stillFunny : t.notFunny;
            const Icon = funny ? LaughIcon : MehIcon;
            const animating = burst?.funny === funny;
            return (
              <ToggleButton key={String(funny)} size="sm" isSelected={rating === funny} isDisabled={!signedIn || locked}
                className={`relative overflow-visible ${funny ? "data-[selected=true]:bg-success-soft data-[selected=true]:text-success" : "data-[selected=true]:bg-danger-soft data-[selected=true]:text-danger"}`}
                onChange={() => {
                  if (rating !== funny) setBurst((current) => ({ funny, key: (current?.key ?? 0) + 1 }));
                  onRate(funny);
                }}
                aria-label={rating === funny ? t.withdraw(label) : undefined}>
                <span key={animating ? burst.key : "idle"} className={`inline-flex ${animating ? (funny ? "motion-safe:animate-laugh" : "motion-safe:animate-shrug") : ""}`}>
                  <Icon />
                </span>
                {label}
                {animating && funny && (
                  <span key={`float-${burst.key}`} aria-hidden="true" className="pointer-events-none absolute -top-2 left-2 text-success motion-safe:animate-float-up motion-reduce:hidden">
                    <LaughIcon />
                  </span>
                )}
              </ToggleButton>
            );
          })}
        </div>
      </div>
      {!signedIn && <Typography.Paragraph size="xs" color="muted">{t.signIn}</Typography.Paragraph>}
      {signedIn && rating !== null && <Typography.Paragraph size="xs" color="muted">{t.withdrawHint}</Typography.Paragraph>}
    </>
  );
}

function Compare({ joke, versions }: { joke: Joke; versions: { audience: Audience; adaptation: Adaptation }[] }) {
  const locale = useLocale();
  const t = messages[locale];
  return (
    <>
      <div className="flex flex-col gap-1">
        <Typography.Heading level={5}>{t.samePunchline}</Typography.Heading>
        <Typography.Paragraph size="sm" color="muted">{t.compareIntro}</Typography.Paragraph>
      </div>
      <ul className="grid gap-3 md:grid-cols-3">
        {versions.map(({ audience, adaptation }) => {
          const funny = adaptation.funny ?? 0;
          const total = funny + (adaptation.not_funny ?? 0);
          return (
            <li key={audience.id} className="flex">
              <Card variant="secondary" className="w-full">
                <Card.Content className="gap-3">
                  <div>
                    <Chip size="sm" variant="soft" color={cultureColors[audience.id]}>{audienceNames[locale][audience.id]}</Chip>
                  </div>
                  {/* Each column shows that culture's own version; the core punchline, in the reader's language, lines them up. */}
                  <Typography.Paragraph weight="medium" lang={audience.lang}>{adaptation.body}</Typography.Paragraph>
                  <div className="flex flex-col gap-1">
                    <Typography.Paragraph size="xs" color="muted" weight="semibold">{t.core}</Typography.Paragraph>
                    <Typography.Paragraph size="xs" color="muted">{localized(adaptation.punchline_core, locale)}</Typography.Paragraph>
                  </div>
                  {joke.revealed && (total > 0 ? (
                    <Meter value={Math.round((funny / total) * 100)} size="sm" color={cultureColors[audience.id]} className="w-full">
                      <Label>{t.meter(total)}</Label>
                      <Meter.Output />
                      <Meter.Track>
                        <Meter.Fill />
                      </Meter.Track>
                    </Meter>
                  ) : (
                    <Typography.Paragraph size="xs" color="muted">{t.noRatings}</Typography.Paragraph>
                  ))}
                </Card.Content>
              </Card>
            </li>
          );
        })}
      </ul>
      {!joke.revealed && <Typography.Paragraph size="sm" color="muted">{t.hidden}</Typography.Paragraph>}
    </>
  );
}
