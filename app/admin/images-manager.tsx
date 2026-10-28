"use client";

import { ArrowUpFromLine, Eye, EyeSlash, Picture, TrashBin } from "@gravity-ui/icons";
import {
  AlertDialog, Avatar, Button, Chip, ComboBox, Description, Form, Input, Label, Link, ListBox, Modal, SearchField, Select, Spinner, Table,
  Typography, toast, type SortDescriptor,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import type { AdminImage, ImageAccount } from "@/lib/admin-types";
import { PhotoError, squarePhoto } from "../avatar-settings";
import { htmlLang, useLocale, type Messages } from "../locale";
import { NoResults, PageHeading, plural, shortId, StatTile, TablePager, TimeText, useAdminMessages, useFormat, useHydrated, usePaged } from "./admin-ui";
import { Failure, requestStatus, sendJson } from "./resource-manager";

type Filter = "all" | "shown" | "hidden" | "unlinked";
type SortKey = "created_at" | "size";

const en = {
  title: "Images",
  description: "The only images members can upload are profile photos. Upload a photo for an account, show or hide it, replace it, or delete it. Photos are cropped to a square of at most 512 × 512 pixels; JPEG, PNG, or WebP up to 2 MB.",
  upload: "Upload photo",
  photos: "Photos",
  photosCaption: (size: string) => `${size} in storage`,
  shown: "Shown",
  shownCaption: "Members see these photos next to their jokes",
  hidden: "Hidden",
  hiddenCaption: "The account shows its Google photo instead",
  unlinked: "Not linked",
  unlinkedCaption: "Left-over files no account uses",
  search: "Search photos",
  searchPlaceholder: "Name, email, or file name",
  filter: "Show",
  filters: { all: "All photos", shown: "Shown", hidden: "Hidden", unlinked: "Not linked to an account" } as Record<Filter, string>,
  count: (count: string) => plural(count, "photo", "photos"),
  table: "Uploaded photos",
  photo: "Photo",
  account: "Account",
  status: "Status",
  size: "Size",
  type: "Type",
  uploaded: "Uploaded",
  actions: "Actions",
  statuses: { shown: "Shown", hidden: "Hidden", unlinked: "Not linked" } as Record<Exclude<Filter, "all">, string>,
  noAccount: "Not linked to an account",
  noEmail: "Email not recorded yet",
  photoOf: (name: string) => `Profile photo of ${name}`,
  unlinkedPhoto: "Profile photo not linked to an account",
  view: (name: string) => `View photo of ${name}`,
  replace: (name: string) => `Replace photo of ${name}`,
  show: (name: string) => `Show this photo for ${name}`,
  hide: (name: string) => `Hide this photo for ${name}`,
  remove: (name: string) => `Delete photo of ${name}`,
  details: "Photo details",
  file: "File name",
  accountId: "Account ID",
  googlePhoto: "Google photo",
  googleHint: "Shown when the uploaded photo is hidden or deleted.",
  open: "Open the original file",
  close: "Close",
  cancel: "Cancel",
  replaceButton: "Replace photo",
  showButton: "Show on account",
  hideButton: "Hide from account",
  shownToast: "The account now shows this photo.",
  hiddenToast: "The account now shows its Google photo.",
  uploadTitle: "Upload a profile photo",
  replaceTitle: "Replace profile photo",
  uploadIntro: "The photo becomes the account's uploaded photo and is shown right away, as if the member had uploaded it. Any photo the account uploaded before is deleted.",
  accountLabel: "Account",
  accountPlaceholder: "Search by name or email",
  accountHint: "Only accounts with a saved profile can have a photo.",
  noAccounts: "No account matches.",
  photoLabel: "Photo",
  choose: "Choose a photo",
  chooseAnother: "Choose another photo",
  preparing: "Preparing the photo…",
  photoHint: "JPEG, PNG, or WebP. It is cropped to the centered square, like the member's own uploads.",
  preview: "Preview of the cropped photo",
  unreadable: "Choose a JPEG, PNG, or WebP image.",
  submit: "Upload and show",
  uploading: "Uploading…",
  uploadedToast: "Photo uploaded and shown on the account.",
  deleteTitle: "Delete this photo?",
  deleteShown: (name: string) => `The file is deleted for good, and ${name} sees their Google photo again.`,
  deleteHidden: (name: string) => `The file is deleted for good. ${name} already shows their Google photo.`,
  deleteUnlinked: "The file is deleted for good. No account uses it.",
  delete: "Delete",
  deleted: "Photo deleted.",
  errors: {
    400: "Choose an account and a photo, then try again.",
    401: "Your session has expired. Sign in again.",
    403: "Only superadmins can do this.",
    404: "This account or photo no longer exists. Refresh the list.",
    409: "This photo is not linked to an account.",
    413: "Photos must be 2 MB or smaller.",
    415: "Choose a JPEG, PNG, or WebP image.",
  } as Partial<Record<number, string>>,
  genericError: "Something went wrong. Please try again.",
};

type Text = typeof en;

const messages: Messages<Text> = {
  en,
  es: {
    title: "Imágenes",
    description: "Las únicas imágenes que los miembros pueden subir son fotos de perfil. Sube una foto para una cuenta, muéstrala u ocúltala, reemplázala o elimínala. Las fotos se recortan a un cuadrado de 512 × 512 píxeles como máximo; JPEG, PNG o WebP de hasta 2 MB.",
    upload: "Subir foto",
    photos: "Fotos",
    photosCaption: (size) => `${size} en almacenamiento`,
    shown: "Visibles",
    shownCaption: "Los miembros ven estas fotos junto a sus chistes",
    hidden: "Ocultas",
    hiddenCaption: "La cuenta muestra su foto de Google",
    unlinked: "Sin cuenta",
    unlinkedCaption: "Archivos sobrantes que ninguna cuenta usa",
    search: "Buscar fotos",
    searchPlaceholder: "Nombre, correo o nombre de archivo",
    filter: "Mostrar",
    filters: { all: "Todas las fotos", shown: "Visibles", hidden: "Ocultas", unlinked: "Sin cuenta vinculada" },
    count: (count) => plural(count, "foto", "fotos"),
    table: "Fotos subidas",
    photo: "Foto",
    account: "Cuenta",
    status: "Estado",
    size: "Tamaño",
    type: "Tipo",
    uploaded: "Subida",
    actions: "Acciones",
    statuses: { shown: "Visible", hidden: "Oculta", unlinked: "Sin cuenta" },
    noAccount: "Sin cuenta vinculada",
    noEmail: "Correo aún no registrado",
    photoOf: (name) => `Foto de perfil de ${name}`,
    unlinkedPhoto: "Foto de perfil sin cuenta vinculada",
    view: (name) => `Ver la foto de ${name}`,
    replace: (name) => `Reemplazar la foto de ${name}`,
    show: (name) => `Mostrar esta foto para ${name}`,
    hide: (name) => `Ocultar esta foto para ${name}`,
    remove: (name) => `Eliminar la foto de ${name}`,
    details: "Detalles de la foto",
    file: "Nombre de archivo",
    accountId: "ID de cuenta",
    googlePhoto: "Foto de Google",
    googleHint: "Se muestra cuando la foto subida está oculta o eliminada.",
    open: "Abrir el archivo original",
    close: "Cerrar",
    cancel: "Cancelar",
    replaceButton: "Reemplazar foto",
    showButton: "Mostrar en la cuenta",
    hideButton: "Ocultar de la cuenta",
    shownToast: "La cuenta ahora muestra esta foto.",
    hiddenToast: "La cuenta ahora muestra su foto de Google.",
    uploadTitle: "Subir una foto de perfil",
    replaceTitle: "Reemplazar la foto de perfil",
    uploadIntro: "La foto pasa a ser la foto subida de la cuenta y se muestra de inmediato, como si el miembro la hubiera subido. Cualquier foto que la cuenta hubiera subido antes se elimina.",
    accountLabel: "Cuenta",
    accountPlaceholder: "Busca por nombre o correo",
    accountHint: "Solo las cuentas con perfil guardado pueden tener foto.",
    noAccounts: "Ninguna cuenta coincide.",
    photoLabel: "Foto",
    choose: "Elegir una foto",
    chooseAnother: "Elegir otra foto",
    preparing: "Preparando la foto…",
    photoHint: "JPEG, PNG o WebP. Se recorta al cuadrado central, igual que las fotos que suben los miembros.",
    preview: "Vista previa de la foto recortada",
    unreadable: "Elige una imagen JPEG, PNG o WebP.",
    submit: "Subir y mostrar",
    uploading: "Subiendo…",
    uploadedToast: "Foto subida y visible en la cuenta.",
    deleteTitle: "¿Eliminar esta foto?",
    deleteShown: (name) => `El archivo se elimina definitivamente y ${name} vuelve a ver su foto de Google.`,
    deleteHidden: (name) => `El archivo se elimina definitivamente. ${name} ya muestra su foto de Google.`,
    deleteUnlinked: "El archivo se elimina definitivamente. Ninguna cuenta lo usa.",
    delete: "Eliminar",
    deleted: "Foto eliminada.",
    errors: {
      400: "Elige una cuenta y una foto, y vuelve a intentarlo.",
      401: "Tu sesión expiró. Vuelve a iniciar sesión.",
      403: "Solo los superadministradores pueden hacer esto.",
      404: "Esta cuenta o foto ya no existe. Actualiza la lista.",
      409: "Esta foto no está vinculada a ninguna cuenta.",
      413: "Las fotos deben pesar 2 MB o menos.",
      415: "Elige una imagen JPEG, PNG o WebP.",
    },
    genericError: "Algo salió mal. Inténtalo de nuevo.",
  },
  zh: {
    title: "图片",
    description: "会员唯一可以上传的图片是头像。你可以为账户上传头像、显示或隐藏、替换或删除。照片会被裁剪为不超过 512 × 512 像素的正方形；支持 JPEG、PNG 或 WebP，最大 2 MB。",
    upload: "上传照片",
    photos: "照片",
    photosCaption: (size) => `共占用 ${size}`,
    shown: "显示中",
    shownCaption: "会员的笑话旁会显示这些照片",
    hidden: "已隐藏",
    hiddenCaption: "账户改为显示 Google 头像",
    unlinked: "未关联",
    unlinkedCaption: "没有账户使用的遗留文件",
    search: "搜索照片",
    searchPlaceholder: "姓名、邮箱或文件名",
    filter: "显示",
    filters: { all: "全部照片", shown: "显示中", hidden: "已隐藏", unlinked: "未关联账户" },
    count: (count) => `${count} 张照片`,
    table: "已上传的照片",
    photo: "照片",
    account: "账户",
    status: "状态",
    size: "大小",
    type: "类型",
    uploaded: "上传时间",
    actions: "操作",
    statuses: { shown: "显示中", hidden: "已隐藏", unlinked: "未关联" },
    noAccount: "未关联账户",
    noEmail: "尚未记录邮箱",
    photoOf: (name) => `${name} 的头像`,
    unlinkedPhoto: "未关联账户的头像",
    view: (name) => `查看 ${name} 的照片`,
    replace: (name) => `替换 ${name} 的照片`,
    show: (name) => `为 ${name} 显示这张照片`,
    hide: (name) => `为 ${name} 隐藏这张照片`,
    remove: (name) => `删除 ${name} 的照片`,
    details: "照片详情",
    file: "文件名",
    accountId: "账户 ID",
    googlePhoto: "Google 头像",
    googleHint: "上传的照片被隐藏或删除时显示。",
    open: "打开原始文件",
    close: "关闭",
    cancel: "取消",
    replaceButton: "替换照片",
    showButton: "在账户上显示",
    hideButton: "从账户隐藏",
    shownToast: "该账户现在显示这张照片。",
    hiddenToast: "该账户现在显示 Google 头像。",
    uploadTitle: "上传头像",
    replaceTitle: "替换头像",
    uploadIntro: "这张照片会成为该账户上传的头像并立即显示，就像会员自己上传的一样。该账户之前上传的照片会被删除。",
    accountLabel: "账户",
    accountPlaceholder: "按姓名或邮箱搜索",
    accountHint: "只有已保存资料的账户才能设置头像。",
    noAccounts: "没有匹配的账户。",
    photoLabel: "照片",
    choose: "选择照片",
    chooseAnother: "选择其他照片",
    preparing: "正在处理照片…",
    photoHint: "JPEG、PNG 或 WebP。会像会员自己上传时一样裁剪为居中的正方形。",
    preview: "裁剪后的照片预览",
    unreadable: "请选择 JPEG、PNG 或 WebP 图片。",
    submit: "上传并显示",
    uploading: "正在上传…",
    uploadedToast: "照片已上传并在账户上显示。",
    deleteTitle: "删除这张照片？",
    deleteShown: (name) => `文件将被永久删除，${name} 会重新显示 Google 头像。`,
    deleteHidden: (name) => `文件将被永久删除。${name} 目前已显示 Google 头像。`,
    deleteUnlinked: "文件将被永久删除。没有账户使用它。",
    delete: "删除",
    deleted: "照片已删除。",
    errors: {
      400: "请选择账户和照片后重试。",
      401: "登录已过期，请重新登录。",
      403: "只有超级管理员可以执行此操作。",
      404: "该账户或照片已不存在，请刷新列表。",
      409: "这张照片没有关联任何账户。",
      413: "照片不能超过 2 MB。",
      415: "请选择 JPEG、PNG 或 WebP 图片。",
    },
    genericError: "出了点问题，请重试。",
  },
};

const statusOf = (image: AdminImage): Exclude<Filter, "all"> => (!image.user_id ? "unlinked" : image.in_use ? "shown" : "hidden");
const statusColor = { shown: "success", hidden: "default", unlinked: "warning" } as const;
const typeNames: Record<string, string> = { "image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WebP" };

const errorText = (t: Text, error: unknown) => {
  const status = requestStatus(error);
  return (status !== null && t.errors[status]) || t.genericError;
};

function useBytes() {
  const locale = useLocale();
  return useMemo(() => {
    const lang = htmlLang[locale];
    const kilobytes = new Intl.NumberFormat(lang, { style: "unit", unit: "kilobyte", maximumFractionDigits: 0 });
    const megabytes = new Intl.NumberFormat(lang, { style: "unit", unit: "megabyte", maximumFractionDigits: 1 });
    return (bytes: number | null) => {
      if (bytes === null) return "—";
      return bytes >= 1024 * 1024 ? megabytes.format(bytes / 1024 / 1024) : kilobytes.format(Math.max(1, Math.round(bytes / 1024)));
    };
  }, [locale]);
}

// The photo as members see it: a round avatar.
function Photo({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <Avatar className={className}>
      <Avatar.Image src={src} alt={alt} referrerPolicy="no-referrer" />
      <Avatar.Fallback><Picture aria-hidden className="size-4" /></Avatar.Fallback>
    </Avatar>
  );
}

export function ImagesManager({ images, accounts }: { images: AdminImage[]; accounts: ImageAccount[] }) {
  const t = messages[useLocale()];
  const shared = useAdminMessages();
  const format = useFormat();
  const bytes = useBytes();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortDescriptor>({ column: "created_at", direction: "descending" });
  const [viewing, setViewing] = useState<AdminImage | null>(null);
  // null: closed; otherwise the account to preselect (null inside means none).
  const [uploading, setUploading] = useState<{ userId: string | null } | null>(null);
  const [deleting, setDeleting] = useState<AdminImage | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  // React Aria renders aria-sort differently on the server; sorting only works after hydration anyway.
  const hydrated = useHydrated();

  const ownerName = (image: AdminImage) =>
    image.name ?? (image.email ? image.email.split("@")[0] : image.user_id ? shared.account(shortId(image.user_id)) : t.noAccount);
  const altText = (image: AdminImage) => (image.user_id ? t.photoOf(ownerName(image)) : t.unlinkedPhoto);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = images.filter((image) => (filter === "all" || statusOf(image) === filter)
      && (!needle || [image.name, image.email, image.path].some((value) => value?.toLowerCase().includes(needle))));
    const direction = sort.direction === "descending" ? -1 : 1;
    return filtered.sort((a, b) => direction * (sort.column === "size"
      ? (a.size ?? 0) - (b.size ?? 0)
      : a.created_at.localeCompare(b.created_at) || a.path.localeCompare(b.path)));
  }, [images, query, filter, sort]);
  const paged = usePaged(rows);
  const tally = (status: Exclude<Filter, "all">) => images.filter((image) => statusOf(image) === status).length;

  const sortable = (id: SortKey, label: string) => (
    <Table.Column id={id} allowsSorting={hydrated}>
      {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{label}</Table.SortableColumnHeader>}
    </Table.Column>
  );

  async function toggle(image: AdminImage) {
    setToggling(image.path);
    try {
      await sendJson(`/api/admin/images/${encodeURIComponent(image.path)}`, "PATCH", { inUse: !image.in_use });
      toast.success(image.in_use ? t.hiddenToast : t.shownToast);
      setViewing(null);
      router.refresh();
    } catch (error) {
      toast.danger(errorText(t, error));
    } finally {
      setToggling(null);
    }
  }

  const replace = (image: AdminImage) => { setViewing(null); setUploading({ userId: image.user_id }); };

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title={t.title} description={t.description} actions={(
        <Button onPress={() => setUploading({ userId: null })}>
          <ArrowUpFromLine aria-hidden className="size-4" />
          {t.upload}
        </Button>
      )} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t.photos} value={format.number(images.length)} caption={t.photosCaption(bytes(images.reduce((sum, image) => sum + (image.size ?? 0), 0)))} />
        <StatTile label={t.shown} value={format.number(tally("shown"))} caption={t.shownCaption} />
        <StatTile label={t.hidden} value={format.number(tally("hidden"))} caption={t.hiddenCaption} />
        <StatTile label={t.unlinked} value={format.number(tally("unlinked"))} caption={t.unlinkedCaption} />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField aria-label={t.search} value={query} onChange={setQuery} className="sm:w-80">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t.searchPlaceholder} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Select aria-label={t.filter} className="sm:w-60" value={filter} onChange={(value) => setFilter((value as Filter) ?? "all")}>
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
        <Chip size="sm" variant="soft" className="w-fit">{t.count(format.number(rows.length))}</Chip>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={t.table} className="min-w-[900px]" sortDescriptor={sort} onSortChange={setSort}>
            <Table.Header>
              <Table.Column isRowHeader>{t.account}</Table.Column>
              <Table.Column>{t.status}</Table.Column>
              {sortable("size", t.size)}
              <Table.Column>{t.type}</Table.Column>
              {sortable("created_at", t.uploaded)}
              <Table.Column className="text-end">{t.actions}</Table.Column>
            </Table.Header>
            <Table.Body items={paged.rows} renderEmptyState={() => <NoResults />}>
              {(image) => {
                const status = statusOf(image);
                const name = ownerName(image);
                return (
                  <Table.Row id={image.path}>
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        <Photo src={image.url} alt={altText(image)} />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">{image.user_id ? name : t.noAccount}</span>
                          <span className="truncate text-xs text-muted">{image.user_id ? image.email ?? t.noEmail : image.path}</span>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell><Chip size="sm" variant="soft" color={statusColor[status]}>{t.statuses[status]}</Chip></Table.Cell>
                    <Table.Cell className="whitespace-nowrap tabular-nums">{bytes(image.size)}</Table.Cell>
                    <Table.Cell>{(image.content_type && typeNames[image.content_type]) ?? image.content_type ?? "—"}</Table.Cell>
                    <Table.Cell className="whitespace-nowrap"><TimeText iso={image.created_at} /></Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center justify-end gap-1">
                        <Button isIconOnly size="sm" variant="tertiary" aria-label={t.view(name)} onPress={() => setViewing(image)}>
                          <Eye aria-hidden className="size-4" />
                        </Button>
                        <Button isIconOnly size="sm" variant="tertiary" aria-label={t.replace(name)} isDisabled={!image.user_id} onPress={() => replace(image)}>
                          <ArrowUpFromLine aria-hidden className="size-4" />
                        </Button>
                        <Button isIconOnly size="sm" variant="tertiary" aria-label={image.in_use ? t.hide(name) : t.show(name)}
                          isDisabled={!image.user_id || toggling !== null} isPending={toggling === image.path} onPress={() => toggle(image)}>
                          {({ isPending }) => (isPending ? <Spinner size="sm" color="current" />
                            : image.in_use ? <EyeSlash aria-hidden className="size-4" /> : <Picture aria-hidden className="size-4" />)}
                        </Button>
                        <Button isIconOnly size="sm" variant="danger-soft" aria-label={t.remove(name)} onPress={() => setDeleting(image)}>
                          <TrashBin aria-hidden className="size-4" />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              }}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
        <Table.Footer>
          <TablePager paged={paged} />
        </Table.Footer>
      </Table>

      <ViewModal image={viewing} name={viewing ? ownerName(viewing) : ""} alt={viewing ? altText(viewing) : ""} bytes={bytes}
        toggling={toggling !== null} onClose={() => setViewing(null)} onReplace={replace} onToggle={toggle} />
      {uploading && (
        <UploadModal accounts={accounts} initialUserId={uploading.userId} onClose={() => setUploading(null)}
          onUploaded={() => { setUploading(null); router.refresh(); }} />
      )}
      <DeleteDialog image={deleting} name={deleting ? ownerName(deleting) : ""} onClose={() => setDeleting(null)}
        onDeleted={() => { setDeleting(null); router.refresh(); }} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm break-all">{children}</dd>
    </div>
  );
}

