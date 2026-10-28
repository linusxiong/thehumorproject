"use client";

import { Pencil, Plus, TrashBin } from "@gravity-ui/icons";
import {
  Alert, AlertDialog, Button, Chip, Description, FieldError, Form, Input, Label, ListBox, Modal, SearchField, Select, Spinner, Table, TextArea,
  TextField, Typography, toast, type SortDescriptor,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { fieldProblem, resources, type FieldSpec, type ResourceName } from "@/lib/admin-resources";
import { useLocale, type Messages } from "../locale";
import { NoResults, PageHeading, TablePager, TimeText, useFormat, useHydrated, usePaged } from "./admin-ui";

// Generic create/read/update/delete table for the simple admin resources in lib/admin-resources.ts.
// Each page supplies its columns, form fields, and wording; this component owns search, sorting, paging,
// the create and edit form, the delete confirmation, and error messages.

type Row = { id: number; created_at: string; updated_at: string | null };
export type Draft = Record<string, string>;

export type ResourceColumn<T> = {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
  isRowHeader?: boolean;
  // Makes the column sortable.
  sortValue?: (row: T) => string | number;
};

export type ResourceField = {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  // Number of text rows; a single-line input when omitted.
  rows?: number;
  // A select instead of a text input.
  options?: { id: string; label: string }[];
  lang?: string;
};

// The wording a page provides, already in the interface language.
export type ResourceText = {
  title: string;
  description: string;
  add: string;
  search: string;
  searchPlaceholder: string;
  count: (count: string) => string;
  table: string;
  createTitle: string;
  editTitle: (label: string) => string;
  deleteTitle: (label: string) => string;
  deleteBody: (row: string) => string;
  created: string;
  saved: string;
  deleted: string;
  // 409 on create or update: another row has the same value.
  duplicate: string;
  // 409 on delete: other rows still use this one.
  inUse?: string;
  empty: string;
};

const en = {
  actions: "Actions",
  updated: "Last changed",
  edit: (label: string) => `Edit ${label}`,
  remove: (label: string) => `Delete ${label}`,
  close: "Close",
  cancel: "Cancel",
  save: "Save changes",
  saving: "Saving…",
  create: "Create",
  creating: "Creating…",
  delete: "Delete",
  required: "Required.",
  tooShort: (min: number) => `Use at least ${min} characters.`,
  tooLong: (max: number) => `Use at most ${max} characters.`,
  invalid: "Enter a valid value.",
  optional: "Optional.",
  failedTitle: "That didn't work",
  errors: {
    400: "Check the fields and try again.",
    401: "Your session has expired. Sign in again.",
    403: "Only superadmins can do this.",
    404: "This record no longer exists. Refresh the list.",
  } as Partial<Record<number, string>>,
  genericError: "Something went wrong. Please try again.",
};

type Text = typeof en;

const messages: Messages<Text> = {
  en,
  es: {
    actions: "Acciones",
    updated: "Último cambio",
    edit: (label) => `Editar ${label}`,
    remove: (label) => `Eliminar ${label}`,
    close: "Cerrar",
    cancel: "Cancelar",
    save: "Guardar cambios",
    saving: "Guardando…",
    create: "Crear",
    creating: "Creando…",
    delete: "Eliminar",
    required: "Obligatorio.",
    tooShort: (min) => `Usa al menos ${min} caracteres.`,
    tooLong: (max) => `Usa como máximo ${max} caracteres.`,
    invalid: "Introduce un valor válido.",
    optional: "Opcional.",
    failedTitle: "No funcionó",
    errors: {
      400: "Revisa los campos e inténtalo de nuevo.",
      401: "Tu sesión expiró. Vuelve a iniciar sesión.",
      403: "Solo los superadministradores pueden hacer esto.",
      404: "Este registro ya no existe. Actualiza la lista.",
    },
    genericError: "Algo salió mal. Inténtalo de nuevo.",
  },
  zh: {
    actions: "操作",
    updated: "最近修改",
    edit: (label) => `编辑 ${label}`,
    remove: (label) => `删除 ${label}`,
    close: "关闭",
    cancel: "取消",
    save: "保存修改",
    saving: "正在保存…",
    create: "创建",
    creating: "正在创建…",
    delete: "删除",
    required: "必填。",
    tooShort: (min) => `至少 ${min} 个字符。`,
    tooLong: (max) => `最多 ${max} 个字符。`,
    invalid: "请输入有效的值。",
    optional: "选填。",
    failedTitle: "操作未成功",
    errors: {
      400: "请检查各字段后重试。",
      401: "登录已过期，请重新登录。",
      403: "只有超级管理员可以执行此操作。",
      404: "该记录已不存在，请刷新列表。",
    },
    genericError: "出了点问题，请重试。",
  },
};

class RequestError extends Error {
  constructor(readonly status: number | null) {
    super("Request failed");
  }
}

export async function sendJson(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!response) throw new RequestError(null);
  if (!response.ok) throw new RequestError(response.status);
  return response.json();
}

