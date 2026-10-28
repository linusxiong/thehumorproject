"use client";

import { Alert, Chip, Typography } from "@heroui/react";
import NextLink from "next/link";
import type { LlmModel, LlmProvider } from "@/lib/admin-resources";
import { useLocale, type Messages } from "../locale";
import { plural, useFormat } from "./admin-ui";
import { ResourceManager } from "./resource-manager";

const en = {
  models: {
    title: "LLM models",
    description: "The models prompt chain steps run on. Changing a model's API ID switches every step that uses it on the next request.",
    add: "Add model",
    search: "Search models",
    searchPlaceholder: "Name, API ID, or provider",
    count: (count: string) => plural(count, "model", "models"),
    table: "LLM models",
    createTitle: "Add a model",
    editTitle: (label: string) => `Edit ${label}`,
    deleteTitle: (label: string) => `Delete ${label}?`,
    deleteBody: (label: string) => `${label} will be removed from the catalog. Logged responses keep the API ID they used.`,
    created: "Model added.",
    saved: "Model saved.",
    deleted: "Model deleted.",
    duplicate: "Another model already has this API ID.",
    inUse: "Prompt chain steps still run on this model, so it cannot be deleted.",
    empty: "No models yet.",
  },
  providers: {
    title: "LLM providers",
    description: "The companies whose models are in the catalog. A provider with models cannot be deleted.",
    add: "Add provider",
    search: "Search providers",
    searchPlaceholder: "Provider name",
    count: (count: string) => plural(count, "provider", "providers"),
    table: "LLM providers",
    createTitle: "Add a provider",
    editTitle: (label: string) => `Edit ${label}`,
    deleteTitle: (label: string) => `Delete ${label}?`,
    deleteBody: (label: string) => `${label} will be removed from the catalog.`,
    created: "Provider added.",
    saved: "Provider saved.",
    deleted: "Provider deleted.",
    duplicate: "A provider with this name already exists.",
    inUse: "This provider still has models. Delete or move them first.",
    empty: "No providers yet.",
  },
  name: "Name",
  apiId: "API ID",
  apiIdHint: "The exact model ID sent to the API, such as claude-haiku-5-5.",
  provider: "Provider",
  usage: "Used by",
  steps: (count: string) => plural(count, "chain step", "chain steps"),
  unused: "Not used",
  modelCount: (count: string) => plural(count, "model", "models"),
  anthropicOnly: "Requests go to the Anthropic Messages API",
  anthropicOnlyBody: "The app sends every chain step to the Anthropic API, so only Anthropic model IDs work in a step. Other providers and models are kept for reference.",
  chains: "See which steps use each model",
};

const messages: Messages<typeof en> = {
  en,
  es: {
    models: {
      title: "Modelos LLM",
      description: "Los modelos con los que se ejecutan los pasos de las cadenas de prompts. Cambiar el ID de API de un modelo cambia todos los pasos que lo usan desde la siguiente solicitud.",
      add: "Añadir modelo",
      search: "Buscar modelos",
      searchPlaceholder: "Nombre, ID de API o proveedor",
      count: (count) => plural(count, "modelo", "modelos"),
      table: "Modelos LLM",
      createTitle: "Añadir un modelo",
      editTitle: (label) => `Editar ${label}`,
      deleteTitle: (label) => `¿Eliminar ${label}?`,
      deleteBody: (label) => `${label} se quitará del catálogo. Las respuestas registradas conservan el ID de API que usaron.`,
      created: "Modelo añadido.",
      saved: "Modelo guardado.",
      deleted: "Modelo eliminado.",
      duplicate: "Otro modelo ya tiene este ID de API.",
      inUse: "Hay pasos de cadenas que todavía usan este modelo, así que no se puede eliminar.",
      empty: "Aún no hay modelos.",
    },
    providers: {
      title: "Proveedores LLM",
      description: "Las empresas cuyos modelos están en el catálogo. No se puede eliminar un proveedor que tiene modelos.",
      add: "Añadir proveedor",
      search: "Buscar proveedores",
      searchPlaceholder: "Nombre del proveedor",
      count: (count) => plural(count, "proveedor", "proveedores"),
      table: "Proveedores LLM",
      createTitle: "Añadir un proveedor",
      editTitle: (label) => `Editar ${label}`,
      deleteTitle: (label) => `¿Eliminar ${label}?`,
      deleteBody: (label) => `${label} se quitará del catálogo.`,
      created: "Proveedor añadido.",
      saved: "Proveedor guardado.",
      deleted: "Proveedor eliminado.",
      duplicate: "Ya existe un proveedor con este nombre.",
      inUse: "Este proveedor todavía tiene modelos. Elimínalos o muévelos primero.",
      empty: "Aún no hay proveedores.",
    },
    name: "Nombre",
    apiId: "ID de API",
    apiIdHint: "El ID exacto del modelo que se envía a la API, como claude-haiku-5-5.",
    provider: "Proveedor",
    usage: "Usado por",
    steps: (count) => plural(count, "paso de cadena", "pasos de cadena"),
    unused: "Sin uso",
    modelCount: (count) => plural(count, "modelo", "modelos"),
    anthropicOnly: "Las solicitudes van a la API de mensajes de Anthropic",
    anthropicOnlyBody: "La app envía cada paso de cadena a la API de Anthropic, así que en un paso solo funcionan IDs de modelos de Anthropic. Los demás proveedores y modelos se guardan como referencia.",
    chains: "Ver qué pasos usan cada modelo",
  },
  zh: {
    models: {
      title: "LLM 模型",
      description: "Prompt 链各步骤所使用的模型。修改模型的 API ID 后，使用它的所有步骤会从下一次请求起改用新的 ID。",
      add: "添加模型",
      search: "搜索模型",
      searchPlaceholder: "名称、API ID 或提供方",
      count: (count) => `${count} 个模型`,
      table: "LLM 模型",
      createTitle: "添加模型",
      editTitle: (label) => `编辑 ${label}`,
      deleteTitle: (label) => `删除 ${label}？`,
      deleteBody: (label) => `${label} 将从目录中移除。已记录的响应会保留当时使用的 API ID。`,
      created: "模型已添加。",
      saved: "模型已保存。",
      deleted: "模型已删除。",
      duplicate: "已有其他模型使用这个 API ID。",
      inUse: "仍有 Prompt 链步骤使用这个模型，因此无法删除。",
      empty: "还没有模型。",
    },
    providers: {
      title: "LLM 提供方",
      description: "目录中各模型所属的公司。仍有模型的提供方无法删除。",
      add: "添加提供方",
      search: "搜索提供方",
      searchPlaceholder: "提供方名称",
      count: (count) => `${count} 个提供方`,
      table: "LLM 提供方",
      createTitle: "添加提供方",
      editTitle: (label) => `编辑 ${label}`,
      deleteTitle: (label) => `删除 ${label}？`,
      deleteBody: (label) => `${label} 将从目录中移除。`,
      created: "提供方已添加。",
      saved: "提供方已保存。",
      deleted: "提供方已删除。",
      duplicate: "已存在同名的提供方。",
      inUse: "该提供方下仍有模型，请先删除或移走这些模型。",
      empty: "还没有提供方。",
    },
    name: "名称",
    apiId: "API ID",
    apiIdHint: "发送给 API 的准确模型 ID，例如 claude-haiku-5-5。",
    provider: "提供方",
    usage: "使用情况",
    steps: (count) => `${count} 个链步骤`,
    unused: "未使用",
    modelCount: (count) => `${count} 个模型`,
    anthropicOnly: "请求发送到 Anthropic Messages API",
    anthropicOnlyBody: "应用会把每个链步骤发送到 Anthropic API，因此步骤中只有 Anthropic 的模型 ID 可用。其他提供方和模型仅作记录。",
    chains: "查看各模型被哪些步骤使用",
  },
};

