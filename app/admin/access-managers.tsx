"use client";

import { Alert } from "@heroui/react";
import NextLink from "next/link";
import type { SignupDomain, WhitelistedEmail } from "@/lib/admin-resources";
import type { AccessSummary } from "@/lib/admin-types";
import { useLocale, type Messages } from "../locale";
import { plural, useFormat } from "./admin-ui";
import { ResourceManager } from "./resource-manager";

const en = {
  domains: {
    title: "Sign-up domains",
    description: "Email domains whose Google accounts may sign in, such as columbia.edu. Matches the exact domain after the @, not its subdomains.",
    add: "Add domain",
    search: "Search domains",
    searchPlaceholder: "Domain",
    count: (count: string) => plural(count, "domain", "domains"),
    table: "Allowed sign-up domains",
    createTitle: "Allow a domain",
    editTitle: (label: string) => `Edit ${label}`,
    deleteTitle: (label: string) => `Remove ${label}?`,
    deleteBody: (label: string) => `New sign-ins from ${label} will be refused unless the email is whitelisted. If this is the last entry on both lists, sign-in opens to every Google account.`,
    created: "Domain allowed.",
    saved: "Domain saved.",
    deleted: "Domain removed.",
    duplicate: "This domain is already on the list.",
    empty: "No domains are listed.",
  },
  emails: {
    title: "Whitelisted emails",
    description: "Individual Google accounts that may sign in whatever their domain, such as a guest reviewer.",
    add: "Add email",
    search: "Search emails",
    searchPlaceholder: "Email address",
    count: (count: string) => plural(count, "email", "emails"),
    table: "Whitelisted email addresses",
    createTitle: "Whitelist an email",
    editTitle: (label: string) => `Edit ${label}`,
    deleteTitle: (label: string) => `Remove ${label}?`,
    deleteBody: (label: string) => `${label} will be refused at its next sign-in unless its domain is allowed. If this is the last entry on both lists, sign-in opens to every Google account.`,
    created: "Email whitelisted.",
    saved: "Email saved.",
    deleted: "Email removed.",
    duplicate: "This email is already on the list.",
    empty: "No emails are listed.",
  },
  domain: "Domain",
  domainHint: "Lowercase, without the @, such as example.edu.",
  email: "Email address",
  emailHint: "The Google account's address; letters are stored in lowercase.",
  openTitle: "Sign-in is open to every Google account",
  openBody: "Both lists are empty. Add a domain or an email to limit who can sign in.",
  restrictedTitle: "Sign-in is limited",
  restrictedBody: (domains: string, emails: string) => `Only verified Google accounts on ${domains} or ${emails} can sign in. Superadmins can always sign in. Sessions already open last up to 24 hours.`,
  domainCount: (count: string) => plural(count, "allowed domain", "allowed domains"),
  emailCount: (count: string) => plural(count, "whitelisted email", "whitelisted emails"),
  otherList: { domains: "Manage whitelisted emails", emails: "Manage sign-up domains" },
};

