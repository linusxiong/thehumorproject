import type { Locale, Messages } from "./locale";

// API routes answer in English; the client shows a localized message chosen by HTTP status instead.
export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`Request failed with status ${status}`);
  }
}

type StatusMessages = Partial<Record<number, string>>;

const en: StatusMessages = {
  400: "Something in that request wasn’t valid. Please check it and try again.",
  401: "Please sign in to continue.",
  403: "You’re not allowed to do that. You may need to verify your email first.",
  404: "We couldn’t find that. It may have been removed.",
  409: "That conflicts with a recent change. Refresh and try again.",
  413: "That file is too large.",
  415: "That file type isn’t supported.",
  422: "That doesn’t look like a joke, or it isn’t in English, Spanish, or Chinese. Try a different one.",
  429: "You’ve reached today’s limit of 10 jokes. Come back in 24 hours.",
  502: "We couldn’t adapt this joke right now. Please try again.",
  503: "This feature isn’t set up yet. Please try again later.",
};

const messages: Messages<StatusMessages> = {
  en,
  es: {
    400: "Algo en la solicitud no es válido. Revísalo e inténtalo de nuevo.",
    401: "Inicia sesión para continuar.",
    403: "No tienes permiso para hacer esto. Puede que primero debas verificar tu correo.",
    404: "No encontramos lo que buscas. Es posible que se haya eliminado.",
    409: "Hay un conflicto con un cambio reciente. Actualiza e inténtalo de nuevo.",
    413: "El archivo es demasiado grande.",
    415: "Ese tipo de archivo no es compatible.",
    422: "Eso no parece un chiste, o no está en inglés, español o chino. Prueba con otro.",
    429: "Llegaste al límite de 10 chistes por día. Vuelve en 24 horas.",
    502: "No pudimos adaptar este chiste en este momento. Inténtalo de nuevo.",
    503: "Esta función aún no está configurada. Inténtalo más tarde.",
  },
  zh: {
    400: "请求内容无效，请检查后重试。",
    401: "请先登录再继续。",
    403: "你没有权限执行此操作，可能需要先验证邮箱。",
    404: "找不到相关内容，可能已被删除。",
    409: "与最近的更改冲突，请刷新后重试。",
    413: "文件太大了。",
    415: "不支持该文件类型。",
    422: "这看起来不像笑话，或者不是英文、西班牙文或中文。换一个试试吧。",
    429: "你今天已达到 10 个笑话的上限，请 24 小时后再来。",
    502: "我们暂时无法改编这个笑话，请重试。",
    503: "此功能尚未配置，请稍后再试。",
  },
};

// Returns the localized message for a failed request, or the caller's fallback for unknown statuses and network errors.
export function apiErrorMessage(locale: Locale, status: number | null, fallback: string) {
  return (status !== null && messages[locale][status]) || fallback;
}

export function errorStatus(reason: unknown) {
  return reason instanceof ApiError ? reason.status : null;
}