const total = (counts: { count: number }[]) => counts[0]?.count ?? 0;

export function ModelsManager({ rows, providers }: { rows: LlmModel[]; providers: { id: number; name: string }[] }) {
  const t = messages[useLocale()];
  const format = useFormat();
  return (
    <ResourceManager<LlmModel> resource="llm-models" rows={rows} text={t.models}
      notice={(
        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t.anthropicOnly}</Alert.Title>
            <Alert.Description>
              {t.anthropicOnlyBody}{" "}
              <NextLink href="/admin/prompt-chains" className="underline underline-offset-2">{t.chains}</NextLink>
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      label={(row) => row.name}
      searchText={(row) => `${row.name} ${row.api_model_id} ${row.provider?.name ?? ""}`}
      toDraft={(row) => ({ name: row.name, api_model_id: row.api_model_id, provider_id: String(row.provider_id) })}
      emptyDraft={{ name: "", api_model_id: "", provider_id: providers.length === 1 ? String(providers[0].id) : "" }}
      columns={[
        { id: "name", label: t.name, isRowHeader: true, sortValue: (row) => row.name, render: (row) => <span className="font-medium">{row.name}</span> },
        { id: "api_model_id", label: t.apiId, sortValue: (row) => row.api_model_id, render: (row) => <Typography.Code>{row.api_model_id}</Typography.Code> },
        { id: "provider", label: t.provider, sortValue: (row) => row.provider?.name ?? "", render: (row) => <Chip size="sm" variant="secondary">{row.provider?.name ?? "—"}</Chip> },
        {
          id: "usage", label: t.usage, sortValue: (row) => total(row.steps), render: (row) => total(row.steps) > 0
            ? <Chip size="sm" variant="soft" color="accent">{t.steps(format.number(total(row.steps)))}</Chip>
            : <span className="text-sm text-muted">{t.unused}</span>,
        },
      ]}
      fields={[
        { name: "name", label: t.name, placeholder: "Claude Haiku 5.5" },
        { name: "api_model_id", label: t.apiId, description: t.apiIdHint, placeholder: "claude-haiku-5-5" },
        { name: "provider_id", label: t.provider, options: providers.map((provider) => ({ id: String(provider.id), label: provider.name })) },
      ]}
    />
  );
}

export function ProvidersManager({ rows }: { rows: LlmProvider[] }) {
  const t = messages[useLocale()];
  const format = useFormat();
  return (
    <ResourceManager<LlmProvider> resource="llm-providers" rows={rows} text={t.providers}
      label={(row) => row.name}
      searchText={(row) => row.name}
      toDraft={(row) => ({ name: row.name })}
      emptyDraft={{ name: "" }}
      columns={[
        { id: "name", label: t.name, isRowHeader: true, sortValue: (row) => row.name, render: (row) => <span className="font-medium">{row.name}</span> },
        {
          id: "models", label: t.models.title, sortValue: (row) => total(row.models), render: (row) => (
            <NextLink href="/admin/models" className="text-sm underline-offset-2 hover:underline">{t.modelCount(format.number(total(row.models)))}</NextLink>
          ),
        },
      ]}
      fields={[{ name: "name", label: t.name, placeholder: "Anthropic" }]}
    />
  );
}