export const requestStatus = (error: unknown) => (error instanceof RequestError ? error.status : null);

function errorText(t: Text, text: ResourceText, error: unknown, action: "save" | "delete") {
  const status = requestStatus(error);
  if (status === 409) return action === "delete" ? text.inUse ?? t.genericError : text.duplicate;
  return (status !== null && t.errors[status]) || t.genericError;
}

export function Failure({ message }: { message: string | null }) {
  const t = messages[useLocale()];
  if (!message) return null;
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t.failedTitle}</Alert.Title>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

export function ResourceManager<T extends Row>({ resource, rows, columns, fields, text, label, searchText, toDraft, emptyDraft, notice }: {
  resource: ResourceName;
  rows: T[];
  columns: ResourceColumn<T>[];
  fields: ResourceField[];
  text: ResourceText;
  // A short name for one row in dialog titles and button labels.
  label: (row: T) => string;
  searchText: (row: T) => string;
  toDraft: (row: T) => Draft;
  emptyDraft: Draft;
  // Shown between the heading and the table.
  notice?: ReactNode;
}) {
  const t = messages[useLocale()];
  const format = useFormat();
  const router = useRouter();
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortDescriptor | undefined>(undefined);
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = rows.filter((row) => !needle || `#${row.id}` === needle || searchText(row).toLowerCase().includes(needle));
    const column = columns.find((candidate) => candidate.id === sort?.column);
    if (!column?.sortValue) return matches;
    const direction = sort?.direction === "descending" ? -1 : 1;
    const value = column.sortValue;
    return matches.sort((a, b) => {
      const left = value(a);
      const right = value(b);
      return direction * (typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), format.locale));
    });
  }, [rows, query, sort, columns, searchText, format.locale]);
  const paged = usePaged(filtered);
  const refresh = () => { setEditing(null); setDeleting(null); router.refresh(); };

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title={text.title} description={text.description} actions={(
        <Button onPress={() => setEditing("new")}>
          <Plus aria-hidden className="size-4" />
          {text.add}
        </Button>
      )} />
      {notice}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField aria-label={text.search} value={query} onChange={setQuery} className="sm:w-80">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={text.searchPlaceholder} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Chip size="sm" variant="soft" className="w-fit">{text.count(format.number(filtered.length))}</Chip>
      </div>
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={text.table} className="min-w-[720px]" sortDescriptor={sort} onSortChange={setSort}>
            <Table.Header>
              {columns.map((column) => (
                <Table.Column key={column.id} id={column.id} isRowHeader={column.isRowHeader} allowsSorting={hydrated && Boolean(column.sortValue)}
                  className={column.className}>
                  {({ sortDirection }) => (column.sortValue
                    ? <Table.SortableColumnHeader sortDirection={sortDirection}>{column.label}</Table.SortableColumnHeader>
                    : column.label)}
                </Table.Column>
              ))}
              <Table.Column>{t.updated}</Table.Column>
              <Table.Column className="text-end">{t.actions}</Table.Column>
            </Table.Header>
            <Table.Body items={paged.rows} renderEmptyState={() => <NoResults>{rows.length === 0 ? text.empty : undefined}</NoResults>}>
              {(row) => (
                <Table.Row id={row.id}>
                  {[
                    ...columns.map((column) => <Table.Cell key={column.id} className={column.className}>{column.render(row)}</Table.Cell>),
                    <Table.Cell key="updated" className="whitespace-nowrap"><TimeText iso={row.updated_at ?? row.created_at} /></Table.Cell>,
                    <Table.Cell key="actions">
                      <div className="flex items-center justify-end gap-1">
                        <Button isIconOnly size="sm" variant="tertiary" aria-label={t.edit(label(row))} onPress={() => setEditing(row)}>
                          <Pencil aria-hidden className="size-4" />
                        </Button>
                        <Button isIconOnly size="sm" variant="danger-soft" aria-label={t.remove(label(row))} onPress={() => setDeleting(row)}>
                          <TrashBin aria-hidden className="size-4" />
                        </Button>
                      </div>
                    </Table.Cell>,
                  ]}
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
        <Table.Footer>
          <TablePager paged={paged} />
        </Table.Footer>
      </Table>

      {editing && (
        <EditModal key={editing === "new" ? "new" : editing.id} resource={resource} fields={fields} text={text}
          row={editing === "new" ? null : { id: editing.id, label: label(editing) }}
          initial={editing === "new" ? emptyDraft : toDraft(editing)} onClose={() => setEditing(null)} onSaved={refresh} />
      )}
      <DeleteDialog resource={resource} text={text} row={deleting ? { id: deleting.id, label: label(deleting) } : null}
        onClose={() => setDeleting(null)} onDeleted={refresh} />
    </div>
  );
}

