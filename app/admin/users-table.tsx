"use client";

import { Copy, Eye } from "@gravity-ui/icons";
import { Button, Chip, Label, ListBox, Modal, SearchField, Select, Table, Typography, toast, type SortDescriptor } from "@heroui/react";
import { useMemo, useState, type ReactNode } from "react";
import type { AdminAccount } from "@/lib/admin-types";
import { UserAvatar } from "../avatar";
import { useLocale, type Messages } from "../locale";
import { NoResults, PageHeading, plural, RatingCounts, shortId, StatTile, TablePager, TimeText, useAdminMessages, useFormat, useHydrated, usePaged } from "./admin-ui";

type Filter = "all" | "superadmins" | "authors" | "raters" | "explainers";

const en = {
  title: "Users",
  description: "Every account that has a profile, shared a joke, rated a version, or explained a joke. Read-only.",
  accounts: "Accounts",
  superadmins: "Superadmins",
  authors: "Joke authors",
  raters: "Raters",
  totalCaption: (count: string) => `${count} with a saved profile`,
  superadminCaption: "Granted out of band, never from the site",
  authorsCaption: (count: string) => `${plural(count, "joke", "jokes")} shared by members`,
  ratersCaption: (count: string) => `${plural(count, "rating", "ratings")} given`,
  search: "Search accounts",
  searchPlaceholder: "Name, email, or account ID",
  filter: "Show",
  filters: { all: "All accounts", superadmins: "Superadmins", authors: "Joke authors", raters: "Raters", explainers: "Explainers" } as Record<Filter, string>,
  table: "Accounts",
  account: "Account",
  role: "Role",
  jokes: "Jokes",
  ratings: "Ratings",
  explanations: "Explanations",
  lastActive: "Last active",
  actions: "Actions",
  superadmin: "Superadmin",
  member: "Member",
  unnamed: "Unnamed account",
  noEmail: "Email not recorded yet",
  view: (name: string) => `View ${name}`,
  details: "Account details",
  close: "Close",
  id: "Account ID",
  idHint: "SHA-256 digest of the verified email; the app never stores raw ids.",
  copy: "Copy account ID",
  copied: "Account ID copied.",
  profile: "Saved profile",
  yes: "Yes",
  no: "No",
  firstSeen: "First seen",
  stillFunnyShare: (share: string) => `${share} still funny`,
  accepted: (accepted: string, total: string) => `${accepted} of ${total} accepted`,
  readOnly: "Accounts are read-only here. Superadmin access is granted with the server-only key, not from the admin area.",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    title: "Usuarios",
    description: "Todas las cuentas que tienen perfil, compartieron un chiste, calificaron una versión o explicaron un chiste. Solo lectura.",
    accounts: "Cuentas",
    superadmins: "Superadministradores",
    authors: "Autores de chistes",
    raters: "Evaluadores",
    totalCaption: (count) => `${count} con perfil guardado`,
    superadminCaption: "Se concede fuera del sitio, nunca desde él",
    authorsCaption: (count) => `${plural(count, "chiste compartido", "chistes compartidos")} por miembros`,
    ratersCaption: (count) => plural(count, "calificación", "calificaciones"),
    search: "Buscar cuentas",
    searchPlaceholder: "Nombre, correo o ID de cuenta",
    filter: "Mostrar",
    filters: { all: "Todas las cuentas", superadmins: "Superadministradores", authors: "Autores de chistes", raters: "Evaluadores", explainers: "Explicadores" },
    table: "Cuentas",
    account: "Cuenta",
    role: "Rol",
    jokes: "Chistes",
    ratings: "Calificaciones",
    explanations: "Explicaciones",
    lastActive: "Última actividad",
    actions: "Acciones",
    superadmin: "Superadministrador",
    member: "Miembro",
    unnamed: "Cuenta sin nombre",
    noEmail: "Correo aún no registrado",
    view: (name) => `Ver ${name}`,
    details: "Detalles de la cuenta",
    close: "Cerrar",
    id: "ID de cuenta",
    idHint: "Resumen SHA-256 del correo verificado; la aplicación nunca guarda IDs sin procesar.",
    copy: "Copiar ID de cuenta",
    copied: "ID de cuenta copiado.",
    profile: "Perfil guardado",
    yes: "Sí",
    no: "No",
    firstSeen: "Visto por primera vez",
    stillFunnyShare: (share) => `${share} sigue siendo gracioso`,
    accepted: (accepted, total) => `${accepted} de ${total} aceptadas`,
    readOnly: "Aquí las cuentas son de solo lectura. El acceso de superadministrador se concede con la clave exclusiva del servidor, no desde la administración.",
  },
  zh: {
    title: "用户",
    description: "所有拥有资料、分享过笑话、评价过版本或解释过笑话的账户。仅可查看。",
    accounts: "账户",
    superadmins: "超级管理员",
    authors: "笑话作者",
    raters: "评价者",
    totalCaption: (count) => `${count} 个已保存资料`,
    superadminCaption: "在服务器端授予，网站上无法授予",
    authorsCaption: (count) => `会员共分享 ${count} 个笑话`,
    ratersCaption: (count) => `共 ${count} 条评价`,
    search: "搜索账户",
    searchPlaceholder: "姓名、邮箱或账户 ID",
    filter: "显示",
    filters: { all: "全部账户", superadmins: "超级管理员", authors: "笑话作者", raters: "评价者", explainers: "解释者" },
    table: "账户",
    account: "账户",
    role: "角色",
    jokes: "笑话",
    ratings: "评价",
    explanations: "解释",
    lastActive: "最近活跃",
    actions: "操作",
    superadmin: "超级管理员",
    member: "会员",
    unnamed: "未命名账户",
    noEmail: "尚未记录邮箱",
    view: (name) => `查看 ${name}`,
    details: "账户详情",
    close: "关闭",
    id: "账户 ID",
    idHint: "已验证邮箱的 SHA-256 摘要；应用从不保存原始 ID。",
    copy: "复制账户 ID",
    copied: "已复制账户 ID。",
    profile: "已保存资料",
    yes: "是",
    no: "否",
    firstSeen: "首次出现",
    stillFunnyShare: (share) => `${share} 认为依然好笑`,
    accepted: (accepted, total) => `${total} 条中采纳 ${accepted} 条`,
    readOnly: "此处账户仅可查看。超级管理员权限通过服务器专用密钥授予，而不是在管理后台中授予。",
  },
};