const messages: Messages<typeof en> = {
  en,
  es: {
    domains: {
      title: "Dominios de registro",
      description: "Dominios de correo cuyas cuentas de Google pueden iniciar sesión, como columbia.edu. Coincide con el dominio exacto después de la @, no con sus subdominios.",
      add: "Añadir dominio",
      search: "Buscar dominios",
      searchPlaceholder: "Dominio",
      count: (count) => plural(count, "dominio", "dominios"),
      table: "Dominios de registro permitidos",
      createTitle: "Permitir un dominio",
      editTitle: (label) => `Editar ${label}`,
      deleteTitle: (label) => `¿Quitar ${label}?`,
      deleteBody: (label) => `Los nuevos inicios de sesión desde ${label} se rechazarán salvo que el correo esté autorizado. Si es la última entrada de ambas listas, el inicio de sesión se abre a todas las cuentas de Google.`,
      created: "Dominio permitido.",
      saved: "Dominio guardado.",
      deleted: "Dominio quitado.",
      duplicate: "Este dominio ya está en la lista.",
      empty: "No hay dominios en la lista.",
    },
    emails: {
      title: "Correos autorizados",
      description: "Cuentas de Google concretas que pueden iniciar sesión sea cual sea su dominio, como un revisor invitado.",
      add: "Añadir correo",
      search: "Buscar correos",
      searchPlaceholder: "Dirección de correo",
      count: (count) => plural(count, "correo", "correos"),
      table: "Direcciones de correo autorizadas",
      createTitle: "Autorizar un correo",
      editTitle: (label) => `Editar ${label}`,
      deleteTitle: (label) => `¿Quitar ${label}?`,
      deleteBody: (label) => `${label} se rechazará en su próximo inicio de sesión salvo que su dominio esté permitido. Si es la última entrada de ambas listas, el inicio de sesión se abre a todas las cuentas de Google.`,
      created: "Correo autorizado.",
      saved: "Correo guardado.",
      deleted: "Correo quitado.",
      duplicate: "Este correo ya está en la lista.",
      empty: "No hay correos en la lista.",
    },
    domain: "Dominio",
    domainHint: "En minúsculas y sin la @, como example.edu.",
    email: "Dirección de correo",
    emailHint: "La dirección de la cuenta de Google; se guarda en minúsculas.",
    openTitle: "El inicio de sesión está abierto a todas las cuentas de Google",
    openBody: "Las dos listas están vacías. Añade un dominio o un correo para limitar quién puede iniciar sesión.",
    restrictedTitle: "El inicio de sesión está limitado",
    restrictedBody: (domains, emails) => `Solo pueden iniciar sesión las cuentas de Google verificadas de ${domains} o ${emails}. Los superadministradores siempre pueden entrar. Las sesiones ya abiertas duran hasta 24 horas.`,
    domainCount: (count) => plural(count, "dominio permitido", "dominios permitidos"),
    emailCount: (count) => plural(count, "correo autorizado", "correos autorizados"),
    otherList: { domains: "Gestionar correos autorizados", emails: "Gestionar dominios de registro" },
  },
  zh: {
    domains: {
      title: "允许注册的域名",
      description: "这些邮箱域名下的 Google 账户可以登录，例如 columbia.edu。只匹配 @ 之后的完整域名，不包括子域名。",
      add: "添加域名",
      search: "搜索域名",
      searchPlaceholder: "域名",
      count: (count) => `${count} 个域名`,
      table: "允许注册的域名",
      createTitle: "允许一个域名",
      editTitle: (label) => `编辑 ${label}`,
      deleteTitle: (label) => `移除 ${label}？`,
      deleteBody: (label) => `来自 ${label} 的新登录将被拒绝，除非该邮箱在白名单中。如果这是两个列表中的最后一项，登录将对所有 Google 账户开放。`,
      created: "域名已允许。",
      saved: "域名已保存。",
      deleted: "域名已移除。",
      duplicate: "该域名已在列表中。",
      empty: "列表中没有域名。",
    },
    emails: {
      title: "邮箱白名单",
      description: "无论域名如何都可以登录的单个 Google 账户，例如受邀的审稿人。",
      add: "添加邮箱",
      search: "搜索邮箱",
      searchPlaceholder: "邮箱地址",
      count: (count) => `${count} 个邮箱`,
      table: "白名单邮箱地址",
      createTitle: "将邮箱加入白名单",
      editTitle: (label) => `编辑 ${label}`,
      deleteTitle: (label) => `移除 ${label}？`,
      deleteBody: (label) => `${label} 下次登录时将被拒绝，除非其域名被允许。如果这是两个列表中的最后一项，登录将对所有 Google 账户开放。`,
      created: "邮箱已加入白名单。",
      saved: "邮箱已保存。",
      deleted: "邮箱已移除。",
      duplicate: "该邮箱已在列表中。",
      empty: "列表中没有邮箱。",
    },
    domain: "域名",
    domainHint: "小写，不含 @，例如 example.edu。",
    email: "邮箱地址",
    emailHint: "Google 账户的邮箱地址，以小写保存。",
    openTitle: "登录对所有 Google 账户开放",
    openBody: "两个列表都是空的。添加域名或邮箱即可限制谁能登录。",
    restrictedTitle: "登录已受限",
    restrictedBody: (domains, emails) => `只有${domains}或${emails}中已验证的 Google 账户可以登录。超级管理员始终可以登录。已经打开的会话最长持续 24 小时。`,
    domainCount: (count) => `${count} 个允许的域名`,
    emailCount: (count) => `${count} 个白名单邮箱`,
    otherList: { domains: "管理邮箱白名单", emails: "管理允许注册的域名" },
  },
};

// Whether sign-in is currently open or limited, with a link to the other list.
function AccessNotice({ summary, list }: { summary: AccessSummary; list: "domains" | "emails" }) {
  const t = messages[useLocale()];
  const format = useFormat();
  const open = summary.domains === 0 && summary.emails === 0;
  return (
    <Alert status={open ? "default" : "warning"}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{open ? t.openTitle : t.restrictedTitle}</Alert.Title>
        <Alert.Description>
          {open ? t.openBody : t.restrictedBody(t.domainCount(format.number(summary.domains)), t.emailCount(format.number(summary.emails)))}{" "}
          <NextLink href={list === "domains" ? "/admin/whitelist" : "/admin/signup-domains"} className="underline underline-offset-2">
            {t.otherList[list]}
          </NextLink>
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

export function SignupDomainsManager({ rows, summary }: { rows: SignupDomain[]; summary: AccessSummary }) {
  const t = messages[useLocale()];
  return (
    <ResourceManager<SignupDomain> resource="signup-domains" rows={rows} text={t.domains}
      notice={<AccessNotice summary={summary} list="domains" />}
      label={(row) => row.domain}
      searchText={(row) => row.domain}
      toDraft={(row) => ({ domain: row.domain })}
      emptyDraft={{ domain: "" }}
      columns={[{ id: "domain", label: t.domain, isRowHeader: true, sortValue: (row) => row.domain, render: (row) => <span className="font-medium">@{row.domain}</span> }]}
      fields={[{ name: "domain", label: t.domain, description: t.domainHint, placeholder: "example.edu" }]}
    />
  );
}

export function WhitelistedEmailsManager({ rows, summary }: { rows: WhitelistedEmail[]; summary: AccessSummary }) {
  const t = messages[useLocale()];
  return (
    <ResourceManager<WhitelistedEmail> resource="whitelisted-emails" rows={rows} text={t.emails}
      notice={<AccessNotice summary={summary} list="emails" />}
      label={(row) => row.email}
      searchText={(row) => row.email}
      toDraft={(row) => ({ email: row.email })}
      emptyDraft={{ email: "" }}
      columns={[{ id: "email", label: t.email, isRowHeader: true, sortValue: (row) => row.email, render: (row) => <span className="font-medium">{row.email}</span> }]}
      fields={[{ name: "email", label: t.email, description: t.emailHint, placeholder: "guest@example.com" }]}
    />
  );
}
