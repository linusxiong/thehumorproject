// Server-side checks for uploaded photos, shared by the member avatar route and the admin image manager.
export const maxPhotoBytes = 2 * 1024 * 1024;

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
// Trust the file's leading bytes, never the client-supplied name or type.
const formats = [
  { type: "image/jpeg", extension: "jpg", matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { type: "image/png", extension: "png", matches: (bytes: Uint8Array) => ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n" },
  { type: "image/webp", extension: "webp", matches: (bytes: Uint8Array) => ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP" },
];

export const photoFormat = (bytes: Uint8Array) => formats.find((candidate) => candidate.matches(bytes)) ?? null;

// Object names are random, so they reveal nothing about the member: a UUID and the detected extension.
export const isPhotoPath = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(value);