function ViewModal({ image, name, alt, bytes, toggling, onClose, onReplace, onToggle }: {
  image: AdminImage | null; name: string; alt: string; bytes: (value: number | null) => string; toggling: boolean;
  onClose: () => void; onReplace: (image: AdminImage) => void; onToggle: (image: AdminImage) => void;
}) {
  const t = messages[useLocale()];
  const status = image ? statusOf(image) : "unlinked";
  return (
    <Modal.Backdrop isOpen={image !== null} onOpenChange={(open) => { if (!open) onClose(); }} isDismissable>
      <Modal.Container size="md" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t.close} />
          {image && (
            <>
              <Modal.Header>
                <Modal.Heading>{t.details}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-5">
                <div className="flex flex-wrap items-end gap-6">
                  <Photo src={image.url} alt={alt} className="size-40" />
                  {image.user_id && image.google_url && (
                    <div className="flex flex-col items-start gap-2">
                      <Photo src={image.google_url} alt={t.googlePhoto} className="size-16" />
                      <Typography.Paragraph size="xs" color="muted" className="max-w-48">{t.googlePhoto}: {t.googleHint}</Typography.Paragraph>
                    </div>
                  )}
                </div>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label={t.account}>
                    {image.user_id ? <>{name}<br /><span className="text-muted">{image.email ?? t.noEmail}</span></> : t.noAccount}
                  </Field>
                  <Field label={t.status}><Chip size="sm" variant="soft" color={statusColor[status]}>{t.statuses[status]}</Chip></Field>
                  {image.user_id && <Field label={t.accountId}><Typography.Code>{image.user_id}</Typography.Code></Field>}
                  <Field label={t.file}><Typography.Code>{image.path}</Typography.Code></Field>
                  <Field label={t.size}>{bytes(image.size)}</Field>
                  <Field label={t.type}>{(image.content_type && typeNames[image.content_type]) ?? image.content_type ?? "—"}</Field>
                  <Field label={t.uploaded}><TimeText iso={image.created_at} /></Field>
                </dl>
                <Link href={image.url} target="_blank" rel="noopener noreferrer" className="w-fit text-sm">{t.open}</Link>
              </Modal.Body>
              <Modal.Footer className="flex-wrap">
                <Button variant="tertiary" slot="close">{t.close}</Button>
                {image.user_id && (
                  <>
                    <Button variant="secondary" isDisabled={toggling} onPress={() => onToggle(image)}>
                      {image.in_use ? <EyeSlash aria-hidden className="size-4" /> : <Picture aria-hidden className="size-4" />}
                      {image.in_use ? t.hideButton : t.showButton}
                    </Button>
                    <Button variant="secondary" onPress={() => onReplace(image)}>
                      <ArrowUpFromLine aria-hidden className="size-4" />
                      {t.replaceButton}
                    </Button>
                  </>
                )}
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

const accountName = (account: ImageAccount) => account.name ?? account.email?.split("@")[0] ?? shortId(account.id);
const accountText = (account: ImageAccount) => (account.email ? `${accountName(account)} (${account.email})` : accountName(account));

function UploadModal({ accounts, initialUserId, onClose, onUploaded }: {
  accounts: ImageAccount[]; initialUserId: string | null; onClose: () => void; onUploaded: () => void;
}) {
  const t = messages[useLocale()];
  const fileInput = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const busy = pending || preparing;

  // Release the preview's object URL when it changes or the modal closes.
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreparing(true);
    setFailure(null);
    try {
      const blob = await squarePhoto(file, t.unreadable);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch (error) {
      setFailure(error instanceof PhotoError ? error.message : t.unreadable);
    } finally {
      setPreparing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !photo) return;
    setPending(true);
    setFailure(null);
    try {
      const body = new FormData();
      body.set("userId", userId);
      body.set("file", photo.blob, "photo.jpg");
      const response = await fetch("/api/admin/images", { method: "POST", body }).catch(() => null);
      if (!response?.ok) {
        setFailure((response && t.errors[response.status]) || t.genericError);
        return;
      }
      toast.success(t.uploadedToast);
      onUploaded();
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => { if (!open && !pending) onClose(); }} isDismissable={!pending} isKeyboardDismissDisabled={pending}>
      <Modal.Container size="md" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger isDisabled={pending} aria-label={t.close} />
          <Modal.Header>
            <Modal.Heading>{initialUserId ? t.replaceTitle : t.uploadTitle}</Modal.Heading>
          </Modal.Header>
          <Form className="flex min-h-0 flex-col" onSubmit={submit}>
            <Modal.Body className="flex flex-col gap-5">
              <Typography.Paragraph size="sm" color="muted">{t.uploadIntro}</Typography.Paragraph>
              <ComboBox isRequired defaultItems={accounts} selectedKey={userId} isDisabled={busy}
                onSelectionChange={(key) => setUserId(key == null ? null : String(key))}>
                <Label>{t.accountLabel}</Label>
                <ComboBox.InputGroup>
                  <Input placeholder={t.accountPlaceholder} />
                  <ComboBox.Trigger />
                </ComboBox.InputGroup>
                <Description>{t.accountHint}</Description>
                <ComboBox.Popover>
                  <ListBox renderEmptyState={() => <span className="p-2 text-sm text-muted">{t.noAccounts}</span>}>
                    {(account: ImageAccount) => (
                      <ListBox.Item id={account.id} textValue={accountText(account)}>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm">{accountName(account)}</span>
                          {account.email && <span className="truncate text-xs text-muted">{account.email}</span>}
                        </div>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    )}
                  </ListBox>
                </ComboBox.Popover>
              </ComboBox>
              <div className="flex flex-col gap-2">
                <Typography.Paragraph size="sm" className="font-medium">{t.photoLabel}</Typography.Paragraph>
                <div className="flex flex-wrap items-center gap-4">
                  {photo && <Photo src={photo.url} alt={t.preview} className="size-24" />}
                  <Button variant="secondary" isDisabled={busy} isPending={preparing} onPress={() => fileInput.current?.click()}>
                    {({ isPending }) => (
                      <>
                        {isPending ? <Spinner size="sm" color="current" /> : <Picture aria-hidden className="size-4" />}
                        {isPending ? t.preparing : photo ? t.chooseAnother : t.choose}
                      </>
                    )}
                  </Button>
                  <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={choose} />
                </div>
                <Typography.Paragraph size="xs" color="muted">{t.photoHint}</Typography.Paragraph>
              </div>
              <Failure message={failure} />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" isDisabled={pending} onPress={onClose}>{t.cancel}</Button>
              <Button type="submit" isPending={pending} isDisabled={!userId || !photo || preparing}>
                {({ isPending }) => (
                  <>
                    {isPending ? <Spinner size="sm" color="current" /> : <ArrowUpFromLine aria-hidden className="size-4" />}
                    {isPending ? t.uploading : t.submit}
                  </>
                )}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function DeleteDialog({ image, name, onClose, onDeleted }: { image: AdminImage | null; name: string; onClose: () => void; onDeleted: () => void }) {
  const t = messages[useLocale()];
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function confirm() {
    if (!image) return;
    setPending(true);
    setFailure(null);
    try {
      await sendJson(`/api/admin/images/${encodeURIComponent(image.path)}`, "DELETE");
      toast.success(t.deleted);
      onDeleted();
    } catch (error) {
      setFailure(errorText(t, error));
    } finally {
      setPending(false);
    }
  }

  const status = image ? statusOf(image) : "unlinked";
  return (
    <AlertDialog.Backdrop isOpen={image !== null} onOpenChange={(open) => { if (!open && !pending) { setFailure(null); onClose(); } }}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          {image && (
            <>
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>{t.deleteTitle}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Photo src={image.url} alt={image.user_id ? t.photoOf(name) : t.unlinkedPhoto} />
                  <Typography.Paragraph size="sm">
                    {status === "shown" ? t.deleteShown(name) : status === "hidden" ? t.deleteHidden(name) : t.deleteUnlinked}
                  </Typography.Paragraph>
                </div>
                <Failure message={failure} />
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="tertiary" isDisabled={pending} onPress={onClose}>{t.cancel}</Button>
                <Button variant="danger" isPending={pending} onPress={confirm}>
                  {({ isPending }) => (
                    <>
                      {isPending ? <Spinner size="sm" color="current" /> : <TrashBin aria-hidden className="size-4" />}
                      {t.delete}
                    </>
                  )}
                </Button>
              </AlertDialog.Footer>
            </>
          )}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