function EditModal({ resource, fields, text, row, initial, onClose, onSaved }: {
  resource: ResourceName; fields: ResourceField[]; text: ResourceText; row: { id: number; label: string } | null; initial: Draft;
  onClose: () => void; onSaved: () => void;
}) {
  const t = messages[useLocale()];
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const specs = resources[resource].fields as Record<string, FieldSpec>;

  function problem(name: string, value: string) {
    const spec = specs[name];
    switch (fieldProblem(spec, value)) {
      case "required": return t.required;
      case "short": return spec.kind === "text" ? t.tooShort(spec.min) : t.invalid;
      case "long": return spec.kind === "text" ? t.tooLong(spec.max) : t.invalid;
      case "format": return t.invalid;
      default: return null;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFailure(null);
    try {
      await sendJson(row ? `/api/admin/${resource}/${row.id}` : `/api/admin/${resource}`, row ? "PATCH" : "POST", draft);
      toast.success(row ? text.saved : text.created);
      onSaved();
    } catch (error) {
      setFailure(errorText(t, text, error, "save"));
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
            <Modal.Heading>{row ? text.editTitle(row.label) : text.createTitle}</Modal.Heading>
          </Modal.Header>
          <Form className="flex min-h-0 flex-col" onSubmit={submit}>
            <Modal.Body className="flex flex-col gap-4">
              {fields.map((field) => {
                const spec = specs[field.name];
                const optional = spec.kind === "text" && spec.optional;
                const value = draft[field.name] ?? "";
                const setValue = (next: string) => setDraft((current) => ({ ...current, [field.name]: next }));
                if (field.options) {
                  return (
                    <Select key={field.name} name={field.name} isRequired value={value || null} isDisabled={pending}
                      onChange={(next) => setValue(next == null ? "" : String(next))} validate={() => problem(field.name, value)}>
                      <Label>{field.label}</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {field.options.map((option) => (
                            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                              {option.label}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                      {field.description && <Description>{field.description}</Description>}
                      <FieldError />
                    </Select>
                  );
                }
                return (
                  <TextField key={field.name} name={field.name} isRequired={!optional} value={value} onChange={setValue} isDisabled={pending}
                    validate={(next) => problem(field.name, next)}>
                    <Label>{field.label}</Label>
                    {field.rows ? <TextArea rows={field.rows} lang={field.lang} placeholder={field.placeholder} />
                      : <Input lang={field.lang} placeholder={field.placeholder} />}
                    {(field.description || optional) && <Description>{[field.description, optional ? t.optional : null].filter(Boolean).join(" ")}</Description>}
                    <FieldError />
                  </TextField>
                );
              })}
              <Failure message={failure} />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" isDisabled={pending} onPress={onClose}>{t.cancel}</Button>
              <Button type="submit" isPending={pending}>
                {({ isPending }) => (
                  <>
                    {isPending && <Spinner size="sm" color="current" />}
                    {isPending ? (row ? t.saving : t.creating) : (row ? t.save : t.create)}
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

function DeleteDialog({ resource, text, row, onClose, onDeleted }: {
  resource: ResourceName; text: ResourceText; row: { id: number; label: string } | null; onClose: () => void; onDeleted: () => void;
}) {
  const t = messages[useLocale()];
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function confirm() {
    if (!row) return;
    setPending(true);
    setFailure(null);
    try {
      await sendJson(`/api/admin/${resource}/${row.id}`, "DELETE");
      toast.success(text.deleted);
      onDeleted();
    } catch (error) {
      setFailure(errorText(t, text, error, "delete"));
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Backdrop isOpen={row !== null} onOpenChange={(open) => { if (!open && !pending) { setFailure(null); onClose(); } }}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          {row && (
            <>
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>{text.deleteTitle(row.label)}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="flex flex-col gap-3">
                <Typography.Paragraph size="sm">{text.deleteBody(row.label)}</Typography.Paragraph>
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