const matchesFilter = (account: AdminAccount, filter: Filter) =>
  filter === "all" || (filter === "superadmins" && account.is_superadmin) || (filter === "authors" && account.jokes > 0)
  || (filter === "raters" && account.ratings > 0) || (filter === "explainers" && account.explanations > 0);

type SortKey = "name" | "jokes" | "ratings" | "explanations" | "last_active_at";

function compare(a: AdminAccount, b: AdminAccount, key: SortKey) {
  if (key === "name") return (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "");
  if (key === "last_active_at") return (a.last_active_at ?? "").localeCompare(b.last_active_at ?? "");
  return a[key] - b[key];
}

export function UsersTable({ accounts }: { accounts: AdminAccount[] }) {
  const locale = useLocale();
  const t = messages[locale];
  const shared = useAdminMessages();
  const format = useFormat();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortDescriptor>({ column: "last_active_at", direction: "descending" });
  const [viewing, setViewing] = useState<AdminAccount | null>(null);
  // React Aria renders aria-sort differently on the server; sorting only works after hydration anyway.
  const hydrated = useHydrated();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = accounts.filter((account) => matchesFilter(account, filter)
      && (!needle || [account.name, account.email, account.id].some((value) => value?.toLowerCase().includes(needle))));
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.sort((a, b) => compare(a, b, sort.column as SortKey) * direction);
  }, [accounts, query, filter, sort]);
  const paged = usePaged(rows);
  const displayName = (account: AdminAccount) => account.name ?? (account.email ? account.email.split("@")[0] : shared.account(shortId(account.id)));

  const sum = (pick: (account: AdminAccount) => number) => accounts.reduce((total, account) => total + pick(account), 0);
  const column = (id: SortKey, label: string, isRowHeader = false) => (
    <Table.Column id={id} allowsSorting={hydrated} isRowHeader={isRowHeader}>
      {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{label}</Table.SortableColumnHeader>}
    </Table.Column>
  );

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.success(t.copied);
    } catch { /* Clipboard access can be denied; the ID stays visible and selectable. */ }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title={t.title} description={t.description} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t.accounts} value={format.number(accounts.length)} caption={t.totalCaption(format.number(accounts.filter((account) => account.has_profile).length))} />
        <StatTile label={t.superadmins} value={format.number(accounts.filter((account) => account.is_superadmin).length)} caption={t.superadminCaption} />
        <StatTile label={t.authors} value={format.number(accounts.filter((account) => account.jokes > 0).length)} caption={t.authorsCaption(format.number(sum((account) => account.jokes)))} />
        <StatTile label={t.raters} value={format.number(accounts.filter((account) => account.ratings > 0).length)} caption={t.ratersCaption(format.number(sum((account) => account.ratings)))} />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchField aria-label={t.search} value={query} onChange={setQuery} className="sm:w-80">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t.searchPlaceholder} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Select aria-label={t.filter} className="sm:w-52" value={filter} onChange={(value) => setFilter((value as Filter) ?? "all")}>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {(Object.keys(t.filters) as Filter[]).map((option) => (
                <ListBox.Item key={option} id={option} textValue={t.filters[option]}>
                  {t.filters[option]}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={t.table} className="min-w-[860px]" sortDescriptor={sort} onSortChange={setSort}>
            <Table.Header>
              {column("name", t.account, true)}
              <Table.Column>{t.role}</Table.Column>
              {column("jokes", t.jokes)}
              {column("ratings", t.ratings)}
              {column("explanations", t.explanations)}
              {column("last_active_at", t.lastActive)}
              <Table.Column className="text-end">{t.actions}</Table.Column>
            </Table.Header>
            <Table.Body items={paged.rows} renderEmptyState={() => <NoResults />}>
              {(account) => (
                <Table.Row id={account.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={account.name ?? account.email ?? "?"} src={account.avatar_url} size="sm" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">{account.name ?? t.unnamed}</span>
                        <span className="truncate text-xs text-muted">{account.email ?? t.noEmail}</span>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" variant="soft" color={account.is_superadmin ? "accent" : "default"}>{account.is_superadmin ? t.superadmin : t.member}</Chip>
                  </Table.Cell>
                  <Table.Cell className="tabular-nums">{format.number(account.jokes)}</Table.Cell>
                  <Table.Cell><RatingCounts funny={account.funny} notFunny={account.ratings - account.funny} /></Table.Cell>
                  <Table.Cell className="tabular-nums">{format.number(account.explanations)}</Table.Cell>
                  <Table.Cell><TimeText iso={account.last_active_at} relative /></Table.Cell>
                  <Table.Cell>
                    <div className="flex justify-end">
                      <Button isIconOnly size="sm" variant="tertiary" aria-label={t.view(displayName(account))} onPress={() => setViewing(account)}>
                        <Eye aria-hidden className="size-4" />
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
        <Table.Footer>
          <TablePager paged={paged} />
        </Table.Footer>
      </Table>

      <Modal.Backdrop isOpen={viewing !== null} onOpenChange={(open) => { if (!open) setViewing(null); }} isDismissable>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={t.close} />
            {viewing && (
              <>
                <Modal.Header className="flex flex-row items-center gap-3">
                  <UserAvatar name={viewing.name ?? viewing.email ?? "?"} src={viewing.avatar_url} size="lg" />
                  <div className="flex min-w-0 flex-col">
                    <Modal.Heading>{viewing.name ?? t.unnamed}</Modal.Heading>
                    <Typography.Paragraph size="sm" color="muted" className="truncate">{viewing.email ?? t.noEmail}</Typography.Paragraph>
                  </div>
                </Modal.Header>
                <Modal.Body className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <Label>{t.id}</Label>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-md bg-default px-2 py-1 text-xs">{viewing.id}</code>
                      <Button isIconOnly size="sm" variant="ghost" aria-label={t.copy} onPress={() => copy(viewing.id)}>
                        <Copy aria-hidden className="size-4" />
                      </Button>
                    </div>
                    <Typography.Paragraph size="xs" color="muted">{t.idHint}</Typography.Paragraph>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <Detail label={t.role}>
                      <Chip size="sm" variant="soft" color={viewing.is_superadmin ? "accent" : "default"}>{viewing.is_superadmin ? t.superadmin : t.member}</Chip>
                    </Detail>
                    <Detail label={t.profile}>{viewing.has_profile ? t.yes : t.no}</Detail>
                    <Detail label={t.firstSeen}><TimeText iso={viewing.first_seen_at} /></Detail>
                    <Detail label={t.lastActive}><TimeText iso={viewing.last_active_at} relative /></Detail>
                    <Detail label={t.jokes}>{format.number(viewing.jokes)}</Detail>
                    <Detail label={t.ratings}>
                      <div className="flex flex-col gap-0.5">
                        <RatingCounts funny={viewing.funny} notFunny={viewing.ratings - viewing.funny} />
                        {viewing.ratings > 0 && <span className="text-xs text-muted">{t.stillFunnyShare(format.percent(viewing.funny / viewing.ratings))}</span>}
                      </div>
                    </Detail>
                    <Detail label={t.explanations}>{t.accepted(format.number(viewing.accepted_explanations), format.number(viewing.explanations))}</Detail>
                  </dl>
                  <Typography.Paragraph size="xs" color="muted">{t.readOnly}</Typography.Paragraph>
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" variant="tertiary">{t.close}</Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
